/**
 * Links that open the drive builder with something already chosen: the
 * Noticeboard's gap rows, location pages and Find libraries all point at
 * `/community/propose` with a prefill in its query, and the board's
 * `/community/drives/new` reads the same parameters. Pure, so the server
 * pages and client links share one reading of the URL.
 *
 * The Focus: `focus=verify&sections=hours,status&before=YYYY-MM-DD` (confirm
 * sections not checked since a day) or `focus=record&target=75` (complete
 * whole records). With no `focus`, or `focus=gaps`, `gaps=` applies.
 */
import {
  DRIVE_PLACE_LEVELS,
  type DrivePlaceLevel,
  type GapKey,
  isGapKey,
  PANEL_GAPS,
  VERIFY_SECTIONS,
  type VerifySection,
} from "@repo/shared-data"

import {
  type FindState,
  TYPE_GROUPS,
} from "@/components/index-page/find-helpers"

/** A verify or whole-record Focus; a gaps Focus is `gaps`. */
export type PrefillFocus =
  | { kind: "verify"; sections: VerifySection[]; before: string }
  | { kind: "record"; target: number }

export interface ProposePrefill {
  /** `before` is `YYYY-MM-DD`. */
  focus?: PrefillFocus
  gaps?: GapKey[]
  places?: Partial<Record<DrivePlaceLevel, string[]>>
  libraryTypes?: string[]
  source?: string | null
  completenessBelow?: number | null
}

/** The contributor's builder. */
export const PROPOSE_PATH = "/community/propose"

/** A proposal's Focus holds at most this many gaps. */
const MAX_GAPS = 3
/** Places per level, and library types, a link may carry. */
const MAX_PLACES = 20
const MAX_TYPES = 20
const SOURCE_MAX = 80

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TYPE = /^[A-Za-z ]{1,40}$/
const PERCENT = /^\d{1,3}$/
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** A whole-record target's bounds, as `validateDrive` checks them. */
const TARGET_MIN = 50
const TARGET_MAX = 100

const isVerifySection = (v: unknown): v is VerifySection =>
  typeof v === "string" && (VERIFY_SECTIONS as readonly string[]).includes(v)

