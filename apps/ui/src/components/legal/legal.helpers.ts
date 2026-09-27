/** Pure helpers for the /legal/[slug] documents. */

export const LEGAL_CONTACT_EMAIL = "legal@libraries.global"
export const LEGAL_FORUM_URL =
  "https://github.com/libraries-global/libraries.global/discussions"
/** The Contributor Covenant lives in the repo, not in the CMS. */
export const CODE_OF_CONDUCT_URL =
  "https://github.com/libraries-global/libraries.global/blob/main/CODE_OF_CONDUCT.md"

/** Tab icons by slug; documents added later in the CMS get the default. */
const LEGAL_ICONS: Record<string, string> = {
  terms: "mdi:file-document-outline",
  privacy: "mdi:shield-outline",
  "data-licence": "mdi:web",
  cookies: "mdi:cookie-outline",
}

export function legalIcon(slug?: string | null): string {
  return (slug && LEGAL_ICONS[slug]) || "mdi:file-document-outline"
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replaceAll(/['’]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

/** Stable, unique in-page anchors for each section, derived from its heading. */
export function sectionAnchors(sections: readonly { heading: string }[]) {
  const seen = new Map<string, number>()

  return sections.map((section, index) => {
    const base = slugify(section.heading) || `section-${index + 1}`
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)

    return count === 1 ? base : `${base}-${count}`
  })
}

/** "01", "02" … the section's display number. */
export function sectionNumber(index: number): string {
  return String(index + 1).padStart(2, "0")
}

export function revisionsNewestFirst<T extends { date: string }>(
  revisions?: readonly T[] | null
): T[] {
  return [...(revisions ?? [])].sort((a, b) => b.date.localeCompare(a.date))
}

export function formatVersion(version: string): string {
  const trimmed = version.trim()

  return /^v/i.test(trimmed) ? trimmed : `v${trimmed}`
}

/**
 * Revision dates are date-only strings; format them in UTC so a server west
 * of Greenwich doesn't render "1 Sep" as "31 Aug".
 */
export function formatLegalDate(
  date?: string | null,
  month: "long" | "short" = "long"
): string | null {
  if (!date) return null
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return null

  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month,
    year: "numeric",
    timeZone: "UTC",
  })
}

function countWords(text?: string | null): number {
  return text ? text.split(/\s+/).filter(Boolean).length : 0
}

/** Words in the text nodes of Strapi blocks JSON (ignores URLs and node types). */
function blocksWordCount(nodes: unknown): number {
  if (!Array.isArray(nodes)) return 0

  return nodes.reduce<number>((total, node) => {
    if (typeof node !== "object" || node === null) return total
    const { text, children } = node as { text?: unknown; children?: unknown }

    return (
      total +
      (typeof text === "string" ? countWords(text) : 0) +
      blocksWordCount(children)
    )
  }, 0)
}

export function legalReadingMinutes(doc: {
  lead?: string | null
  summaryPoints?: readonly { text: string }[] | null
  sections?:
    | readonly {
        inShort?: string | null
        body?: unknown
      }[]
    | null
}): number {
  const words =
    countWords(doc.lead) +
    (doc.summaryPoints ?? []).reduce((n, p) => n + countWords(p.text), 0) +
    (doc.sections ?? []).reduce(
      (n, s) => n + countWords(s.inShort) + blocksWordCount(s.body),
      0
    )

  return Math.max(1, Math.round(words / 200))
}
