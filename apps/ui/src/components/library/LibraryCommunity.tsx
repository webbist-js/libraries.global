import { useTranslations, type Locale } from "next-intl"
import { Suspense } from "react"

import { JournalArticleRow } from "@/components/blog/JournalCards"
import { DiscussionFeed } from "@/components/discussions/DiscussionFeed"
import GlobalLink from "@/components/global/GlobalLink"
import {
  LIB_ICONS,
  LibrarySectionCard,
} from "@/components/library/LibrarySectionCard"
import { fetchArticleBrowse } from "@/lib/article-discovery"
import { T } from "@/lib/design-tokens"

async function LibraryStories({
  id,
  locale,
  unavailable,
}: {
  readonly id: string
  readonly locale: Locale
  readonly unavailable: string
}) {
  const result = await fetchArticleBrowse(
    "blog",
    new URLSearchParams({
      library: id,
      origin: "all",
      preferredLocale: locale,
      pageSize: "3",
    }).toString()
  ).catch(() => null)
  if (!result)
    return (
      <p className="text-sm" style={{ color: T.ink.dim }}>
        {unavailable}
      </p>
    )

  return (
    <div className="mt-3 grid gap-3">
      {result.items.map((article) => (
        <JournalArticleRow
          key={`${article.documentId}:${article.locale}`}
          article={{ ...article, readMinutes: article.readingTimeMinutes }}
          locale={locale}
        />
      ))}
    </div>
  )
}

export function LibraryCommunity({
  id,
  locale,
  contentLocale,
}: {
  readonly id: string
  readonly locale: Locale
  readonly contentLocale: string
}) {
  const t = useTranslations("libraryPage")
  const discovery = useTranslations("discovery")

  return (
    <LibrarySectionCard
      id="community"
      title={t("community")}
      iconPath={LIB_ICONS.people}
    >
      <div
        className="mb-6 border-b pb-5"
        style={{ borderColor: T.border.line }}
      >
        <h3 className="m-0 text-base font-semibold">{t("stories")}</h3>
        <p className="mt-2 text-sm" style={{ color: T.ink.dim }}>
          {t("storiesIntro")}
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          <GlobalLink
            className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
            href={`/contribute/knowledge/new?type=journal&library=${encodeURIComponent(id)}`}
          >
            {discovery("writeLibrary")}
          </GlobalLink>
          <GlobalLink
            className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4"
            href={`/journal?origin=all&library=${encodeURIComponent(id)}`}
          >
            {discovery("readLibrary")}
          </GlobalLink>
        </div>
        <Suspense
          fallback={
            <p className="text-sm" role="status">
              {t("loadingStories")}
            </p>
          }
        >
          <LibraryStories
            id={id}
            locale={locale}
            unavailable={t("storiesUnavailable")}
          />
        </Suspense>
      </div>
      <DiscussionFeed
        target={{
          uid: "api::library.library",
          documentId: id,
          locale: contentLocale,
        }}
        subjectSlug="library-life"
        compact
      />
    </LibrarySectionCard>
  )
}