const isDay = (v: string) =>
  DAY.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`))

const isPanelGap = (v: unknown): v is GapKey =>
  isGapKey(v) && (PANEL_GAPS as readonly string[]).includes(v)

const unique = <V>(values: readonly V[]) => [...new Set(values)]

/** "a,b" with each piece encoded; commas stay readable. */
const joined = (values: readonly string[]) =>
  values.map((v) => encodeURIComponent(v)).join(",")

/** The Focus keys: `focus`, then `sections` and `before`, or `target`. */
function focusParts(focus: PrefillFocus): string[] {
  if (focus.kind === "verify") {
    return [
      "focus=verify",
      `sections=${joined(focus.sections)}`,
      `before=${encodeURIComponent(focus.before)}`,
    ]
  }

  return ["focus=record", `target=${focus.target}`]
}

/**
 * The prefill as a query string ("?gaps=hours&region=ohio", or "" when
 * nothing is set): only the keys that are set, in a fixed order. A verify
 * or whole-record Focus comes first and leaves `gaps` out.
 */
export function prefillQuery(p: ProposePrefill = {}): string {
  const parts: string[] = []
  if (p.focus) parts.push(...focusParts(p.focus))
  else if (p.gaps?.length) parts.push(`gaps=${joined(p.gaps)}`)
  for (const level of DRIVE_PLACE_LEVELS) {
    const slugs = p.places?.[level]
    if (slugs?.length) parts.push(`${level}=${joined(slugs)}`)
  }
  if (p.libraryTypes?.length) parts.push(`types=${joined(p.libraryTypes)}`)
  const source = p.source?.trim()
  if (source) parts.push(`source=${encodeURIComponent(source)}`)
  if (p.completenessBelow != null) {
    parts.push(`below=${p.completenessBelow}`)
  }

  return parts.length > 0 ? `?${parts.join("&")}` : ""
}

/** "/community/propose?gaps=hours&region=ohio": only the keys that are set, in this order. */
export function proposeHref(p?: ProposePrefill): string {
  return `${PROPOSE_PATH}${prefillQuery(p)}`
}

type Params = URLSearchParams | Record<string, string | string[] | undefined>

/** Every value given for `key`, as one comma list ("" when there's none). */
function paramOf(sp: Params, key: string): string {
  if (sp instanceof URLSearchParams) return sp.getAll(key).join(",")
  const v = sp[key]

  return Array.isArray(v) ? v.join(",") : (v ?? "")
}

/** The first value given for `key`, trimmed ("" when there's none). */
function firstOf(sp: Params, key: string): string {
  if (sp instanceof URLSearchParams) return sp.get(key)?.trim() ?? ""
  const v = sp[key]

  return ((Array.isArray(v) ? v[0] : v) ?? "").trim()
}

/** A comma list's pieces, trimmed, without blanks or repeats. */
const listOf = (raw: string) =>
  unique(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  )

/**
 * A verify Focus (one or more known sections and a `YYYY-MM-DD` day) or a
 * whole-record one (a target from 50 to 100), or null when `focus` asks for
 * neither or its values are malformed.
 */
function focusFromParams(sp: Params): PrefillFocus | null {
  const kind = firstOf(sp, "focus")
  if (kind === "verify") {
    const sections = listOf(paramOf(sp, "sections")).filter(isVerifySection)
    const before = firstOf(sp, "before")

    return sections.length > 0 && isDay(before)
      ? { kind: "verify", sections, before }
      : null
  }
  if (kind === "record") {
    const target = firstOf(sp, "target")
    const n = PERCENT.test(target) ? Number(target) : Number.NaN

    return n >= TARGET_MIN && n <= TARGET_MAX
      ? { kind: "record", target: n }
      : null
  }

  return null
}

/** The panel gaps (at most 3) when there's no `focus`, or it's `gaps`; else none. */
function gapsFromParams(sp: Params): GapKey[] {
  const kind = firstOf(sp, "focus")
  if (kind === "verify" || kind === "record") return []

  return listOf(paramOf(sp, "gaps")).filter(isPanelGap).slice(0, MAX_GAPS)
}

/** The prefill from a page's search params. Unknown or malformed values are dropped. */
export function prefillFromParams(sp: Params): ProposePrefill {
  const prefill: ProposePrefill = {}

  const focus = focusFromParams(sp)
  if (focus) prefill.focus = focus
  const gaps = gapsFromParams(sp)
  if (gaps.length > 0) prefill.gaps = gaps

  const places: Partial<Record<DrivePlaceLevel, string[]>> = {}
  for (const level of DRIVE_PLACE_LEVELS) {
    const slugs = listOf(paramOf(sp, level))
      .filter((s) => SLUG.test(s) && s.length <= 120)
      .slice(0, MAX_PLACES)
    if (slugs.length > 0) places[level] = slugs
  }
  if (Object.keys(places).length > 0) prefill.places = places

  const types = listOf(paramOf(sp, "types"))
    .filter((t) => TYPE.test(t))
    .slice(0, MAX_TYPES)
  if (types.length > 0) prefill.libraryTypes = types

  const source = firstOf(sp, "source")
  if (source && source.length <= SOURCE_MAX) prefill.source = source

  const below = firstOf(sp, "below")
  if (PERCENT.test(below)) {
    const n = Number(below)
    if (n >= 1 && n <= 100) prefill.completenessBelow = n
  }

  return prefill
}

/** Find libraries' state as a prefill: its place, its needs that the panel can fill (at most 3), its type groups' types and its source. */
export function prefillFromFindState(state: FindState): ProposePrefill {
  const prefill: ProposePrefill = {}

  if (state.place) {
    prefill.places = { [state.place.level]: [state.place.slug] }
  }

  const gaps = unique(state.needs.filter(isPanelGap)).slice(0, MAX_GAPS)
  if (gaps.length > 0) prefill.gaps = gaps

  const types = unique(
    state.groups.flatMap(
      (key) => TYPE_GROUPS.find((g) => g.key === key)?.types ?? []
    )
  )
  if (types.length > 0) prefill.libraryTypes = types

  const source = state.source?.trim()
  if (source && source.length <= SOURCE_MAX) prefill.source = source

  return prefill
}
