/**
 * Machine API proposals: untrusted suggestions from a paid API account.
 *
 * They are ordinary moderation submissions with an `api:<account>` submitter
 * that no Better Auth id can take, so they never meet a contributor's own
 * views, cannot assert staff identity, are never published without review
 * and never earn rewards (rewards need an attributable human account). Only
 * the whitelisted fields below can be proposed; everything else, including
 * relations, staff fields, source records and dotted CMS paths, is refused.
 */

export const API_SUBMITTER_PREFIX = "api:"
/** A non-deliverable address: the schema requires one; nothing is sent. */
export const API_SUBMITTER_EMAIL = "api-proposals@libraries.invalid"
export const API_SUBMITTER_NAME = "API account"

export const isApiSubmitter = (id: unknown) =>
  typeof id === "string" && id.startsWith(API_SUBMITTER_PREFIX)
export const isApiProposal = (row: {
  submittedByUserId?: unknown
  apiAccountId?: unknown
}) =>
  isApiSubmitter(row?.submittedByUserId) ||
  (typeof row?.apiAccountId === "string" && row.apiAccountId !== "")

/** Write limits per key and per API account (durable, counted in the CMS). */
export const API_PROPOSAL_LIMITS = {
  perKeyHour: 30,
  perAccountDay: 200,
} as const

export const API_SOURCE_LICENCES = [
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
const EVIDENCE_TYPES = ["institutional_url", "press_release", "other"] as const

const OPERATIONAL_STATUS = [
  "open",
  "temporarily_closed",
  "permanently_closed",
  "seasonal",
  "appointment_only",
  "planned",
  "unknown",
]
const OPERATOR_TYPES = [
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
]

type Rule =
  | { kind: "text"; max: number }
  | { kind: "url" }
  | { kind: "email" }
  | { kind: "enum"; values: readonly string[] }
  | { kind: "coordinate"; limit: 90 | 180 }

const TEXT = (max: number): Rule => ({ kind: "text", max })

/** Fields an API correction may change on a published Library. */
export const API_CORRECTABLE_FIELDS: Record<string, Rule> = {
  name: TEXT(200),
  shortName: TEXT(120),
  summary: TEXT(2000),
  streetAddress: TEXT(300),
  city: TEXT(120),
  district: TEXT(120),
  postalCode: TEXT(40),
  website: { kind: "url" },
  catalogueUrl: { kind: "url" },
  email: { kind: "email" },
  phone: TEXT(60),
  operationalStatus: { kind: "enum", values: OPERATIONAL_STATUS },
  operatorType: { kind: "enum", values: OPERATOR_TYPES },
  closureReason: TEXT(1000),
  lat: { kind: "coordinate", limit: 90 },
  lng: { kind: "coordinate", limit: 180 },
}
/** Fields an API new-library proposal may carry (plus the place slugs). */
export const API_LIBRARY_FIELDS: Record<string, Rule> = {
  ...API_CORRECTABLE_FIELDS,
  libraryType: TEXT(80),
}

export class ProposalError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail?: Record<string, unknown>
  ) {
    super(code)
  }
}

const FIELD_NAME = /^[a-zA-Z]{1,40}$/
const PLACE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/

