import { useLocale, useTranslations as useUiTranslations } from "next-intl"

import { ArticleDiscoveryFilters } from "@/components/articles/ArticleDiscoveryFilters"
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
import { JournalListControls } from "./JournalListControls"
import { JournalPagination } from "./JournalPagination"
import { JournalHeading } from "./JournalSectionBrowser"

function ArticleResults({
  list,
  query,
  linkLocale,
}: Pick<JournalLandingData, "list" | "query" | "total" | "linkLocale">) {
  const t = useUiTranslations("editorial")
  const p = useUiTranslations("publishing")
  if (list.items.length === 0) {
    const pastTheEnd = list.total > 0
    const message = pastTheEnd ? t("emptyPage") : p("noResults")

    return (
      <EmptyState
        message={message}
        icon="mdi:newspaper-variant-outline"
        action={
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
    <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
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
          <JournalHeading id="journal-all">
            {tDiscovery(journalCollectionKey(discovery.appliedFilters.origins))}
          </JournalHeading>
          <p
            aria-live="polite"
            className="m-0 mt-1 text-[14px]"
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
        <JournalListControls lang={lang} languages={languages} query={query} />
      </div>

      {fallbackFrom ? (
        <p className="m-0 mt-3 text-[14px]" style={{ color: T.ink.dim }}>
          {t("journalFallback", {
            requested: languageName(fallbackFrom, languages, locale),
            language: languageName(lang, languages, locale),
          })}
        </p>
      ) : null}

      <ArticleDiscoveryFilters
        discovery={{
          ...discovery,
          facets: {
            ...discovery.facets,
            sections: discovery.facets.sections.map((facet) => ({
              ...facet,
              label:
                sections.find(
                  (section) =>
                    section.slug === facet.value || section.slug === facet.slug
                )?.name ?? facet.label,
            })),
          },
        }}
        kind="journal"
      />

      <div className="mt-6">
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
