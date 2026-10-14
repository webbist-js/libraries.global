import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations, type Locale } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { EditorOnly } from "@/components/contribute/EditorOnly"
import { ArticleEditHistorySection } from "@/components/docs/ArticleEditHistory"
import { Breadcrumb } from "@/components/ds/Breadcrumb"
import GlobalHeader from "@/components/global/GlobalHeader"
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
  docsArticlePath,
  homeSectionOf,
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

/** Ordered flat page list: section order first, then title. Drives prev/next. */
function orderedPages(
  articles: DocsWikiArticle[],
  sections: readonly DocsSection[]
) {
  const sectionOrder = new Map(
    sections.map((section, index) => [section.slug, index])
  )
  const indexOf = (article: DocsWikiArticle) =>
    sectionOrder.get(homeSectionOf(article, sections)?.slug ?? "") ?? 0

  return [...articles].sort((a, b) => {
    const bySection = indexOf(a) - indexOf(b)
    if (bySection !== 0) return bySection

    return (a.title ?? "").localeCompare(b.title ?? "")
  })
}

export function DocsArticlePage({
  article,
  articles,
  sections,
  section,
  locale,
  untranslatedLocale = null,
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
}) {
  const tUi = useUiTranslations("ui")
  const tArticle = useUiTranslations("editorial")

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
  articles.forEach((entry) => {
    const home = homeSectionOf(entry, sections)
    if (!home) return
    tree[home.slug]?.push({
      documentId: entry.documentId,
      title: entry.title ?? entry.slug ?? tArticle("untitled"),
      href: docsArticlePath(entry, sections),
      active: entry.slug === article.slug,
    })
  })

  const ordered = orderedPages(articles, sections)
  const currentIndex = ordered.findIndex((a) => a.slug === article.slug)
  const previous = currentIndex > 0 ? ordered[currentIndex - 1] : null
  const next =
    currentIndex >= 0 && currentIndex < ordered.length - 1
      ? ordered[currentIndex + 1]
      : null

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main
        className="relative z-10 flex-1"
        data-analytics-page="knowledge"
        data-analytics-content-id={article.documentId}
        data-analytics-path={
          new URL(absoluteUrl(docsArticlePath(article, sections), locale))
            .pathname
        }
      >
        <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 gap-10 px-4 py-8 sm:px-8 lg:grid-cols-[250px_minmax(0,1fr)] xl:grid-cols-[250px_minmax(0,1fr)_240px]">
          {/* ── Left: docs tree ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-[76px]">
              <DocsSidebarTree sections={sections} tree={tree} />
            </div>
          </aside>

          {/* ── Center: article ── */}
          <article className="max-w-[720px] min-w-0">
            <Breadcrumb
              items={[
                { label: tUi("home"), href: "/" },
                { label: tUi("knowledge"), href: "/knowledge" },
                {
                  label: section.title,
                  href: `/knowledge?section=${section.slug}`,
                },
                { label: title },
              ]}
            />

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-3 py-1 text-[13px] font-semibold"
                style={{ background: section.tintBg, color: section.tintFg }}
              >
                {section.title}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[13px] font-semibold"
                style={{
                  background: "var(--tint-public-bg)",
                  color: "var(--tint-public-fg)",
                }}
              >
                <Icon
                  aria-hidden="true"
                  height={13}
                  icon="mdi:check"
                  width={13}
                />
                {status}
              </span>
              {readMinutes != null ? (
                <span className="text-[13px]" style={{ color: T.ink.dim }}>
                  {tArticle("readingTime", { minutes: readMinutes })}
                </span>
              ) : null}
            </div>

            <h1
              className="mt-4 mb-0 text-balance"
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(38px, 4.5vw, 56px)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1.05,
                color: T.ink.base,
              }}
            >
              {title}
            </h1>
            {untranslatedLocale ? (
              <NotTranslatedNote locale={untranslatedLocale} />
            ) : null}

            {article.summary ? (
              <p
                className="mt-4 mb-0 max-w-[62ch] text-[18px] leading-[1.6] text-pretty"
                style={{ color: T.ink.dim }}
              >
                {article.summary}
              </p>
            ) : null}

            {/* Author + page actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full text-[13px] font-semibold"
                  style={{
                    background: "var(--tint-national-bg)",
                    color: "var(--tint-national-fg)",
                  }}
                >
                  {initialsOf(article.author ?? tArticle("contributor"))}
                </span>
                <span className="flex flex-col">
                  <span
                    className="text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {article.author ?? tArticle("communityContributors")}
                  </span>
                  {updated ? (
                    <span className="text-[13px]" style={{ color: T.ink.dim }}>
                      {tArticle("updatedOn", { date: updated })}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* The editor is for Knowledge editors; reporting is for all. */}
                <EditorOnly kind="knowledge">
                  <GlobalLink
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-muted)"
                    href={`/contribute/knowledge/${article.slug}`}
                    style={{
                      background: T.bg.deep,
                      borderColor: T.border.hi,
                      color: T.ink.base,
                    }}
                  >
                    <Icon
                      aria-hidden="true"
                      height={14}
                      icon="mdi:pencil-outline"
                      width={14}
                    />
                    {tArticle("editPage")}
                  </GlobalLink>
                </EditorOnly>
                <GlobalLink
                  className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-muted)"
                  href={`/contribute/knowledge/${article.slug}?mode=report`}
                  style={{
                    background: T.bg.deep,
                    borderColor: T.border.hi,
                    color: T.ink.base,
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    height={14}
                    icon="mdi:alert-outline"
                    width={14}
                  />
                  {tArticle("reportIssue")}
                </GlobalLink>
              </div>
            </div>

            {/* Body — white section card on paper, serif headings, 17px prose */}
            {body.length > 0 ? (
              <div
                id={`analytics-knowledge-${article.documentId}`}
                className="mt-7 rounded-3xl border px-6 py-8 sm:px-10 sm:py-10"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
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
                <div className="[&_h2]:mt-[2.25rem] [&_h2]:mb-[0.75rem] [&_h2]:[font-family:var(--font-newsreader),Georgia,serif] [&_h2]:text-[26px] [&_h2]:font-medium [&_h2]:tracking-[-0.01em] [&_h2:first-child]:mt-0 [&_h3]:mt-[1.75rem] [&_h3]:mb-[0.5rem] [&_h3]:[font-family:var(--font-newsreader),Georgia,serif] [&_h3]:text-[20px] [&_h3]:font-medium [&_h3:first-child]:mt-0 [&_li]:text-[17px] [&_li]:leading-[1.7] [&_p]:text-[17px] [&_p]:leading-[1.7]">
                  <ArticleBodyBlocks blocks={body} />
                </div>
              </div>
            ) : (
              <p className="mt-8 text-[16px]" style={{ color: T.ink.dim }}>
                {tArticle("noContent")}
              </p>
            )}

            <ArticleEditHistorySection
              className="mt-6"
              kind="wiki"
              documentId={article.documentId}
              locale={untranslatedLocale ? routing.defaultLocale : locale}
            />

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
                      className="block text-[13px]"
                      style={{ color: T.ink.dim }}
                    >
                      ← {tArticle("previous")}
                    </span>
                    <span
                      className="mt-1 block text-[19px] font-medium"
                      style={{ fontFamily: T.font.serif, color: T.ink.base }}
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
                      className="block text-[13px]"
                      style={{ color: T.ink.dim }}
                    >
                      {tArticle("next")} →
                    </span>
                    <span
                      className="mt-1 block text-[19px] font-medium"
                      style={{ fontFamily: T.font.serif, color: T.ink.base }}
                    >
                      {next.title}
                    </span>
                  </GlobalLink>
                ) : null}
              </div>
            ) : null}
          </article>

          {/* ── Right: on this page + meta ── */}
          <aside className="hidden xl:block">
            <div className="sticky top-[76px] flex flex-col gap-5">
              {headings.length > 0 ? (
                <nav
                  aria-label={tUi("on_this_page")}
                  className="rounded-[20px] border p-5"
                  style={{ background: T.bg.deep, borderColor: T.border.line }}
                >
                  <p
                    className="m-0 mb-2 text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {tUi("on_this_page")}
                  </p>
                  <ul
                    className="m-0 flex list-none flex-col gap-1 border-l p-0 pl-3"
                    style={{ borderColor: T.border.divider }}
                  >
                    {headings.map((heading) => (
                      <li
                        key={heading.id}
                        style={
                          heading.level === 3
                            ? { paddingLeft: "12px" }
                            : undefined
                        }
                      >
                        <a
                          className="block py-0.5 text-[14px] leading-snug transition-colors hover:text-(--t-accent-primary)"
                          href={`#${heading.id}`}
                          style={{ color: T.ink.dim }}
                        >
                          {heading.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}

              <div
                className="rounded-[20px] border p-5"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
              >
                <p
                  className="m-0 mb-2 text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {tArticle("aboutPage")}
                </p>
                <dl className="m-0">
                  {[
                    { label: tUi("status"), value: status },
                    { label: tArticle("updated"), value: updated ?? "—" },
                    {
                      label: tArticle("words"),
                      value: words > 0 ? words.toLocaleString(locale) : "—",
                    },
                    { label: tArticle("licence"), value: "CC BY-SA 4.0" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between gap-3 border-t py-2.5 first:border-t-0"
                      style={{ borderColor: T.border.divider }}
                    >
                      <dt className="text-[14px]" style={{ color: T.ink.dim }}>
                        {row.label}
                      </dt>
                      <dd
                        className="m-0 text-right text-[14px] font-semibold"
                        style={{ color: T.ink.base }}
                      >
                        {row.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  )
}

export default DocsArticlePage