function value(field: string, rule: Rule, raw: unknown) {
  const bad = () => {
    throw new ProposalError(400, "invalid_field_value", { field })
  }
  if (rule.kind === "coordinate") {
    if (
      typeof raw !== "number" ||
      !Number.isFinite(raw) ||
      Math.abs(raw) > rule.limit
    )
      bad()

    return raw as number
  }
  if (typeof raw !== "string") return bad()
  const text = raw.trim()
  if (!text) bad()
  if (rule.kind === "text" && text.length > rule.max) bad()
  if (rule.kind === "enum" && !rule.values.includes(text)) bad()
  if (
    rule.kind === "url" &&
    (text.length > 500 || !/^https?:\/\/[^\s/$.?#][^\s]*$/i.test(text))
  )
    bad()
  if (rule.kind === "email" && (text.length > 254 || !plainEmail(text))) bad()

  return text
}

/** One @, no whitespace, and a dot inside the domain (no backtracking regex). */
function plainEmail(text: string): boolean {
  const at = text.indexOf("@")
  if (at < 1 || at !== text.lastIndexOf("@") || /\s/.test(text)) return false
  const domain = text.slice(at + 1)
  const dot = domain.lastIndexOf(".")

  return dot > 0 && dot < domain.length - 1
}

/** Whitelisted fields only; any other key or a dotted path is refused. */
export function proposalFields(
  input: unknown,
  rules: Record<string, Rule>,
  { min = 1, max = 20 } = {}
) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ProposalError(400, "invalid_proposal")
  const entries = Object.entries(input as Record<string, unknown>)
  if (entries.length < min || entries.length > max)
    throw new ProposalError(400, "invalid_proposal")
  const out: Record<string, unknown> = {}
  for (const [field, raw] of entries) {
    if (!FIELD_NAME.test(field))
      throw new ProposalError(400, "field_path_refused")
    const rule = rules[field]
    if (!rule) throw new ProposalError(400, "field_not_allowed", { field })
    out[field] = value(field, rule, raw)
  }
  if ("lat" in out !== "lng" in out)
    throw new ProposalError(400, "invalid_field_value", { field: "location" })

  return out
}

export type ProposalEvidence = {
  type: (typeof EVIDENCE_TYPES)[number]
  url: string
  licence: (typeof API_SOURCE_LICENCES)[number]
  sourceName: string
  attribution: string | null
}

export function proposalEvidence(input: unknown): ProposalEvidence {
  const e = input as Record<string, unknown>
  if (
    !e ||
    typeof e !== "object" ||
    Array.isArray(e) ||
    Object.keys(e).some(
      (k) =>
        !["type", "url", "licence", "sourceName", "attribution"].includes(k)
    ) ||
    !(EVIDENCE_TYPES as readonly unknown[]).includes(e.type) ||
    typeof e.url !== "string" ||
    !/^https:\/\/[^\s/$.?#][^\s]*$/i.test(e.url) ||
    e.url.length > 500 ||
    !(API_SOURCE_LICENCES as readonly unknown[]).includes(e.licence) ||
    typeof e.sourceName !== "string" ||
    !e.sourceName.trim() ||
    e.sourceName.length > 200 ||
    (e.attribution !== undefined &&
      (typeof e.attribution !== "string" || e.attribution.length > 500))
  )
    throw new ProposalError(400, "invalid_evidence")

  return {
    type: e.type as ProposalEvidence["type"],
    url: e.url,
    licence: e.licence as ProposalEvidence["licence"],
    sourceName: e.sourceName.trim(),
    attribution:
      typeof e.attribution === "string" ? e.attribution.trim() : null,
  }
}

export function placeSlugs(input: unknown) {
  const p = input as Record<string, unknown>
  if (
    !p ||
    typeof p !== "object" ||
    Array.isArray(p) ||
    Object.keys(p).some((k) => !["country", "region", "area"].includes(k))
  )
    throw new ProposalError(400, "invalid_place")
  for (const v of [p.country, p.region, p.area])
    if (v !== undefined && (typeof v !== "string" || !PLACE_SLUG.test(v)))
      throw new ProposalError(400, "invalid_place")
  if (!p.country || (p.area && !p.region))
    throw new ProposalError(400, "invalid_place")

  return p as { country: string; region?: string; area?: string }
}

/** The status an API account may see; never notes or reviewer identity. */
export function publicProposalStatus(status: unknown) {
  switch (status) {
    case "pending":
      return "in_review"
    case "needs_info":
      return "needs_information"
    case "approved":
      return "accepted"
    case "rejected":
      return "declined"

    default:
      return "received"
  }
}
