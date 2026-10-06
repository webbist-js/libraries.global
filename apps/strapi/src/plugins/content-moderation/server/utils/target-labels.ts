import { summaryOf } from "./submission-summary"

/**
 * A readable name for what a submission is about, for the submitter's own
 * list (`/submissions/my`) and the public one on their profile: the
 * library's name rather than its slug, an article's title rather than its
 * slug, and the same one-line summaries the moderation queue uses for
 * applications.
 */

export type LabelSource = {
  submissionType: string
  targetSlug?: string | null
  fields?: Record<string, unknown> | null
  draftData?: Record<string, unknown> | null
}

/** Names found for the targets, by slug. */
export type TargetNames = {
  library: Map<string, string>
  wiki: Map<string, string>
  blog: Map<string, string>
}

const str = (v: unknown) =>
  typeof v === "string" && v.trim() ? v.trim() : null

const titleCase = (slug: string) =>
  slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

export function targetLabelOf(
  row: LabelSource,
  names: TargetNames
): string | null {
  const f = row.fields ?? {}
  const d = row.draftData ?? {}
  const slug = row.targetSlug ?? null

  switch (row.submissionType) {
    case "new_library":
    case "topic_suggestion":
      return str(f.name) ?? slug
    case "library_edit":
    case "correction":
    case "event_feed":
      return (slug ? names.library.get(slug) : null) ?? slug
    case "library_claim":
      return str(f.libraryName) ?? str(f.name) ?? str(f.entityRef) ?? slug
    case "wiki_edit":
    case "blog_submission": {
      const titles =
        row.submissionType === "wiki_edit" ? names.wiki : names.blog

      return (
        str(d.title) ??
        str(d.proposedTitle) ??
        str(f.title) ??
        (slug ? (titles.get(slug) ?? titleCase(slug)) : null)
      )
    }
    case "role_application":
      return summaryOf(row)

    default:
      return slug
  }
}

const LOOKUPS = [
  {
    key: "library",
    uid: "api::library.library",
    field: "name",
    types: ["library_edit", "correction", "event_feed"],
  },
  {
    key: "wiki",
    uid: "api::wiki-article.wiki-article",
    field: "title",
    types: ["wiki_edit"],
  },
  {
    key: "blog",
    uid: "api::blog-article.blog-article",
    field: "title",
    types: ["blog_submission"],
  },
] as const

/**
 * One query per kind of target, for just the slugs in `rows`. A failed
 * lookup leaves that kind to fall back to slugs.
 */
async function loadTargetNames(
  strapi: any,
  rows: readonly LabelSource[]
): Promise<TargetNames> {
  const names: TargetNames = {
    library: new Map(),
    wiki: new Map(),
    blog: new Map(),
  }
  await Promise.all(
    LOOKUPS.map(async ({ key, uid, field, types }) => {
      const slugs = [
        ...new Set(
          rows.flatMap((r) =>
            (types as readonly string[]).includes(r.submissionType) &&
            r.targetSlug
              ? [r.targetSlug]
              : []
          )
        ),
      ]
      if (slugs.length === 0) return
      try {
        // Every locale and version: the name is all that's read, and a
        // draft-only record still has one.
        const found = (await strapi.db.query(uid).findMany({
          where: { slug: { $in: slugs } },
          select: ["slug", field],
        })) as Record<string, unknown>[]
        for (const row of found) {
          const slug = str(row.slug)
          const name = str(row[field])
          if (slug && name && !names[key].has(slug)) names[key].set(slug, name)
        }
      } catch {
        // Non-fatal: these rows show their slugs.
      }
    })
  )

  return names
}

/** `rows`, each with its `targetLabel`. */
export async function withTargetLabels<T extends LabelSource>(
  strapi: any,
  rows: readonly T[]
): Promise<(T & { targetLabel: string | null })[]> {
  const names = await loadTargetNames(strapi, rows)

  return rows.map((row) => ({ ...row, targetLabel: targetLabelOf(row, names) }))
}
