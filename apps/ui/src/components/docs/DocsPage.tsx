import { Icon } from "@iconify/react"
import type { ArticleBrowseResult } from "@repo/shared-data"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { ArticleDiscoveryFilters } from "@/components/articles/ArticleDiscoveryFilters"
import { KnowledgeDiscovery } from "@/components/articles/KnowledgeDiscovery"
import {
  DEFAULT_SECTION_ICON,
  DOCS_REPO_URL,
  DOCS_VERSION,
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
import { SearchField } from "@/components/ds"
import { PageHero } from "@/components/ds/PageHero"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { analyticsAttributes } from "@/lib/analytics-events"
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
    bg: "#F5EEDC",
    fg: "#6B5420",
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

function toRow(
  article: DocsWikiArticle,
  sections: readonly DocsSection[],
  locale: string,
  untitled: string
): DocsPageRow {
  return {
    documentId: article.documentId,
    title: article.title ?? article.slug ?? untitled,
    href: docsArticlePath(article, sections),
    summary: article.summary ?? null,
    updatedLabel: formatDate(article.updatedAt, "short", locale),
    readMinutes: article.readingTimeMinutes ?? readingTimeMinutes(article.body),
  }
}

export function DocsPage({
  articles,
  sections,
  locale,
  quickStartCards,
  landing,
  discovery,
  queryActive = false,
  searchQuery = "",
}: {
  readonly articles: DocsWikiArticle[]
  /** The Knowledge taxonomy from Strapi, in display order. */
  readonly sections: DocsSection[]
  readonly locale: Locale
  readonly quickStartCards?: readonly WikiArticleSummary[] | null
  readonly landing?: WikiLandingData | null
  readonly queryActive?: boolean
  readonly searchQuery?: string
  readonly discovery?: ArticleBrowseResult
}) {
  const tUi = useUiTranslations("ui")
  const t = useUiTranslations("editorial")
  const p = useUiTranslations("publishing")

  const entryCards =
    (landing?.quickStartCards ?? quickStartCards)
      ?.filter((article) => Boolean(article.slug))
      .map((article) => {
        const section = homeSectionOf(article, sections)

        return {
          title: article.title ?? article.slug ?? t("untitled"),
          description: article.summary ?? "",
          href: docsArticlePath(article, sections),
          icon: section?.icon ?? DEFAULT_SECTION_ICON,
          bg: section?.tintBg ?? T.bg.muted,
          fg: section?.tintFg ?? T.ink.dim,
          external: false,
        }
      }) ??
    ENTRY_CARDS.map((card) => ({
      ...card,
      title: t(card.title),
      description: t(card.description),
    }))

  const rowsBySection = new Map(
    sections.map((section) => [section.slug, [] as DocsPageRow[]])
  )
  articles.forEach((article) => {
    // Filed under its home section (the first section when it has none),
    // and listed again under any other section the editor tagged.
    const home = homeSectionOf(article, sections)
    if (!home) return
    const row = toRow(article, sections, locale, t("untitled"))
    new Set([home.slug, ...docsSectionSlugsOf(article)]).forEach((slug) =>
      rowsBySection.get(slug)?.push(row)
    )
  })
  const sectionData: DocsSectionData = sections.map((section) => ({
    section,
    rows: rowsBySection.get(section.slug) ?? [],
  }))
  const counts = Object.fromEntries(
    sectionData.map(({ section, rows }) => [section.slug, rows.length])
  )

  // Recent changes — articles are already sorted by updatedAt desc
  const recent = articles.slice(0, 5)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        <PageHero
          breadcrumb={[
            { label: tUi("home"), href: "/" },
            { label: tUi("knowledge") },
          ]}
          eyebrow={landing?.heroEyebrow ?? tUi("knowledge")}
          eyebrowAccent={landing?.version ?? DOCS_VERSION}
          eyebrowIcon="mdi:book-open-outline"
          lead={landing?.heroText ?? t("knowledgeHeroLead")}
          title={landing?.heroTitle ?? t("knowledgeHeroTitle")}
          tabs={<DocsSectionTabs counts={counts} sections={sections} />}
        >
          <form
            action={locale === "en" ? "/knowledge" : `/${locale}/knowledge`}
            method="get"
            {...analyticsAttributes("search", {
              interaction_source: "article",
              search_type: "knowledge",
            })}
          >
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
        </PageHero>

        <Container className="pt-8 pb-20">
          {discovery ? (
            queryActive ? (
              <KnowledgeDiscovery discovery={discovery} locale={locale} />
            ) : (
              <div className="mb-8">
                <ArticleDiscoveryFilters
                  discovery={discovery}
                  kind="knowledge"
                />
              </div>
            )
          ) : null}
          {/* Entry cards */}
          {!queryActive && entryCards.length > 0 ? (
            <nav
              aria-label={tUi("start_here")}
              className="grid gap-4 md:grid-cols-3"
            >
              {entryCards.map((card) => (
                <GlobalLink
                  className="group rounded-[18px] p-5 transition-transform hover:-translate-y-0.5"
                  href={card.href}
                  key={card.href}
                  style={{ background: card.bg }}
                  {...(card.external
                    ? { rel: "noopener noreferrer", target: "_blank" }
                    : {})}
                >
                  <span className="flex items-start gap-3.5">
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-full"
                      style={{ background: T.bg.deep, color: card.fg }}
                    >
                      <Icon height={19} icon={card.icon} width={19} />
                    </span>
                    <span>
                      <span
                        className="block text-[19px]"
                        style={{
                          fontFamily: T.font.serif,
                          fontWeight: 500,
                          color: T.ink.base,
                        }}
                      >
                        {card.title}{" "}
                        <span
                          aria-hidden="true"
                          className="inline-block transition-transform group-hover:translate-x-0.5"
                        >
                          →
                        </span>
                      </span>
                      <span
                        className="mt-1 block text-[14px] leading-[1.5]"
                        style={{ color: T.ink.dim }}
                      >
                        {card.description}
                      </span>
                    </span>
                  </span>
                </GlobalLink>
              ))}
            </nav>
          ) : null}

          {/* Sections + sidebar */}
          {!queryActive && (
            <div className="mt-10 flex flex-col gap-8 lg:flex-row">
              <div className="min-w-0 flex-1">
                <DocsSectionsExplorer sections={sectionData} />
              </div>

              <aside className="flex w-full shrink-0 flex-col gap-5 lg:w-[300px]">
                <section
                  aria-labelledby="docs-recent"
                  className="rounded-[20px] border p-5"
                  style={{ background: T.bg.deep, borderColor: T.border.line }}
                >
                  <h2
                    className="m-0 flex items-center gap-2 text-[17px]"
                    id="docs-recent"
                    style={{
                      fontFamily: T.font.serif,
                      fontWeight: 500,
                      color: T.ink.base,
                    }}
                  >
                    <Icon
                      aria-hidden="true"
                      height={17}
                      icon="mdi:pulse"
                      style={{ color: T.accent.primary }}
                      width={17}
                    />
                    {p("recentPages")}
                  </h2>
                  <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                    {recent.map((article) => {
                      const row = toRow(
                        article,
                        sections,
                        locale,
                        t("untitled")
                      )
                      const sectionTitle = homeSectionOf(
                        article,
                        sections
                      )?.title

                      return (
                        <li key={article.documentId}>
                          <GlobalLink
                            className="text-[15px] font-semibold underline decoration-(--t-ink-ghost) underline-offset-[3px] transition-colors hover:decoration-current"
                            href={row.href}
                            style={{ color: T.ink.base }}
                          >
                            {row.title}
                          </GlobalLink>
                          <p
                            className="m-0 mt-0.5 text-[13px]"
                            style={{ color: T.ink.low }}
                          >
                            {sectionTitle}
                            {row.updatedLabel ? ` · ${row.updatedLabel}` : ""}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                </section>

                <section
                  aria-labelledby="docs-write-with-us"
                  className="rounded-[20px] p-5"
                  style={{ background: T.ink.base, color: "#fff" }}
                >
                  <h2
                    className="m-0 text-[20px]"
                    id="docs-write-with-us"
                    style={{ fontFamily: T.font.serif, fontWeight: 500 }}
                  >
                    {p("suggestImprovement")}
                  </h2>
                  <p
                    className="mt-2 mb-0 text-[14px] leading-[1.55]"
                    style={{ color: "rgba(255,255,255,.75)" }}
                  >
                    {p("maintenanceHint")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <GlobalLink
                      href="/contribute/knowledge"
                      className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      {p("suggestImprovement")}
                    </GlobalLink>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </Container>
      </main>
    </div>
  )
}

export default DocsPage
