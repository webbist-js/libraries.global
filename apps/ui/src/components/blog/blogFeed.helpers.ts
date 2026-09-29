import type { BlogArticleSummary } from "@/lib/strapi-api/content/server"

/** Below this many articles the feed adds the "More to come" invitation. */
export const YOUNG_JOURNAL_THRESHOLD = 4

export type FeedLayout = {
  /** Articles for the list, minus the one already shown as the featured card. */
  listed: BlogArticleSummary[]
  /** Render the list section (including its empty state for a filtered tab). */
  showList: boolean
  /** Render the "More to come" invitation after the articles. */
  showMoreToCome: boolean
}

export function buildFeedLayout({
  processedArticles,
  featured,
  activeSection,
  totalArticles,
}: {
  processedArticles: BlogArticleSummary[]
  featured: BlogArticleSummary | null
  activeSection: string
  totalArticles: number
}): FeedLayout {
  const listed = featured
    ? processedArticles.filter((a) => a.documentId !== featured.documentId)
    : processedArticles

  const onAllTab = activeSection === "All"
  const showMoreToCome = onAllTab && totalArticles < YOUNG_JOURNAL_THRESHOLD

  // On a filtered tab the list stays so its empty state can explain the
  // absence; on "All" an empty list would only duplicate the featured card.
  const showList = listed.length > 0 || !onAllTab

  return { listed, showList, showMoreToCome }
}
