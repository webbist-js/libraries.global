/**
 * Pure helpers for Change Records: which attributes a content type tracks,
 * how a document version is normalised so two versions compare by content
 * (not by row ids or key order), and the field-level diff between them.
 */

type Attribute = { type?: string; [key: string]: unknown }

export interface TrackedAttributes {
  scalars: string[]
  relations: string[]
  components: string[]
  media: string[]
}

/** Canonical form: sorted keys, and null/undefined/"" collapsed to null. */
function canonical(v: unknown): unknown {
  if (v === null || v === undefined || v === "") return null
  if (v instanceof Date) return v.toISOString()
  if (Array.isArray(v)) return v.map(canonical)
  if (typeof v === "object") {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(v as object).sort())
      out[key] = canonical((v as Record<string, unknown>)[key])

    return out
  }

  return v
}

/** JSON with sorted keys; `null`, `undefined` and `""` all give "null". */
export function stableStringify(v: unknown): string {
  return JSON.stringify(canonical(v))
}

export function trackedAttributes(
  schema: { attributes: Record<string, any> },
  ignore: ReadonlySet<string>
): TrackedAttributes {
  const out: TrackedAttributes = {
    scalars: [],
    relations: [],
    components: [],
    media: [],
  }
  for (const [name, attr] of Object.entries(schema.attributes ?? {}) as [
    string,
    Attribute,
  ][]) {
    if (ignore.has(name)) continue
    switch (attr?.type) {
      case "relation":
        out.relations.push(name)
        break

      case "media":
        out.media.push(name)
        break

      case "component":
      case "dynamiczone":
        out.components.push(name)
        break

      default:
        out.scalars.push(name)
    }
  }

  return out
}

const asList = (v: unknown): unknown[] => {
  if (v === null || v === undefined) return []

  return Array.isArray(v) ? v : [v]
}

const sortIds = <T extends string | number>(ids: T[]): T[] =>
  [...ids].sort((a, b) =>
    typeof a === "number" && typeof b === "number"
      ? a - b
      : String(a).localeCompare(String(b))
  )

const relationId = (item: unknown): string | null => {
  if (typeof item === "string") return item
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>
    if (typeof o.documentId === "string") return o.documentId
    if (o.id !== undefined && o.id !== null) return String(o.id)
  }

  return null
}

const mediaId = (item: unknown): string | number | null => {
  if (typeof item === "number" || typeof item === "string") return item
  if (item && typeof item === "object") {
    const id = (item as Record<string, unknown>).id

    return typeof id === "number" || typeof id === "string" ? id : null
  }

  return null
}

/**
 * Component and dynamic-zone values without their row `id`s: Strapi gives
 * the published copy fresh component rows, so ids are not content.
 */
function stripComponentIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripComponentIds)
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
      if (key === "id") continue
      out[key] = stripComponentIds(value)
    }

    return out
  }

  return v
}

const cloneJson = (v: unknown): unknown =>
  v && typeof v === "object" ? structuredClone(v) : (v ?? null)

/**
 * The tracked fields of one version, in comparable form: relations become
 * sorted `documentId` arrays, media sorted file ids, components id-free
 * copies. Missing fields are `null` (or `[]` for relations and media).
 */
export function normaliseForDiff(
  doc: Record<string, unknown>,
  attrs: TrackedAttributes
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const f of attrs.scalars) out[f] = cloneJson(doc[f])
  for (const f of attrs.relations)
    out[f] = sortIds(
      asList(doc[f])
        .map(relationId)
        .filter((id): id is string => id !== null)
    )
  for (const f of attrs.media)
    out[f] = sortIds(
      asList(doc[f])
        .map(mediaId)
        .filter((id): id is string | number => id !== null)
    )
  for (const f of attrs.components)
    out[f] = doc[f] === undefined ? null : stripComponentIds(doc[f])

  return out
}

/**
 * Field-level differences between two normalised versions. With either side
 * missing, every field is listed (a first version or a removal).
 */
export function diffVersions(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  fields: readonly string[]
): { field: string; previous: unknown; next: unknown }[] {
  const changes: { field: string; previous: unknown; next: unknown }[] = []
  for (const field of fields) {
    const previous = before ? (before[field] ?? null) : null
    const next = after ? (after[field] ?? null) : null
    if (before && after && stableStringify(previous) === stableStringify(next))
      continue
    changes.push({ field, previous, next })
  }

  return changes
}
