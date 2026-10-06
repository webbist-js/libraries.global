/**
 * Links that open the drive builder with something already chosen: the
 * Noticeboard's gap rows, location pages and Find libraries all point at
 * `/community/propose` with a prefill in its query, and the board's
 * `/community/drives/new` reads the same parameters. Pure, so the server
 * pages and client links share one reading of the URL.
 */
import {
  DRIVE_PLACE_LEVELS,
  type DrivePlaceLevel,
  type GapKey,
  isGapKey,
  PANEL_GAPS,
} from "@repo/shared-data"

import {
  type FindState,
  TYPE_GROUPS,
} from "@/components/index-page/find-helpers"

export interface ProposePrefill {
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

const isPanelGap = (v: unknown): v is GapKey =>
  isGapKey(v) && (PANEL_GAPS as readonly string[]).includes(v)

const unique = <V>(values: readonly V[]) => [...new Set(values)]

/** "a,b" with each piece encoded; commas stay readable. */
const joined = (values: readonly string[]) =>
  values.map((v) => encodeURIComponent(v)).join(",")

/**
 * The prefill as a query string ("?gaps=hours&region=ohio", or "" when
 * nothing is set): only the keys that are set, in a fixed order.
 */
export function prefillQuery(p: ProposePrefill = {}): string {
  const parts: string[] = []
  if (p.gaps?.length) parts.push(`gaps=${joined(p.gaps)}`)
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

/** The prefill from a page's search params. Unknown or malformed values are dropped. */
export function prefillFromParams(sp: Params): ProposePrefill {
  const prefill: ProposePrefill = {}

  const gaps = listOf(paramOf(sp, "gaps")).filter(isPanelGap).slice(0, MAX_GAPS)
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
