import "server-only"

import type { Capability } from "@repo/access"
import {
  DRIVE_MAX_LIBRARIES,
  DRIVE_PLACE_LEVELS,
  type DriveFocus,
  type DriveScope,
  type GapKey,
  isGapKey,
  isValidStamp,
  PANEL_FOCUS_MESSAGE,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"
import { revalidateTag } from "next/cache"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { PROPOSAL_NOTE_MAX } from "@/components/drives/builder.logic"
import { hasCapability, requireCapability } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam, readJsonCapped } from "@/lib/bridge-params"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

import { drivePreviewCounts, PANEL_GAP_ZEROS } from "./drive-progress"

/**
 * The editorial board's drive routes (`/api/drives`, `/api/drives/[id]`,
 * `/api/drives/[id]/actions`), the builder's live counts
 * (`/api/drives/preview`) and a contributor's Drive Proposal
 * (`/api/drives/proposals`). Board writes need `drives.manage` in the
 * session; the counts admit anyone who builds or reviews a drive; a
 * proposal needs `submit.driveProposal`. Each counts against a per-user
 * limit, reads a capped JSON body, forwards only the keys its route allows,
 * and carries the caller's identity from the session, never from the
 * request. Strapi re-checks the caller's Role Grants (`isBoardMember`, the
 * submission policy) on every write.
 */

const STRAPI = () => process.env.STRAPI_URL ?? "http://127.0.0.1:1337"

/** A drive body: 500 pasted refs plus the words fit well inside this. */
export const MAX_DRIVE_BODY_BYTES = 128 * 1024

/** The keys a create or update forwards; every other key is dropped. */
export const DRIVE_BODY_KEYS = [
  "title",
  "summary",
  "steps",
  "focus",
  "scope",
  "unit",
  "startsAt",
  "endsAt",
  "goalPercent",
  "whereToLook",
  "storySlug",
] as const

/** The board's actions (`POST /drives/:documentId/actions` in Strapi). */
export const DRIVE_ACTIONS = [
  "pin",
  "unpin",
  "feature",
  "unfeature",
  "cancel",
  "reorder",
  "open",
  "close",
] as const

export type DriveAction = (typeof DRIVE_ACTIONS)[number]

export const isDriveAction = (v: unknown): v is DriveAction =>
  typeof v === "string" && (DRIVE_ACTIONS as readonly string[]).includes(v)

/** Board writes: 30 a minute per user, across create, update and actions. */
const writeLimiter = createRateLimiter({
  name: "drive-board",
  max: 30,
  windowMs: 60_000,
})

/** Live counts are debounced, but follow typing: 120 a minute per user. */
const previewLimiter = createRateLimiter({
  name: "drive-preview",
  max: 120,
  windowMs: 60_000,
})

/** Proposals: 10 a minute per user (Strapi allows one in review at a time). */
const proposalLimiter = createRateLimiter({
  name: "drive-proposals",
  max: 10,
  windowMs: 60_000,
})

/** Who may ask for the builder's live counts: anyone building or reviewing a drive. */
const PREVIEW_CAPABILITIES = [
  "drives.manage",
  "submit.driveProposal",
  "moderate.queue",
] as const satisfies readonly Capability[]

type BoardUser = {
  id: string
  email: string
  name?: string | null
  capabilities?: unknown
}

type Gate = { user: BoardUser; denied: null } | { user: null; denied: Response }

/**
 * The signed-in user holding any of `caps`, or the 401/403/429 to answer
 * instead.
 */
async function capabilityGate(
  limiter: typeof writeLimiter,
  caps: readonly [Capability, ...Capability[]]
): Promise<Gate> {
  const session = await getSessionSSR(await headers())
  const user = (session?.user ?? null) as BoardUser | null
  const denied = caps.some((cap) => hasCapability(user, cap))
    ? null
    : requireCapability(user, caps[0])
  if (denied || !user) {
    return {
      user: null,
      denied:
        denied ?? NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }
  const limit = await limiter.check(user.id)
  if (!limit.ok) return { user: null, denied: rateLimitResponse(limit) }

  return { user, denied: null }
}

/** The signed-in board member, or the 401/403/429 to answer instead. */
const boardGate = (limiter: typeof writeLimiter) =>
  capabilityGate(limiter, ["drives.manage"])

const asRecord = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}

