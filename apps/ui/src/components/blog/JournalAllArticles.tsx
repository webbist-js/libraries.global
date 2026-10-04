import { Icon } from "@iconify/react"

import { EmptyState } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { JournalLandingData } from "@/lib/journal-landing"
import { languageName } from "@/lib/locale-fallback"
import { Link } from "@/lib/navigation"

import { JournalArticleCard, JournalArticleRow } from "./JournalCards"
import {
  JOURNAL_PAGE_SIZE,
  journalHref,
  type JournalQuery,
} from "./journalLanding.helpers"
import { JournalListControls } from "./JournalListControls"
import { JournalPagination } from "./JournalPagination"
import { JournalHeading } from "./JournalSectionBrowser"

function SectionChips({
  query,
  sections,
  total,
}: {
  readonly query: JournalQuery
  readonly sections: JournalLandingData["sections"]
  readonly total: number
}) {
  if (sections.length === 0) return null

  return (
    <nav
      aria-label="Filter by section"
      className="mt-5 border-b pb-4"
      style={{ borderColor: T.border.line }}
    >
      <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
        {[{ slug: null, name: "All", count: total }, ...sections].map(
          (chip) => {
            const active = query.section === chip.slug

            return (
              <li key={chip.slug ?? "all"}>
                <Link
                  aria-current={active ? "true" : undefined}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors"
                  href={journalHref(query, { section: chip.slug })}
                  scroll={false}
                  style={
                    active
                      ? {
                          background: T.accent.chip,
                          borderColor: T.accent.primary,
                          color: T.accent.primaryHover,
                        }
                      : {
                          background: T.bg.deep,
                          borderColor: T.border.hi,
                          color: T.ink.base,
                        }
                  }
                >
                  {active ? (
                    <Icon
                      aria-hidden="true"
                      height={15}
                      icon="mdi:check"
                      width={15}
                    />
                  ) : null}
                  {chip.name}
                  <span
                    className="font-normal"
                    style={{
                      color: active ? T.accent.primaryHover : T.ink.dim,
                    }}
                  >
                    {chip.count}
                  </span>
                </Link>
              </li>
            )
          }
        )}
      </ul>
    </nav>
  )
}

function ArticleResults({
  list,
  query,
  total,
  linkLocale,
}: Pick<JournalLandingData, "list" | "query" | "total" | "linkLocale">) {
  if (list.items.length === 0) {
    const pastTheEnd = list.total > 0
    let message = "No articles in this section yet."
    if (pastTheEnd) message = "There are no articles on this page."
    else if (total === 0) message = "No Journal articles yet."

    return (
      <div>
        <EmptyState message={message} />
        {pastTheEnd ? (
          <p className="-mt-12 text-center text-[14px]">
            <GlobalLink
              className="font-semibold underline underline-offset-[3px]"
              href={journalHref(query, { page: 1 })}
              style={{ color: T.accent.primary }}
            >
              Go to the first page
            </GlobalLink>
          </p>
        ) : null}
      </div>
    )
  }

  if (query.view === "list") {
    return (
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {list.items.map((article) => (
          <li key={article.documentId}>
            <JournalArticleRow article={article} locale={linkLocale} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 xl:grid-cols-3">
      {list.items.map((article) => (
        <li key={article.documentId}>
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
>) {
  const activeSection = sections.find((s) => s.slug === query.section)

  return (
    <section
      aria-labelledby="journal-all"
      className="min-w-0 scroll-mt-24"
      id="all-articles"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <JournalHeading id="journal-all">All articles</JournalHeading>
          <p
            aria-live="polite"
            className="m-0 mt-1 text-[14px]"
            style={{ color: T.ink.dim }}
          >
            {list.total} {list.total === 1 ? "article" : "articles"}
            {activeSection ? ` in ${activeSection.name}` : ""}
          </p>
        </div>
        <JournalListControls lang={lang} languages={languages} query={query} />
      </div>

      {fallbackFrom ? (
        <p className="m-0 mt-3 text-[14px]" style={{ color: T.ink.dim }}>
          No Journal articles in {languageName(fallbackFrom)} yet, so these are
          in {languageName(lang)}.
        </p>
      ) : null}

      <SectionChips query={query} sections={sections} total={total} />

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
