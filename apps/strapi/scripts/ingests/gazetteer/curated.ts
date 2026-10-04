import type { SourcePlace } from "./types"

/** A curated place list (`data/<file>.json`): Regions with their Areas. */
export interface CuratedList {
  /** The dataset key in `src/seeds/datasets.ts`, e.g. "ons-lad". */
  source: string
  /** Stored as each place's `sourceAttribution`. */
  attribution: string
  regions: {
    key: string
    name: string
    typeLabel?: string
    areas: { gssCode: string; name: string; typeLabel: string }[]
  }[]
}

export function curatedPlaces(list: CuratedList): {
  regions: SourcePlace[]
  areas: SourcePlace[]
} {
  return {
    regions: list.regions.map((r) => ({
      sourceId: `curated:${r.key}`,
      name: r.name,
      altNames: [],
      key: r.key,
      ...(r.typeLabel ? { typeLabel: r.typeLabel } : {}),
    })),
    areas: list.regions.flatMap((r) =>
      r.areas.map((a) => ({
        sourceId: `gss:${a.gssCode}`,
        gssCode: a.gssCode,
        name: a.name,
        altNames: [],
        key: a.gssCode,
        parentKey: r.key,
        typeLabel: a.typeLabel,
      }))
    ),
  }
}