/** Only `keys`, and only those present. */
export function pickKeys(
  body: unknown,
  keys: readonly string[]
): Record<string, unknown> {
  const src = asRecord(body)
  const out: Record<string, unknown> = {}
  for (const k of keys) if (k in src) out[k] = src[k]

  return out
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const strings = (v: unknown, max: number, ok: (s: string) => boolean) =>
  Array.isArray(v)
    ? v.filter((s): s is string => typeof s === "string" && ok(s)).slice(0, max)
    : []

/**
 * A Drive Scope with only the keys `DriveScope` has, each of the right
 * shape: place slugs per level, library refs, type names, a Dataset key and
 * a numeric ceiling. Library refs are kept up to one past the cap, so the
 * "at most 500" rule still sees an over-long list.
 */
export function cleanScope(raw: unknown): DriveScope {
  const src = asRecord(raw)
  const scope: DriveScope = {}

  const placesSrc = asRecord(src.places)
  const places: NonNullable<DriveScope["places"]> = {}
  for (const level of DRIVE_PLACE_LEVELS) {
    const slugs = strings(
      placesSrc[level],
      200,
      (s) => SLUG.test(s) && s.length <= 120
    )
    if (slugs.length > 0) places[level] = slugs
  }
  if (Object.keys(places).length > 0) scope.places = places

  const libraries = strings(
    src.libraries,
    DRIVE_MAX_LIBRARIES + 1,
    (s) => SLUG.test(s) && s.length <= 120
  )
  if (libraries.length > 0) scope.libraries = libraries

  const types = strings(src.libraryTypes, 20, (s) =>
    /^[A-Za-z ]{1,40}$/.test(s)
  )
  if (types.length > 0) scope.libraryTypes = types

  if (typeof src.source === "string" && src.source.trim()) {
    scope.source = src.source.trim().slice(0, 80)
  }
  if (
    typeof src.completenessBelow === "number" &&
    Number.isFinite(src.completenessBelow)
  ) {
    scope.completenessBelow = src.completenessBelow
  }

  return scope
}

/**
 * A Focus with only its kind's keys. Values are Strapi's to judge
 * (`validateDrive`); this only drops keys a Focus doesn't have.
 */
export function cleanFocus(raw: unknown): unknown {
  const src = asRecord(raw)
  switch (src.kind) {
    case "gaps":
      return { kind: "gaps", gaps: src.gaps }
    case "verify":
      return { kind: "verify", sections: src.sections, before: src.before }
    case "record":
      return { kind: "record", target: src.target }

    default:
      return raw
  }
}

const isVerifySection = (v: unknown): v is VerifySection =>
  typeof v === "string" && (VERIFY_SECTIONS as readonly string[]).includes(v)

/**
 * The preview's Focus, or null: one to three known gaps; one or more
 * `VERIFY_SECTIONS` (repeats dropped) and a valid `before` stamp; or a
 * whole-number completeness target from 50 to 100.
 */
export function previewFocus(raw: unknown): DriveFocus | null {
  const src = asRecord(raw)
  switch (src.kind) {
    case "gaps": {
      if (!Array.isArray(src.gaps)) return null
      const gaps = [...new Set(src.gaps)].filter(isGapKey) as GapKey[]
      if (
        gaps.length < 1 ||
        gaps.length > 3 ||
        gaps.length !== src.gaps.length
      ) {
        return null
      }

      return { kind: "gaps", gaps }
    }
    case "verify": {
      if (!Array.isArray(src.sections) || !isValidStamp(src.before)) return null
      const sections: unknown[] = [...new Set(src.sections)]
      if (sections.length < 1 || !sections.every(isVerifySection)) return null

      return { kind: "verify", sections, before: src.before }
    }
    case "record": {
      const target = src.target
      if (
        typeof target !== "number" ||
        !Number.isInteger(target) ||
        target < 50 ||
        target > 100
      ) {
        return null
      }

      return { kind: "record", target }
    }

    default:
      return null
  }
}

const DOCUMENT_ID = /^[a-z0-9]{20,32}$/

/** Slugs asked for per Strapi request; keeps the URL short. */
const SLUG_BATCH = 50

/**
 * Library refs (slugs or documentIds) as documentIds, in order. A
 * documentId passes as it is; slugs are looked up among published
 * libraries in Strapi, 50 at a time. Null when Strapi can't be reached.
 */
export async function resolveLibraryRefs(
  refs: readonly string[]
): Promise<{ ids: string[]; unknown: string[] } | null> {
  const slugs = refs.filter((r) => !DOCUMENT_ID.test(r))
  const found = new Map<string, string>()
  try {
    for (let i = 0; i < slugs.length; i += SLUG_BATCH) {
      const batch = slugs.slice(i, i + SLUG_BATCH)
      const qs = new URLSearchParams()
      batch.forEach((slug, j) => qs.set(`filters[slug][$in][${j}]`, slug))
      qs.set("pagination[pageSize]", "100")
      const res = await fetch(`${STRAPI()}/api/libraries?${qs.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) return null
      const json = (await res.json()) as {
        data?: { slug?: unknown; documentId?: unknown }[]
      }
      for (const row of json.data ?? []) {
        if (
          typeof row.slug === "string" &&
          typeof row.documentId === "string"
        ) {
          found.set(row.slug, row.documentId)
        }
      }
    }
  } catch {
    return null
  }

  const ids: string[] = []
  const unknown: string[] = []
  for (const ref of refs) {
    const id = DOCUMENT_ID.test(ref) ? ref : found.get(ref)
    if (!id) unknown.push(ref)
    else if (!ids.includes(id)) ids.push(id)
  }

  return { ids, unknown }
}

/** A 400 in Strapi's own shape, so the builder reads it like Strapi's. */
const invalidDrive = (errors: string[]) =>
  NextResponse.json(
    {
      data: null,
      error: {
        status: 400,
        name: "ValidationError",
        message: "Invalid drive",
        details: { errors },
      },
    },
    { status: 400 }
  )

const notFoundMessage = (unknown: readonly string[]) =>
  `These libraries weren’t found: ${unknown.join(", ")}.`

const unavailable = () =>
  NextResponse.json(
    { error: "The drives service is unavailable." },
    { status: 502 }
  )

/** Strapi's answer as it came: same status, JSON body (or an error). */
async function passThrough(res: Response): Promise<Response> {
  const text = await res.text()
  let body: unknown
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { error: { status: res.status, message: "Unexpected response." } }
  }

  return NextResponse.json(body, {
    status: res.status,
    headers: { "Cache-Control": "no-store" },
  })
}

/** An action body: `action` (one of `DRIVE_ACTIONS`) and `pinOrder`. */
function actionBody(raw: unknown): Record<string, unknown> | Response {
  const body = pickKeys(raw, ["action", "pinOrder"])

  return isDriveAction(body.action)
    ? body
    : NextResponse.json({ error: "Unknown action" }, { status: 400 })
}

/**
 * A drive body, as a board create or update and a proposal send it:
 * `DRIVE_BODY_KEYS`, its focus and scope cleaned, and a pasted list's slugs
 * resolved to documentIds. The response is the 400 naming any library not
 * found, or the 502 when Strapi can't be reached to look them up.
 */
export async function prepareDriveBody(
  raw: unknown
): Promise<
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; response: Response }
> {
  const body = pickKeys(raw, DRIVE_BODY_KEYS)
  if ("focus" in body) body.focus = cleanFocus(body.focus)
  if (!("scope" in body)) return { ok: true, body }

  const scope = cleanScope(body.scope)
  if (scope.libraries?.length) {
    const resolved = await resolveLibraryRefs(scope.libraries)
    if (!resolved) return { ok: false, response: unavailable() }
    if (resolved.unknown.length > 0) {
      return {
        ok: false,
        response: invalidDrive([notFoundMessage(resolved.unknown)]),
      }
    }
    scope.libraries = resolved.ids
  }
  body.scope = scope

  return { ok: true, body }
}

export type BoardWrite =
  | { kind: "create" }
  | { kind: "update"; documentId: string }
  | { kind: "action"; documentId: string }

/**
 * One board write, checked and forwarded to Strapi. A drive body keeps
 * `DRIVE_BODY_KEYS`, its scope and focus cleaned and any pasted library
 * slugs resolved to documentIds; an action keeps `action` (one of
 * `DRIVE_ACTIONS`) and `pinOrder`. A write Strapi accepts expires every
 * cached drive read, so the drive page and Noticeboard show it at once.
 */
export async function proxyBoardWrite(
  req: Request,
  write: BoardWrite
): Promise<Response> {
  const gate = await boardGate(writeLimiter)
  if (gate.denied) return gate.denied

  if (!process.env.STRAPI_BRIDGE_SECRET) {
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )
  }
  if (write.kind !== "create" && !isDocumentIdParam(write.documentId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 })
  }

  const parsed = await readJsonCapped(req, MAX_DRIVE_BODY_BYTES)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  }

  let body: Record<string, unknown>
  if (write.kind === "action") {
    const action = actionBody(parsed.body)
    if (action instanceof Response) return action
    body = action
  } else {
    const prepared = await prepareDriveBody(parsed.body)
    if (!prepared.ok) return prepared.response
    body = prepared.body
  }

  const base =
    write.kind === "create" ? "/api/drives" : `/api/drives/${write.documentId}`
  const path = write.kind === "action" ? `${base}/actions` : base

  try {
    const res = await fetch(`${STRAPI()}${path}`, {
      method: write.kind === "update" ? "PUT" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...bridgeUserHeaders(gate.user),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    })
    if (res.ok) revalidateTag("drive", { expire: 0 })

    return await passThrough(res)
  } catch {
    return unavailable()
  }
}

/** A gaps Focus with no gap chosen yet: the preview counts the scope only. */
function isScopeOnly(raw: unknown): boolean {
  const src = asRecord(raw)

  return src.kind === "gaps" && Array.isArray(src.gaps) && src.gaps.length === 0
}

/**
 * The preview's Focus and Scope from its body, or the 400 to answer: a
 * Focus `previewFocus` accepts (or a gaps Focus with no gap yet, as null),
 * and a scope with places or a list of at most 500.
 */
function previewInput(
  body: unknown
):
  | { ok: true; focus: DriveFocus | null; scope: DriveScope }
  | { ok: false; response: Response } {
  const src = asRecord(body)
  const scopeOnly = isScopeOnly(src.focus)
  const focus = scopeOnly ? null : previewFocus(src.focus)
  if (!focus && !scopeOnly) {
    return { ok: false, response: invalidDrive([PANEL_FOCUS_MESSAGE]) }
  }
  const scope = cleanScope(src.scope)
  if ((scope.libraries?.length ?? 0) > DRIVE_MAX_LIBRARIES) {
    return {
      ok: false,
      response: invalidDrive(["A list can hold at most 500 libraries."]),
    }
  }
  if (!scope.libraries?.length && !scope.places) {
    return {
      ok: false,
      response: invalidDrive([
        "Limit the drive to places or to a list of libraries.",
      ]),
    }
  }

  return { ok: true, focus, scope }
}

/**
 * The builder's live preview: `{ scope, focus }` →
 * `{ total, todo, gaps, places }`, counted as the drive would be if it
 * opened now. `gaps` is how many libraries in scope miss each gap the task
 * panel fills; `places` gives each place its own counts (`level`, `slug`,
 * `name`, `total` and what's left), at most 12. A gaps Focus with no gap
 * yet counts the scope alone, with nothing left to count. A pasted list's
 * slugs are resolved first, and any that aren't found come back as
 * `unknown`.
 */
export async function previewDrive(req: Request): Promise<Response> {
  const gate = await capabilityGate(previewLimiter, PREVIEW_CAPABILITIES)
  if (gate.denied) return gate.denied

  const parsed = await readJsonCapped(req, MAX_DRIVE_BODY_BYTES)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  }
  const input = previewInput(parsed.body)
  if (!input.ok) return input.response
  const { focus, scope } = input

  let unknown: string[] = []
  if (scope.libraries?.length) {
    const resolved = await resolveLibraryRefs(scope.libraries)
    if (!resolved) return unavailable()
    unknown = resolved.unknown
    if (resolved.ids.length === 0) {
      return NextResponse.json(
        {
          total: 0,
          todo: focus ? 0 : null,
          gaps: { ...PANEL_GAP_ZEROS },
          places: [],
          unknown,
        },
        { headers: { "Cache-Control": "no-store" } }
      )
    }
    scope.libraries = resolved.ids
  }

  const counts = await drivePreviewCounts({
    scope,
    focus,
    openedAt: new Date().toISOString(),
  })
  if (!counts) {
    return NextResponse.json(
      { error: "The counts are unavailable right now." },
      { status: 502 }
    )
  }

  return NextResponse.json(
    { ...counts, ...(unknown.length ? { unknown } : {}) },
    { headers: { "Cache-Control": "no-store" } }
  )
}

/** A proposal's note to the Moderator: trimmed and capped, or null. */
function proposalNote(raw: unknown): string | null {
  const note = asRecord(raw).note
  if (typeof note !== "string") return null
  const trimmed = note.trim().slice(0, PROPOSAL_NOTE_MAX)

  return trimmed || null
}

/**
 * A contributor's Drive Proposal (spec §5.7, §7.2): the same drive body the
 * board sends, cleaned the same way, posted to Strapi as a `drive_proposal`
 * Submission with the definition in `draftData.drive` and the optional note
 * for the Moderator. Strapi's submission policy decides: the standing rule,
 * one proposal in review, a valid drive the task panel can fill. Its answer
 * comes back as it is, so the builder reads `error.details.errors`.
 */
export async function proposeDrive(req: Request): Promise<Response> {
  const gate = await capabilityGate(proposalLimiter, ["submit.driveProposal"])
  if (gate.denied) return gate.denied

  if (!process.env.STRAPI_BRIDGE_SECRET) {
    return NextResponse.json(
      { error: "Bridge not configured" },
      { status: 500 }
    )
  }

  const parsed = await readJsonCapped(req, MAX_DRIVE_BODY_BYTES)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  }
  const prepared = await prepareDriveBody(parsed.body)
  if (!prepared.ok) return prepared.response
  const note = proposalNote(parsed.body)

  try {
    const res = await fetch(`${STRAPI()}/api/content-moderation/submissions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...bridgeUserHeaders(gate.user),
      },
      body: JSON.stringify({
        submissionType: "drive_proposal",
        targetEntityType: "drive",
        draftData: { drive: prepared.body },
        ...(note ? { note } : {}),
      }),
      cache: "no-store",
    })

    return await passThrough(res)
  } catch {
    return unavailable()
  }
}
