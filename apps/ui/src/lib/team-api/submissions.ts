import "server-only"

import { isLibraryEntityRef } from "@repo/shared-data"
import { z } from "zod"

import { BillingError } from "@/lib/billing/config"
import { readJsonCapped } from "@/lib/bridge-params"
import { LIVE_LOCALES } from "@/lib/live-locales"

import {
  ApiDetailError,
  bridgeFailure,
  resourceBridge,
  strictQuery,
} from "./resources"

/** Largest accepted proposal body, in bytes. */
export const SUBMISSION_BODY_LIMIT = 16_384
export const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,64}$/
export const SOURCE_LICENCES = [
  "CC0-1.0",
  "CC-BY-4.0",
  "CC-BY-SA-4.0",
  "ODbL-1.0",
  "OGL-UK-3.0",
  "PDDL-1.0",
  "public-domain",
  "facts-only",
  "own-publication",
] as const

const text = (max: number) => z.string().trim().min(1).max(max)
const url = z
  .string()
  .max(500)
  .regex(/^https?:\/\/[^\s/$.?#][^\s]*$/i)
const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/)
/** Every field a proposal may name. Anything else is refused, not dropped. */
const Fields = {
  name: text(200),
  shortName: text(120),
  summary: text(2000),
  streetAddress: text(300),
  city: text(120),
  district: text(120),
  postalCode: text(40),
  website: url,
  catalogueUrl: url,
  email: z.string().max(254).email(),
  phone: text(60),
  operationalStatus: z.enum([
    "open",
    "temporarily_closed",
    "permanently_closed",
    "seasonal",
    "appointment_only",
    "planned",
    "unknown",
  ]),
  operatorType: z.enum([
    "National Government",
    "Regional Government",
    "Municipality",
    "University",
    "Religious Institution",
    "Private Foundation",
    "Independent",
    "Volunteer Managed",
    "Community Managed",
    "Other",
  ]),
  closureReason: text(1000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
}
const OptionalFields = z.object(Fields).partial().shape
const Evidence = z
  .object({
    type: z.enum(["institutional_url", "press_release", "other"]),
    url: z
      .string()
      .max(500)
      .regex(/^https:\/\/[^\s/$.?#][^\s]*$/i),
    licence: z.enum(SOURCE_LICENCES),
    sourceName: text(200),
    attribution: z.string().max(500).optional(),
  })
  .strict()
const located = (value: { lat?: number; lng?: number }) =>
  (value.lat === undefined) === (value.lng === undefined)

export const LibraryProposal = z
  .object({
    locale: z.string().max(8).default("en"),
    library: z
      .object({
        ...OptionalFields,
        name: text(200),
        libraryType: text(80).optional(),
      })
      .strict()
      .refine(located, { message: "lat and lng go together" }),
    place: z
      .object({
        country: slug,
        region: slug.optional(),
        area: slug.optional(),
      })
      .strict()
      .refine((p) => !p.area || p.region),
    evidence: Evidence,
    note: z.string().max(1000).optional(),
  })
  .strict()

export const CorrectionProposal = z
  .object({
    locale: z.string().max(8).default("en"),
    target: z.string().refine(isLibraryEntityRef),
    changes: z
      .object(Fields)
      .partial()
      .strict()
      .refine((c) => Object.keys(c).length >= 1 && Object.keys(c).length <= 10)
      .refine(located, { message: "lat and lng go together" }),
    evidence: Evidence,
    note: z.string().max(1000).optional(),
  })
  .strict()

/** The CMS refusals a client may see; anything else is generic. */
const PROPOSAL_ERRORS = {
  400: [
    "invalid_proposal",
    "invalid_field_value",
    "field_not_allowed",
    "field_path_refused",
    "invalid_evidence",
    "invalid_place",
    "unknown_place",
    "locale_unavailable",
    "unsafe_content",
  ],
  409: [
    "idempotency_conflict",
    "duplicate_proposal",
    "possible_duplicate",
    "no_change",
  ],
  429: ["proposal_rate_limit"],
} as const

/** Pass through a refusal's safe detail (a field name or the client's own ids). */
function refusal(body: unknown) {
  const error = (body as { error?: Record<string, unknown> } | null)?.error
  const detail: Record<string, unknown> = {}
  if (typeof error?.field === "string" && /^[a-zA-Z]{1,40}$/.test(error.field))
    detail.field = error.field
  if (
    typeof error?.proposalId === "string" &&
    /^[a-z0-9]{20,32}$/.test(error.proposalId)
  )
    detail.proposalId = error.proposalId
  if (Array.isArray(error?.existing))
    detail.existing = error.existing
      .filter((ref): ref is string => isLibraryEntityRef(ref))
      .slice(0, 3)

  return detail
}

/**
 * POST /api/v1/submissions/{libraries,corrections}: one untrusted proposal
 * for the moderation queue. Requires an `Idempotency-Key` header; a replay
 * with the same key and payload returns the original proposal unchanged.
 */
export async function apiSubmitProposal(
  request: Request,
  kind: "library" | "correction",
  account: { teamId: string; keyId: string },
  maximum: number
) {
  strictQuery(request, [])
  const idempotencyKey = request.headers.get("idempotency-key") ?? ""
  if (!IDEMPOTENCY_KEY.test(idempotencyKey))
    throw new BillingError("idempotency_key_required", 400)
  if (!/^application\/json\b/i.test(request.headers.get("content-type") ?? ""))
    throw new BillingError("invalid_proposal", 415)
  const parsed = await readJsonCapped(request, SUBMISSION_BODY_LIMIT)
  if (!parsed.ok)
    throw new BillingError(
      parsed.status === 413 ? "request_too_large" : "invalid_proposal",
      parsed.status
    )
  const schema = kind === "library" ? LibraryProposal : CorrectionProposal
  const choice = schema.safeParse(parsed.body)
  if (!choice.success) throw new BillingError("invalid_proposal", 400)
  const { locale, evidence, note, ...proposal } = choice.data
  if (!LIVE_LOCALES.includes(locale))
    throw new BillingError("locale_unavailable", 400)
  const result = await resourceBridge<{ data?: unknown; replayed?: boolean }>(
    "content-moderation",
    "api/proposals",
    {
      method: "POST",
      body: {
        account: account.teamId,
        keyId: account.keyId,
        idempotencyKey,
        kind,
        locale,
        proposal,
        evidence,
        ...(note ? { note } : {}),
      },
      maximum,
      failure: "api_submissions_unavailable",
    }
  )
  if (result.status === 201 || result.status === 200)
    return {
      status: result.status as 200 | 201,
      body: {
        data: result.body?.data ?? null,
        meta: {
          replayed: result.body?.replayed === true,
          trust: "untrusted_proposal",
          notice:
            "Proposals are reviewed by moderators before anything is published. API proposals earn no contribution rewards.",
        },
      },
    }
  const code = (result.body as { error?: { code?: unknown } } | null)?.error
    ?.code
  const allowed = PROPOSAL_ERRORS[result.status as keyof typeof PROPOSAL_ERRORS]
  if (
    typeof code === "string" &&
    (allowed as readonly string[])?.includes(code)
  )
    throw new ApiDetailError(code, result.status, refusal(result.body))

  return bridgeFailure(result, {})
}

/** GET /api/v1/submissions/{id}: safe status, for the submitting account only. */
export async function apiProposalStatus(
  request: Request,
  id: string,
  teamId: string,
  maximum: number
) {
  strictQuery(request, [])
  // Unknown, foreign and malformed ids get the same 404.
  if (!/^[a-z0-9]{20,32}$/.test(id))
    throw new BillingError("record_not_found", 404)
  const result = await resourceBridge<{ data?: unknown }>(
    "content-moderation",
    `api/proposals/${encodeURIComponent(id)}`,
    {
      query: { account: teamId },
      maximum,
      failure: "api_submissions_unavailable",
    }
  )
  if (result.status !== 200) bridgeFailure(result, {})

  return { data: result.body?.data ?? null }
}
