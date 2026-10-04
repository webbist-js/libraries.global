/** Shared types for the world place import. Pure: no I/O. */

/** A place read from a source file (GeoNames or a curated list). */
export interface SourcePlace {
  /** Unique within the run: "geonames:2657895", "gss:E06000034", "curated:essex". */
  sourceId: string
  geonamesId?: string
  gssCode?: string
  name: string
  /** Other spellings to match existing places on. */
  altNames: string[]
  /** What Areas use to find this place as their Region (a GeoNames admin1 code, or a curated key). */
  key: string
  /** Areas only: the `key` of their Region. */
  parentKey?: string
  /** A per-place type label (curated sources only). */
  typeLabel?: string
  /** GeoNames admin1 code of the place's Region (the US Area slug suffix). */
  admin1?: string
}

/** A Region or Area already in Strapi. */
export interface ExistingPlace {
  documentId: string
  name: string
  slug: string
  geonamesId?: string | null
  gssCode?: string | null
}
