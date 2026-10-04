import { nameHits } from "./match"
import type { ExistingPlace, SourcePlace } from "./types"

export type ChildAction =
  | {
      kind: "match"
      source: SourcePlace
      existing: ExistingPlace
      /** Ids to write onto the existing place, only where it has none. */
      fill: { geonamesId?: string; gssCode?: string }
    }
  | { kind: "create"; source: SourcePlace }
  | {
      kind: "not-added"
      source: SourcePlace
      reason: "parent-has-places"
    }

export interface ChildPlan {
  actions: ChildAction[]
  /** Existing places no source place matched (for the report). */
  unmatchedExisting: ExistingPlace[]
  /**
   * Sources whose name matched more than one existing place, or whose only
   * name hit was also hit by another source. Never matched, never filled.
   */
  ambiguous: SourcePlace[]
}

const fillOf = (
  source: SourcePlace,
  existing: ExistingPlace
): { geonamesId?: string; gssCode?: string } => {
  const fill: { geonamesId?: string; gssCode?: string } = {}
  if (source.geonamesId && !existing.geonamesId)
    fill.geonamesId = source.geonamesId
  if (source.gssCode && !existing.gssCode) fill.gssCode = source.gssCode

  return fill
}

/**
 * What to do with one parent's source places: a Country's Regions or a
 * Region's Areas (spec §6.3). Matching is id-first and never ambiguous
 * (spec §6.5): every source with a `geonamesId` or `gssCode` is paired with
 * the existing place that carries it first, before any name is compared.
 * Only then are the rest matched by name — and only when a source has
 * exactly one name hit among what's left, and no other remaining source
 * also hits that place; otherwise the source is ambiguous and matches
 * nothing. A parent with no places gets every source; one with places only
 * gets the rest (unmatched or ambiguous) when `fill` is set. The outcome
 * for each source doesn't depend on the order of `sources`.
 */
export function planChildren(input: {
  sources: readonly SourcePlace[]
  existing: readonly ExistingPlace[]
  fill: boolean
  typeWords?: readonly string[]
  aliases?: Record<string, string>
}): ChildPlan {
  const used = new Set<string>()
  const empty = input.existing.length === 0

  // Pass 1: ids first. One id names at most one existing place, so this is
  // never ambiguous and never depends on another source's order.
  const idMatch: (ExistingPlace | null)[] = input.sources.map((source) => {
    if (!source.geonamesId && !source.gssCode) return null
    const hit = input.existing.find(
      (e) =>
        !used.has(e.documentId) &&
        ((!!source.geonamesId && e.geonamesId === source.geonamesId) ||
          (!!source.gssCode && e.gssCode === source.gssCode))
    )
    if (hit) used.add(hit.documentId)

    return hit ?? null
  })

  // Pass 2: name matching among what's left (spec §6.5), with every
  // remaining source's hits gathered before any decision is made, so the
  // result can't depend on the order sources are considered in.
  const remaining = input.existing.filter((e) => !used.has(e.documentId))
  const hitsOf: (ExistingPlace[] | null)[] = input.sources.map((source, i) =>
    idMatch[i]
      ? null
      : nameHits(source, remaining, {
          typeWords: input.typeWords,
          aliases: input.aliases,
        })
  )
  const hitCount = new Map<string, number>()
  for (const hits of hitsOf)
    for (const e of hits ?? [])
      hitCount.set(e.documentId, (hitCount.get(e.documentId) ?? 0) + 1)

  const actions: ChildAction[] = []
  const ambiguous: SourcePlace[] = []

  input.sources.forEach((source, i) => {
    const idHit = idMatch[i]
    if (idHit) {
      actions.push({
        kind: "match",
        source,
        existing: idHit,
        fill: fillOf(source, idHit),
      })

      return
    }

    const hits = hitsOf[i]!
    const nameHit =
      hits.length === 1 && hitCount.get(hits[0]!.documentId) === 1
        ? hits[0]!
        : null
    if (nameHit) {
      used.add(nameHit.documentId)
      actions.push({
        kind: "match",
        source,
        existing: nameHit,
        fill: fillOf(source, nameHit),
      })

      return
    }

    if (hits.length > 0) ambiguous.push(source)

    actions.push(
      empty || input.fill
        ? { kind: "create", source }
        : { kind: "not-added", source, reason: "parent-has-places" }
    )
  })

  return {
    actions,
    unmatchedExisting: input.existing.filter((e) => !used.has(e.documentId)),
    ambiguous,
  }
}
