import { useLocale, useTranslations as useUiTranslations } from "next-intl"

import { EmptyState } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { JournalLandingData } from "@/lib/journal-landing"
import { languageName } from "@/lib/locale-fallback"

import { JournalArticleCard, JournalArticleRow } from "./JournalCards"
import {
  JOURNAL_PAGE_SIZE,
  journalHref,
  journalCollectionKey,
} from "./journalLanding.helpers"
import { JournalPagination } from "./JournalPagination"

function ArticleResults({
  list,
  query,
  linkLocale,
}: Pick<JournalLandingData, "list" | "query" | "total" | "linkLocale">) {
  const t = useUiTranslations("editorial")
  const p = useUiTranslations("publishing")
  const d = useUiTranslations("discovery")
  if (list.items.length === 0) {
    const pastTheEnd = list.total > 0
    const message = pastTheEnd ? t("emptyPage") : p("noResults")

    return (
      <EmptyState
        message={message}
        icon="mdi:newspaper-variant-outline"
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <GlobalLink
              href={journalHref(
                query,
                pastTheEnd
                  ? { page: 1 }
                  : {
                      q: undefined,
                      section: null,
                      lang: "all",
                      filters: { origins: query.filters?.origins },
                      page: 1,
                    }
              )}
              className="min-h-11 rounded-full border border-(--t-border-hi) px-5 py-2.5 font-semibold text-(--t-accent-primary)"
            >
              {pastTheEnd ? t("firstPage") : p("resetSearch")}
            </GlobalLink>
            {!pastTheEnd && query.filters?.origins?.length ? (
              <GlobalLink
                href={journalHref(query, {
                  q: undefined,
                  section: null,
                  lang: "all",
                  filters: {},
                  allOrigins: true,
                  page: 1,
                })}
                className="inline-flex min-h-11 items-center rounded-full bg-(--t-bg-inverse) px-5 py-2.5 font-semibold text-white"
              >
                {d("allStories")}
              </GlobalLink>
            ) : null}
          </div>
        }
      />
    )
  }

  if (query.view === "list") {
    return (
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {list.items.map((article) => (
          <li key={`${article.documentId}:${article.locale}`}>
            <JournalArticleRow article={article} locale={linkLocale} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {list.items.map((article) => (
        <li key={`${article.documentId}:${article.locale}`}>
          <JournalArticleCard article={article} locale={linkLocale} />
        </li>
      ))}
    </ul>
  )
}

/** "All articles": count, language/sort/layout controls, section chips, list, pages. */
export function JournalAllArticles({
  query,
  list,
  sections,
  total,
  lang,
  languages,
  linkLocale,
  fallbackFrom,
  discovery,
}: Pick<
  JournalLandingData,
  | "query"
  | "list"
  | "sections"
  | "total"
  | "lang"
  | "languages"
  | "linkLocale"
  | "fallbackFrom"
  | "discovery"
>) {
  const t = useUiTranslations("editorial")

  const locale = useLocale()
  const tDiscovery = useUiTranslations("discovery")
  const activeSection = sections.find((s) => s.slug === query.section)

  return (
    <section
      aria-labelledby="journal-all"
      className="min-w-0 scroll-mt-24"
      id="all-articles"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="journal-all" className="type-small-heading m-0">
            {tDiscovery(journalCollectionKey(discovery.appliedFilters.origins))}
          </h2>
          <p
            aria-live="polite"
            className="m-0 mt-1 text-xs"
            style={{ color: T.ink.dim }}
          >
            {activeSection
              ? t("articlesInSection", {
                  articles: t("articleCount", { count: list.total }),
                  section: activeSection.name,
                })
              : t("articleCount", { count: list.total })}
          </p>
        </div>
      </div>

      {fallbackFrom ? (
        <p className="m-0 mt-3 text-sm" style={{ color: T.ink.dim }}>
          {t("journalFallback", {
            requested: languageName(fallbackFrom, languages, locale),
            language: languageName(lang, languages, locale),
          })}
        </p>
      ) : null}

      <div className="mt-4">
        <ArticleResults
          linkLocale={linkLocale}
          list={list}
          query={query}
          total={total}
        />
      </div>

      {list.total > 0 ? (
        <JournalPagination
          page={list.page}
          pageCount={list.pageCount}
          pageSize={JOURNAL_PAGE_SIZE}
          query={query}
          total={list.total}
        />
      ) : null}
    </section>
  )
}
