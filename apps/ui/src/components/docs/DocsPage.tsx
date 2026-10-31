import { Icon } from "@iconify/react"
import {
  articleBrowseSearchParams,
  parseArticleBrowseQuery,
  type ArticleBrowseResult,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { ArticleDiscoveryFilters } from "@/components/articles/ArticleDiscoveryFilters"
import { KnowledgeSidebarFooter } from "@/components/articles/EditorialSidebar"
import { KnowledgeDiscovery } from "@/components/articles/KnowledgeDiscovery"
import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import {
  DEFAULT_SECTION_ICON,
  compareDocsArticles,
  DOCS_REPO_URL,
  docsArticlePath,
  docsSectionSlugsOf,
  homeSectionOf,
  readingTimeMinutes,
  type DocsSection,
} from "@/components/docs/docs.config"
import {
  DocsSectionsExplorer,
  type DocsPageRow,
  type DocsSectionData,
} from "@/components/docs/DocsSectionsExplorer"
import { DocsSectionTabs } from "@/components/docs/DocsSectionTabs"
import { DocsSidebarTree } from "@/components/docs/DocsSidebarTree"
import { SearchField } from "@/components/ds"
import { MainContent } from "@/components/ds/MainContent"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import { analyticsAttributes } from "@/lib/analytics-events"
import { articleReaderPath } from "@/lib/article-content-language"
import { formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type {
  DocsWikiArticle,
  WikiArticleSummary,
  WikiLandingData,
} from "@/lib/strapi-api/content/server"

const ENTRY_CARDS = [
  {
    title: "improveRecords",
    description: "improveRecordsLead",
    href: "/contribute",
    icon: "mdi:pencil-outline",
    bg: "var(--t-palette-amber-bg)",
    fg: "var(--t-palette-amber-fg)",
    external: false,
  },
  {
    title: "runPlatform",
    description: "runPlatformLead",
    href: DOCS_REPO_URL,
    icon: "mdi:code-tags",
    bg: "var(--tint-academic-bg)",
    fg: "var(--tint-academic-fg)",
    external: true,
  },
  {
    title: "useOpenData",
    description: "useOpenDataLead",
    href: "#data-api",
    icon: "mdi:database-outline",
    bg: "var(--tint-public-bg)",
    fg: "var(--tint-public-fg)",
    external: false,
  },
] as const

/** Older CMS titles omit the accent markers present in the translated pattern. */
function knowledgeHeroTitle(title: string, pattern: string): string {
  const accent = /\*([^*]+)\*$/.exec(pattern)?.[1]
  if (!accent || title.includes("*") || !title.endsWith(accent)) return title

  return `${title.slice(0, -accent.length)}*${accent}*`
}

function toRow(
  article: DocsWikiArticle,
  sections: readonly DocsSection[],
  locale: string,
  untitled: string,
  contentLocale = locale
): DocsPageRow {
  return {
    documentId: article.documentId,
    title: article.title ?? article.slug ?? untitled,
    href: articleReaderPath(
      docsArticlePath(article, sections),
      locale,
      contentLocale
    ),
    summary: article.summary ?? null,
    updatedLabel: formatDate(article.updatedAt, "short", locale),
    readMinutes: article.readingTimeMinutes ?? readingTimeMinutes(article.body),
  }
}

export function DocsPage({
  articles,
  sections,
  locale,
  contentLocale = locale,
  quickStartCards,
  landing,
  discovery,
  queryActive = false,
  searchQuery = "",
  currentQuery = {},
}: {
  readonly articles: DocsWikiArticle[]
  /** The Knowledge taxonomy from Strapi, in display order. */
  readonly sections: DocsSection[]
  readonly locale: Locale
  readonly contentLocale?: string
  readonly quickStartCards?: readonly WikiArticleSummary[] | null
  readonly landing?: WikiLandingData | null
  readonly queryActive?: boolean
  readonly searchQuery?: string
  readonly currentQuery?: Record<string, unknown>
  readonly discovery?: ArticleBrowseResult
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")
  const p = useUiTranslations("publishing")
  const retainedSearch = new URLSearchParams(
    articleBrowseSearchParams({
      ...parseArticleBrowseQuery(currentQuery),
      q: undefined,
      page: 1,
    })
  )
  retainedSearch.delete("q")
  retainedSearch.delete("page")
  for (const field of ["lang", "country"])
    if (currentQuery[field] === "all") retainedSearch.set(field, "all")

  const entryCards =
    (landing?.quickStartCards ?? quickStartCards)?.flatMap((source) => {
      const article =
        contentLocale === locale
          ? source
          : articles.find((item) => item.documentId === source.documentId)
      if (!article?.slug) return []
      const section = homeSectionOf(article, sections)

      return [
        {
          title: article.title ?? article.slug ?? t("untitled"),
          description: article.summary ?? "",
          href: articleReaderPath(
            docsArticlePath(article, sections),
            locale,
            contentLocale
          ),
          icon: section?.icon ?? DEFAULT_SECTION_ICON,
          bg: section?.tintBg ?? T.bg.muted,
          fg: section?.tintFg ?? T.ink.dim,
          external: false,
        },
      ]
    }) ??
    ENTRY_CARDS.map((card) => ({
      ...card,
      title: t(card.title),
      description: t(card.description),
    }))

  const rowsBySection = new Map(
    sections.map((section) => [section.slug, [] as DocsPageRow[]])
  )
  const readingOrder = [...articles].sort(compareDocsArticles)
  readingOrder.forEach((article) => {
    // Filed under its home section (the first section when it has none),
    // and listed again under any other section the editor tagged.
    const home = homeSectionOf(article, sections)
    if (!home) return
    const row = toRow(article, sections, locale, t("untitled"), contentLocale)
    new Set([home.slug, ...docsSectionSlugsOf(article)]).forEach((slug) =>
      rowsBySection.get(slug)?.push(row)
    )
  })
  const sectionData: DocsSectionData = sections.map((section) => ({
    section,
    rows: rowsBySection.get(section.slug) ?? [],
  }))
  // Facet identities span locales; labels follow the current interface taxonomy.
  const localizedDiscovery = discovery
    ? {
        ...discovery,
        facets: {
          ...discovery.facets,
          sections: discovery.facets.sections.map((facet) => ({
            ...facet,
            label:
              sections.find(
                (section) =>
                  section.slug === facet.value || section.slug === facet.slug
              )?.title ?? facet.label,
          })),
        },
      }
    : undefined
  const activeSection = sections.find(
    (section) => section.slug === currentQuery.section
  )
  const counts = Object.fromEntries(
    sectionData.map(({ section, rows }) => [
      section.slug,
      localizedDiscovery
        ? (localizedDiscovery.facets.sections.find(
            (facet) =>
              facet.value === section.slug || facet.slug === section.slug
          )?.count ?? 0)
        : rows.length,
    ])
  )

  // Recent changes — articles are already sorted by updatedAt desc
  const recent = articles.slice(0, 5)

  const total = localizedDiscovery?.total ?? articles.length
  const isOverview = !queryActive && !activeSection
  const query = parseArticleBrowseQuery(currentQuery)
  const isReadingOrder = Boolean(
    activeSection &&
    !query.q &&
    query.page === 1 &&
    !currentQuery.sort &&
    currentQuery.lang !== "all" &&
    (query.filters.languages?.length ?? 0) <= 1 &&
    Object.keys(query.filters).every(
      (key) => key === "sections" || key === "languages"
    )
  )
  const firstGuide = activeSection
    ? isReadingOrder
      ? readingOrder.find((article) =>
          new Set([
            homeSectionOf(article, sections)?.slug,
            ...docsSectionSlugsOf(article),
          ]).has(activeSection.slug)
        )
      : localizedDiscovery?.items[0]
    : undefined

  return (
    <DashboardPage
      routeKey="/knowledge"
      title={tUi("knowledge")}
      className="dashboard-editorial-page dashboard-knowledge-landing"
      navigationHeading={null}
      navigation={
        <DocsSidebarTree
          sections={sections}
          tree={Object.fromEntries(
            sectionData.map(({ section, rows }) => [
              section.slug,
              rows.map((row) => ({
                documentId: row.documentId,
                title: row.title,
                href: row.href,
                active: false,
              })),
            ])
          )}
        />
      }
      navigationFooter={<KnowledgeSidebarFooter />}
      toolbar={
        <RecordToolbar
          items={[
            { label: tUi("home"), href: "/" },
            {
              label: tUi("knowledge"),
              href: activeSection ? "/knowledge" : undefined,
            },
            ...(activeSection ? [{ label: activeSection.title }] : []),
          ]}
        />
      }
      context={
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <section
            aria-labelledby="docs-recent"
            className="rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5"
          >
            <h2 id="docs-recent" className="type-panel-title m-0 mb-2">
              {activeSection ? t("otherSections") : p("recentPages")}
            </h2>
            <ul className="m-0 list-none divide-y divide-(--t-border-line) border-t border-(--t-border-line) p-0">
              {activeSection
                ? sections
                    .filter((section) => section.slug !== activeSection.slug)
                    .map((section) => (
                      <li key={section.slug}>
                        <GlobalLink
                          href={`/knowledge?section=${section.slug}`}
                          className="flex min-h-11 items-center gap-3 py-2 text-sm font-semibold text-(--t-ink-base) no-underline hover:text-(--t-accent-primary)"
                        >
                          <span
                            aria-hidden="true"
                            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                            style={{
                              background: section.tintBg,
                              color: section.tintFg,
                            }}
                          >
                            <Icon icon={section.icon} width={17} />
                          </span>
                          <span className="flex-1">{section.title}</span>
                          <span className="text-xs text-(--t-ink-dim)">
                            {counts[section.slug] ?? 0}
                          </span>
                        </GlobalLink>
                      </li>
                    ))
                : recent.map((article) => {
                    const row = toRow(
                      article,
                      sections,
                      locale,
                      t("untitled"),
                      contentLocale
                    )

                    return (
                      <li key={article.documentId} className="py-3">
                        <GlobalLink
                          href={row.href}
                          className="block text-sm leading-snug font-semibold text-(--t-ink-base) no-underline hover:text-(--t-accent-primary)"
                        >
                          {row.title}
                        </GlobalLink>
                        <p className="mt-1 mb-0 text-xs text-(--t-ink-dim)">
                          {homeSectionOf(article, sections)?.title}
                          {row.updatedLabel ? ` · ${row.updatedLabel}` : ""}
                        </p>
                      </li>
                    )
                  })}
            </ul>
            {!activeSection && !recent.length ? (
              <p className="mb-0 text-base text-(--t-ink-dim)">
                {t("noPages")}
              </p>
            ) : null}
          </section>
        </div>
      }
      header={
        <>
          <PageHero
            variant="card"
            eyebrow={
              activeSection
                ? undefined
                : (landing?.heroEyebrow ?? tUi("knowledge"))
            }
            eyebrowAccent={
              isOverview ? t("guideCount", { count: total }) : undefined
            }
            eyebrowIcon="mdi:book-open-outline"
            title={
              activeSection?.title ??
              knowledgeHeroTitle(
                landing?.heroTitle ?? t("knowledgeHeroTitle"),
                t("knowledgeHeroTitle")
              )
            }
            plainTitle={Boolean(activeSection)}
            compact={Boolean(activeSection)}
            leadPlacement={activeSection ? "left" : "right"}
            lead={
              activeSection?.description ??
              landing?.heroText ??
              t("knowledgeHeroLead")
            }
            titleIcon={
              activeSection ? (
                <span
                  aria-hidden="true"
                  className="flex size-12 items-center justify-center rounded-2xl"
                  style={{
                    background: activeSection.tintBg,
                    color: activeSection.tintFg,
                  }}
                >
                  <Icon icon={activeSection.icon} width={25} />
                </span>
              ) : undefined
            }
          >
            {activeSection && firstGuide && !searchQuery ? (
              <GlobalLink
                href={articleReaderPath(
                  docsArticlePath(firstGuide, sections),
                  locale,
                  isReadingOrder
                    ? contentLocale
                    : (localizedDiscovery?.items[0]?.locale ?? contentLocale)
                )}
                className="group flex items-center justify-between gap-5 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 lg:ml-auto lg:max-w-sm"
              >
                <span>
                  <span className="block text-xs font-semibold text-(--t-ink-dim)">
                    {t("startWith")}
                  </span>
                  <span className="type-small-heading mt-1 block">
                    {firstGuide.title}
                  </span>
                </span>
                <Icon
                  aria-hidden="true"
                  icon="mdi:arrow-right"
                  width={20}
                  className="shrink-0 text-(--t-accent-primary)"
                />
              </GlobalLink>
            ) : (
              <form
                action={locale === "en" ? "/knowledge" : `/${locale}/knowledge`}
                method="get"
                {...analyticsAttributes("search", {
                  interaction_source: "article",
                  search_type: "knowledge",
                })}
              >
                {[...retainedSearch].map(([name, value]) => (
                  <input key={name} type="hidden" name={name} value={value} />
                ))}
                <SearchField
                  id="docs-search"
                  label={tUi("search_the_knowledge_base")}
                  placeholder={tUi(
                    "search_the_knowledge_base_eg_contribute_api_run_locally"
                  )}
                  inputProps={{
                    name: "q",
                    defaultValue: searchQuery,
                    maxLength: 120,
                  }}
                />
              </form>
            )}
          </PageHero>
          <div className="knowledge-browse-controls">
            <DocsSectionTabs
              sections={sections}
              counts={counts}
              total={activeSection ? undefined : total}
              variant="pills"
            />
            {localizedDiscovery ? (
              <ArticleDiscoveryFilters
                discovery={localizedDiscovery}
                kind="knowledge"
                compact
                toolbar
              />
            ) : null}
          </div>
        </>
      }
      overview={
        <MainContent className="editorial-landing-content">
          <Container className="editorial-content-container">
            <div className="editorial-content-column">
              <div className="min-w-0">
                {isOverview && entryCards.length > 0 ? (
                  <section
                    className="mb-7"
                    aria-labelledby="docs-start-heading"
                  >
                    <h2
                      id="docs-start-heading"
                      className="type-small-heading m-0 mb-3"
                    >
                      {t("popularStartingPoints")}
                    </h2>
                    <nav
                      aria-label={tUi("start_here")}
                      className="knowledge-starting-points"
                    >
                      {entryCards.map((card) => (
                        <GlobalLink
                          key={card.href}
                          href={card.href}
                          className="group flex flex-col items-start rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 transition-colors hover:border-(--t-border-hi) hover:bg-(--t-bg-surface)"
                          {...(card.external
                            ? { rel: "noopener noreferrer", target: "_blank" }
                            : {})}
                        >
                          <span
                            aria-hidden="true"
                            className="mb-4 flex size-9 items-center justify-center rounded-xl"
                            style={{ background: card.bg, color: card.fg }}
                          >
                            <Icon icon={card.icon} width={20} />
                          </span>
                          <span className="type-small-heading group-hover:text-(--t-accent-primary)">
                            {card.title}
                          </span>
                          <span className="mt-2 text-sm leading-relaxed text-(--t-ink-dim)">
                            {card.description}
                          </span>
                        </GlobalLink>
                      ))}
                    </nav>
                  </section>
                ) : null}
                {isOverview ? (
                  <DocsSectionsExplorer sections={sectionData} />
                ) : isReadingOrder ? (
                  <DocsSectionsExplorer
                    focused
                    sections={sectionData.filter(
                      ({ section }) => section.slug === activeSection?.slug
                    )}
                  />
                ) : localizedDiscovery ? (
                  <KnowledgeDiscovery
                    discovery={localizedDiscovery}
                    locale={locale}
                    section={activeSection}
                  />
                ) : (
                  <DocsSectionsExplorer
                    sections={sectionData.filter(
                      ({ section }) =>
                        !activeSection || section.slug === activeSection.slug
                    )}
                  />
                )}
              </div>
            </div>
          </Container>
        </MainContent>
      }
    />
  )
}

export default DocsPage
