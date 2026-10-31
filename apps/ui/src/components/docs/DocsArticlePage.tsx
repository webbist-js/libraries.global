import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { ArticleContext } from "@/components/articles/ArticleContext"
import { ArticleReaderActions } from "@/components/articles/ArticleReaderActions"
import { KnowledgeSidebarFooter } from "@/components/articles/EditorialSidebar"
import { ReadingProgress } from "@/components/articles/ReadingProgress"
import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { DashboardPage } from "@/components/dashboard/DashboardPage"
import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { AttachedDiscussion } from "@/components/discussions/AttachedDiscussion"
import { ArticleEditHistorySection } from "@/components/docs/ArticleEditHistory"
import { MainContent } from "@/components/ds/MainContent"
import { MetadataList } from "@/components/ds/MetadataList"
import { SidebarLinks } from "@/components/ds/SidebarLinks"
import GlobalLink from "@/components/global/GlobalLink"
import { NotTranslatedNote } from "@/components/global/NotTranslatedNote"
import { ArticleEngagement } from "@/components/providers/ArticleEngagement"
import { countWords, extractHeadings, formatDate } from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import { routing } from "@/lib/navigation"
import { absoluteUrl } from "@/lib/seo/metadata"
import type {
  ArticleBodyBlock,
  DocsWikiArticle,
  WikiArticleDetail,
} from "@/lib/strapi-api/content/server"

