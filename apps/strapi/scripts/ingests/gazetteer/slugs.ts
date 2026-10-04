import { slugify } from "../_shared/text"

export interface SlugRequest {
  /** Unique within the run. */
  id: string
  name: string
  /** Added when the base slug is shared: the country code (Regions) or the Region's slug (Areas). */
  suffix: string
  /** Add the suffix even when nothing clashes (US Areas, as the IMLS ingest does). */
  alwaysSuffix?: boolean
  /** Added last when the suffixed slug still clashes (a GeoNames id or GSS code). */
  tieBreak: string
}

/**
 * Slugs for the places a run creates (spec §6.7). Region and Area pages are
 * found by slug alone, so a slug is unique across its type. A base slug that
 * two planned places share, or that is already taken, gets the suffix on
 * every planned place that has it (an empty suffix adds nothing); existing
 * slugs never change. A tie-break still clashing — with another planned
 * slug or with `taken` — is made unique by numbering the colliding ids
 * `-2`, `-3`… in a fixed (sorted) order. The result doesn't depend on the
 * order of `requests`.
 */
export function planSlugs(
  requests: readonly SlugRequest[],
  taken: ReadonlySet<string>
): Map<string, string> {
  const tally = (slugs: Iterable<string>) => {
    const n = new Map<string, number>()
    for (const s of slugs) n.set(s, (n.get(s) ?? 0) + 1)

    return n
  }
  const base = new Map(requests.map((r) => [r.id, slugify(r.name) || "place"]))
  const baseCount = tally(base.values())
  const first = new Map(
    requests.map((r) => {
      const b = base.get(r.id)!
      const shared = (baseCount.get(b) ?? 0) > 1 || taken.has(b)
      const suffix = slugify(r.suffix)
      const withSuffix = suffix ? `${b}-${suffix}` : b

      return [r.id, r.alwaysSuffix || shared ? withSuffix : b]
    })
  )
  const firstCount = tally(first.values())
  const second = new Map(
    requests.map((r) => {
      const s = first.get(r.id)!
      const clash = (firstCount.get(s) ?? 0) > 1 || taken.has(s)

      return [r.id, clash ? `${s}-${slugify(r.tieBreak)}` : s]
    })
  )

  // Final guarantee: unique against `taken` and within this call. Group by
  // the slug every request has reached, then — processing colliding ids in
  // a fixed, sorted order so the result can't depend on input order —
  // number every id past the first `-2`, `-3`…
  const byValue = new Map<string, string[]>()
  for (const r of requests) {
    const v = second.get(r.id)!
    byValue.set(v, [...(byValue.get(v) ?? []), r.id])
  }
  const claimed = new Set(taken)
  const final = new Map<string, string>()
  for (const [value, ids] of byValue) {
    for (const id of [...ids].sort()) {
      let candidate = value
      let n = 2
      while (claimed.has(candidate)) {
        candidate = `${value}-${n}`
        n += 1
      }
      claimed.add(candidate)
      final.set(id, candidate)
    }
  }

  return new Map(requests.map((r) => [r.id, final.get(r.id)!]))
}
