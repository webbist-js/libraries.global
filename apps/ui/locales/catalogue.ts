/**
 * Message catalogues are stored as one JSON file per feature under
 * `locales/<locale>/`. Each file owns whole namespaces (or, for `staticUi`,
 * whole sub-namespaces), so merging never overwrites a message.
 *
 * Storage is for maintenance only. What reaches the browser is decided by the
 * generated client scopes in `src/i18n/client-scopes.generated.json`.
 */

/** Feature files, in merge order. Every locale has exactly these files. */
export const CATALOGUE_FILES = [
  "common",
  "home",
  "about",
  "auth",
  "beta",
  "contact",
  "atlas",
  "places",
  "libraries",
  "networks",
  "mobile",
  "events",
  "articles",
  "contribute",
  "community",
  "moderation",
  "profile",
  "membership",
  "staff",
  "developers",
  "widgets",
  "widget-public",
] as const

type Intersect<T extends readonly unknown[]> = T extends readonly [
  infer Head,
  ...infer Rest,
]
  ? Head & Intersect<Rest>
  : unknown

type Tree = { [key: string]: string | Tree }

function mergeInto(target: Tree, source: Tree, path: string) {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key]
    if (existing === undefined) target[key] = value
    else if (typeof existing === "object" && typeof value === "object") {
      const copy = { ...existing }
      target[key] = copy
      mergeInto(copy, value, path ? `${path}.${key}` : key)
    } else
      throw new Error(
        `Message "${path ? `${path}.` : ""}${key}" is defined in more than one catalogue file.`
      )
  }
}

/** Merge feature files into one catalogue, failing on overlapping messages. */
export function mergeCatalogue<const T extends readonly object[]>(
  ...parts: T
): Intersect<T> {
  const result: Tree = {}
  for (const part of parts) mergeInto(result, part as Tree, "")

  return result as Intersect<T>
}