import {
  compareDocsArticles,
  docsArticlePath,
  homeSectionOf,
  orderedDocsArticles,
  readingTimeMinutes,
  type DocsSection,
} from "./docs.config"
import { DocsSidebarTree, type DocsTree } from "./DocsSidebarTree"

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export function DocsArticlePage({
  article,
  articles,
  sections,
  section,
  locale,
  untranslatedLocale = null,
  contentLocale,
}: {
  readonly article: WikiArticleDetail
  readonly articles: DocsWikiArticle[]
  /** The Knowledge taxonomy from Strapi, in display order. */
  readonly sections: readonly DocsSection[]
  /** The section this article is filed under. */
  readonly section: DocsSection
  readonly locale: Locale
  /** Set when this is the default-locale stand-in for a missing translation. */
  readonly untranslatedLocale?: string | null
  readonly contentLocale?: string
}) {
  const tUi = useUiTranslations("ui")
  const tArticle = useUiTranslations("editorial")
  const p = useUiTranslations("publishing")

  const title = article.title ?? article.slug ?? tArticle("untitled")
  const body: ArticleBodyBlock[] = article.body ?? []
  const headings = extractHeadings(body).filter((h) => h.level <= 3)
  const words = countWords(body)
  const readMinutes = readingTimeMinutes(body)
  const updated = formatDate(article.updatedAt, "long", locale)
  const status = tArticle(article.articleStatus ?? "stable")

  const tree: DocsTree = Object.fromEntries(
    sections.map((s) => [s.slug, [] as DocsTree[string]])
  )
  const readingOrder = [...articles].sort(compareDocsArticles)
  readingOrder.forEach((entry) => {
    const home = homeSectionOf(entry, sections)
    if (!home) return
    tree[home.slug]?.push({
      documentId: entry.documentId,
      title: entry.title ?? entry.slug ?? tArticle("untitled"),
      href: docsArticlePath(entry, sections),
      active: entry.slug === article.slug,
    })
  })

  const ordered = orderedDocsArticles(articles, sections)
  const currentIndex = ordered.findIndex((a) => a.slug === article.slug)
  const previous = currentIndex > 0 ? ordered[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < ordered.length - 1
      ? ordered[currentIndex + 1]
      : null

  return (
    <DashboardPage
      routeKey={docsArticlePath(article, sections)}
      title={title}
      className="dashboard-editorial-page dashboard-knowledge-reader"
      navigationHeading={null}
      navigation={
        <>
          <DocsSidebarTree key={article.slug} sections={sections} tree={tree} />
          <ReadingProgress
            bodyId={`analytics-knowledge-${article.documentId}`}
            minutes={readMinutes ?? 1}
          />
        </>
      }
      navigationFooter={
        <KnowledgeSidebarFooter
          slug={article.slug ?? ""}
          contentLocale={
            contentLocale ??
            (untranslatedLocale ? routing.defaultLocale : locale)
          }
        />
      }
      toolbar={
        <RecordToolbar
          share
          shareContent={{
            contentType: "knowledge",
            contentId: article.documentId,
          }}
          items={[
            { label: tUi("knowledge"), href: "/knowledge" },
            {
              label: section.title,
              href: `/knowledge?section=${section.slug}`,
            },
            { label: title },
          ]}
        />
      }
      context={
        <div className="editorial-reader-context">
          <div className="flex flex-col gap-5">
            <ArticleContext
              article={article}
              kind="knowledge"
              locale={locale}
            />
            {headings.length > 0 ? (
              <nav
                aria-label={tUi("on_this_page")}
                className="rounded-[20px] border p-5"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
              >
                <h2
                  className="type-panel-title m-0 mb-3"
                  style={{ color: T.ink.base }}
                >
                  {tUi("on_this_page")}
                </h2>
                <SidebarLinks className="[&>li>a]:text-sm [&>li>a]:text-(--t-ink-base) [&>li>a]:no-underline [&>li>a:hover]:text-(--t-accent-primary)">
                  {headings.map((heading) => (
                    <li
                      key={heading.id}
                      style={
                        heading.level === 3
                          ? { paddingLeft: "12px" }
                          : undefined
                      }
                    >
                      <a className="leading-snug" href={`#${heading.id}`}>
                        {heading.text}
                      </a>
                    </li>
                  ))}
                </SidebarLinks>
              </nav>
            ) : null}

            <div className="px-1">
              <MetadataList
                rows={[
                  { label: tArticle("section"), value: section.title },
                  {
                    label: tArticle("words"),
                    value: words > 0 ? words.toLocaleString(locale) : "—",
                  },
                  { label: tArticle("licence"), value: "CC BY-SA 4.0" },
                ]}
              />
            </div>
          </div>
        </div>
      }
      overview={
        <MainContent
          className="editorial-reader-content"
          data-analytics-page="knowledge"
          data-analytics-content-id={article.documentId}
          data-analytics-path={
            new URL(absoluteUrl(docsArticlePath(article, sections), locale))
              .pathname
          }
        >
          {" "}
          <article className="min-w-0">
            <div className="rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-8 xl:p-10">
              <h1 tabIndex={-1} className="type-h1 mt-4 mb-0 text-pretty">
                {title}
              </h1>
              {untranslatedLocale ? (
                <NotTranslatedNote locale={untranslatedLocale} />
              ) : null}
              {article.summary ? (
                <p className="mt-5 mb-0 max-w-[62ch] text-lg leading-relaxed text-pretty text-(--t-ink-dim)">
                  {article.summary}
                </p>
              ) : null}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      background: "var(--tint-national-bg)",
                      color: "var(--tint-national-fg)",
                    }}
                  >
                    {initialsOf(
                      article.author ?? tArticle("communityContributors")
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {article.author ?? tArticle("communityContributors")}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-(--t-ink-dim)">
                      {[
                        updated
                          ? tArticle("updatedOn", { date: updated })
                          : null,
                        readMinutes != null
                          ? tArticle("readingTime", { minutes: readMinutes })
                          : null,
                        p("maintainedBy"),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    background:
                      article.articleStatus &&
                      article.articleStatus !== "stable"
                        ? T.bg.muted
                        : "var(--tint-public-bg)",
                    color:
                      article.articleStatus &&
                      article.articleStatus !== "stable"
                        ? T.ink.dim
                        : "var(--tint-public-fg)",
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    icon={
                      article.articleStatus &&
                      article.articleStatus !== "stable"
                        ? "mdi:information-outline"
                        : "mdi:check"
                    }
                    width={13}
                  />
                  {status}
                </span>
              </div>
              <ArticleReaderActions
                kind="knowledge"
                slug={article.slug ?? ""}
                path={docsArticlePath(article, sections)}
                contentLocale={
                  contentLocale ??
                  (untranslatedLocale ? routing.defaultLocale : locale)
                }
                interfaceLocale={locale}
                availableLocales={article.availableLocales}
              />
              {body.length > 0 ? (
                <div
                  id={`analytics-knowledge-${article.documentId}`}
                  className="mt-7 max-w-[68ch] pb-3"
                >
                  <ArticleEngagement
                    bodyId={`analytics-knowledge-${article.documentId}`}
                    contentId={article.documentId}
                    contentType="knowledge"
                    path={
                      new URL(
                        absoluteUrl(docsArticlePath(article, sections), locale)
                      ).pathname
                    }
                  />
                  {/* Heading margins are in rem: the spacing scale is em-based,
                    so mt-* on a 26px heading would scale with it. */}
                  <div className="article-prose [&_h2]:mt-[2.25rem] [&_h2]:mb-[0.75rem] [&_h2:first-child]:mt-0 [&_h3]:mt-[1.75rem] [&_h3]:mb-[0.5rem] [&_h3:first-child]:mt-0">
                    <ArticleBodyBlocks blocks={body} />
                  </div>
                </div>
              ) : (
                <div className="mt-7 flex gap-3 rounded-2xl border border-(--t-border-line) bg-(--t-bg-surface) p-5 text-sm leading-relaxed text-(--t-ink-dim)">
                  <Icon
                    aria-hidden="true"
                    icon="mdi:book-open-outline"
                    width={20}
                    className="mt-0.5 shrink-0"
                  />
                  <p className="m-0">{tArticle("noContent")}</p>
                </div>
              )}

              <div id="article-history" className="scroll-mt-24" />
              <ArticleEditHistorySection
                className="mt-6"
                kind="wiki"
                documentId={article.documentId}
                locale={untranslatedLocale ? routing.defaultLocale : locale}
              />
            </div>
            <div className="mt-5 scroll-mt-24" id="article-discussion">
              <AttachedDiscussion
                presentation="article"
                target={{
                  uid: "api::wiki-article.wiki-article",
                  documentId: article.documentId,
                  locale:
                    contentLocale ??
                    (untranslatedLocale ? routing.defaultLocale : locale),
                }}
                subjectSlug="knowledge"
                title={article.title ?? article.slug ?? ""}
                language={
                  contentLocale ??
                  (untranslatedLocale ? routing.defaultLocale : locale)
                }
              />
            </div>

            {/* Previous / next */}
            {(previous ?? next) ? (
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {previous ? (
                  <GlobalLink
                    className="rounded-[20px] border p-5 transition-colors hover:border-(--t-border-hi)"
                    href={docsArticlePath(previous, sections)}
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    <span
                      className="block text-sm"
                      style={{ color: T.ink.dim }}
                    >
                      ← {tArticle("previous")}
                    </span>
                    <span
                      className="mt-1 block text-lg font-medium"
                      style={{ fontFamily: T.font.sans, color: T.ink.base }}
                    >
                      {previous.title}
                    </span>
                  </GlobalLink>
                ) : (
                  <span aria-hidden="true" />
                )}
                {next ? (
                  <GlobalLink
                    className="rounded-[20px] border p-5 text-right transition-colors hover:border-(--t-border-hi)"
                    href={docsArticlePath(next, sections)}
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.line,
                    }}
                  >
                    <span
                      className="block text-sm"
                      style={{ color: T.ink.dim }}
                    >
                      {tArticle("next")} →
                    </span>
                    <span
                      className="mt-1 block text-lg font-medium"
                      style={{ fontFamily: T.font.sans, color: T.ink.base }}
                    >
                      {next.title}
                    </span>
                  </GlobalLink>
                ) : null}
              </div>
            ) : null}
          </article>
        </MainContent>
      }
    >
      {null}
    </DashboardPage>
  )
}
export default DocsArticlePage
