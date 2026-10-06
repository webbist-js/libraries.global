import "server-only"

import {
  DRIVE_MAX_LIBRARIES,
  DRIVE_PLACE_LEVELS,
  type DriveFocus,
  type DriveScope,
  type GapKey,
  isGapKey,
} from "@repo/shared-data"
import { revalidateTag } from "next/cache"
import { headers } from "next/headers"
import { NextResponse } from "next/server"

import { requireCapability } from "@/lib/access-server"
import { getSessionSSR } from "@/lib/auth-server"
import { isDocumentIdParam, readJsonCapped } from "@/lib/bridge-params"
import { bridgeUserHeaders } from "@/lib/bridge-user-headers"
import { createRateLimiter, rateLimitResponse } from "@/lib/rate-limit"

import { driveCounts } from "./drive-progress"

/**
 * The editorial board's drive routes (`/api/drives`, `/api/drives/[id]`,
 * `/api/drives/[id]/actions`, `/api/drives/preview`). Each needs
 * `drives.manage` in the session, counts against a per-user limit, reads a
 * capped JSON body, forwards only the keys its route allows, and carries the
 * caller's identity from the session, never from the request. Strapi
 * re-checks the caller's Role Grants (`isBoardMember`) on every write.
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

type BoardUser = {
  id: string
  email: string
  name?: string | null
  capabilities?: unknown
}

type Gate = { user: BoardUser; denied: null } | { user: null; denied: Response }

/** The signed-in board member, or the 401/403/429 to answer instead. */
async function boardGate(limiter: typeof writeLimiter): Promise<Gate> {
  const session = await getSessionSSR(await headers())
  const user = (session?.user ?? null) as BoardUser | null
  const denied = requireCapability(user, "drives.manage")
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

/** The preview's Focus: one to three known gaps, or null. */
function gapsFocus(raw: unknown): DriveFocus | null {
  const src = asRecord(raw)
  if (src.kind !== "gaps" || !Array.isArray(src.gaps)) return null
  const gaps = [...new Set(src.gaps)].filter(isGapKey) as GapKey[]
  if (gaps.length < 1 || gaps.length > 3 || gaps.length !== src.gaps.length) {
    return null
  }

  return { kind: "gaps", gaps }
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
 * A drive body: `DRIVE_BODY_KEYS`, its focus and scope cleaned, and a
 * pasted list's slugs resolved to documentIds (400 naming any not found).
 */
async function driveBody(
  raw: unknown
): Promise<Record<string, unknown> | Response> {
  const body = pickKeys(raw, DRIVE_BODY_KEYS)
  if ("focus" in body) body.focus = cleanFocus(body.focus)
  if (!("scope" in body)) return body

  const scope = cleanScope(body.scope)
  if (scope.libraries?.length) {
    const resolved = await resolveLibraryRefs(scope.libraries)
    if (!resolved) return unavailable()
    if (resolved.unknown.length > 0) {
      return invalidDrive([notFoundMessage(resolved.unknown)])
    }
    scope.libraries = resolved.ids
  }
  body.scope = scope

  return body
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

  const body =
    write.kind === "action"
      ? actionBody(parsed.body)
      : await driveBody(parsed.body)
  if (body instanceof Response) return body

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

/**
 * The builder's live counts: `{ scope, focus }` → `{ total, todo }`, counted
 * as the drive would be if it opened now. A pasted list's slugs are
 * resolved first, and any that aren't found come back as `unknown`.
 */
export async function previewDrive(req: Request): Promise<Response> {
  const gate = await boardGate(previewLimiter)
  if (gate.denied) return gate.denied

  const parsed = await readJsonCapped(req, MAX_DRIVE_BODY_BYTES)
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: parsed.status }
    )
  }
  const src = asRecord(parsed.body)
  const focus = gapsFocus(src.focus)
  if (!focus) {
    return invalidDrive(["Choose one to three gaps to fill."])
  }
  const scope = cleanScope(src.scope)
  if ((scope.libraries?.length ?? 0) > DRIVE_MAX_LIBRARIES) {
    return invalidDrive(["A list can hold at most 500 libraries."])
  }
  if (!scope.libraries?.length && !scope.places) {
    return invalidDrive([
      "Limit the drive to places or to a list of libraries.",
    ])
  }

  let unknown: string[] = []
  if (scope.libraries?.length) {
    const resolved = await resolveLibraryRefs(scope.libraries)
    if (!resolved) return unavailable()
    unknown = resolved.unknown
    if (resolved.ids.length === 0) {
      return NextResponse.json(
        { total: 0, todo: 0, unknown },
        { headers: { "Cache-Control": "no-store" } }
      )
    }
    scope.libraries = resolved.ids
  }

  const counts = await driveCounts({
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
    {
      total: counts.total,
      todo: counts.todo,
      ...(unknown.length ? { unknown } : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
