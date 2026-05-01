import Image from "next/image"
import type { Locale } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { ArticleShareButtons } from "@/components/blog/ArticleShareButtons"
import { BlogArticleCard } from "@/components/blog/BlogArticleCard"
import { Avatar, PageShell, SectionHeader } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import {
  countWords,
  estimateReadingTime,
  extractHeadings,
  formatDate,
} from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type {
  BlogArticleDetail,
  BlogArticleSummary,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// ── Main page ─────────────────────────────────────────────────────────────────

export function BlogArticlePage({
  article,
  related,
  navbar,
  locale,
}: {
  readonly article: BlogArticleDetail | null
  readonly related?: BlogArticleSummary[]
  readonly navbar?: NavbarData
  readonly locale: Locale
}) {
  if (!article) {
    return (
      <PageShell className="flex flex-col">
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.faint }}>Article not found.</p>
        </main>
      </PageShell>
    )
  }

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  const readingTime = estimateReadingTime(article.body)
  const wordCount = countWords(article.body)
  const publishedDate = formatDate(article.publishedAt ?? article.updatedAt)
  const breadcrumbDate = article.publishedAt
    ? new Date(article.publishedAt)
        .toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        })
        .toUpperCase()
    : null
  const headings = extractHeadings(article.body)
  const tags = Array.isArray(article.tags) ? article.tags : []

  // Curated related articles take priority; fall back to prop from page.tsx
  const relatedCards: BlogArticleSummary[] = (
    article.relatedArticles?.filter((a) => a.slug !== article.slug) ??
    related?.filter((a) => a.slug !== article.slug) ??
    []
  ).slice(0, 3)

  const authorInitial = (article.author ?? "?").charAt(0).toUpperCase()

  return (
    <PageShell className="flex flex-col">
      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* ── Hero — full-bleed image, slides behind transparent header ── */}
        <section
          data-transparent-header=""
          className="relative isolate -mt-14 flex min-h-[88vh] flex-col overflow-hidden"
          style={{ background: "#030511" }}
        >
          {/* Background */}
          {imgUrl ? (
            <div className="absolute inset-0">
              <Image
                src={imgUrl}
                alt={article.heroImage?.alternativeText ?? article.title ?? ""}
                fill
                priority
                className="object-cover"
              />
            </div>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_20%_40%,rgba(80,140,80,0.18),transparent_55%),radial-gradient(circle_at_80%_60%,rgba(160,120,40,0.14),transparent_45%),linear-gradient(135deg,#0d1408,#100c04,#050816)]" />
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.18)_0%,rgba(5,8,22,0.05)_18%,rgba(5,8,22,0.60)_60%,rgba(5,8,22,0.97)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,22,0.55)_0%,transparent_60%)]" />

          {/* Content centered in hero */}
          <Container className="relative z-10 flex flex-1 items-center py-24 pt-36">
            <div className="mx-auto w-full max-w-[680px]">
              {/* Plain-text breadcrumb */}
              <p
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.38)",
                  marginBottom: "28px",
                }}
              >
                <GlobalLink
                  href="/blog"
                  className="transition-colors hover:text-white/70"
                >
                  Journal
                </GlobalLink>
                {article.section?.name ? (
                  <>
                    <span
                      style={{
                        margin: "0 8px",
                        color: "rgba(255,255,255,.20)",
                      }}
                    >
                      /
                    </span>
                    <span>{article.section.name}</span>
                  </>
                ) : null}
                {breadcrumbDate ? (
                  <>
                    <span
                      style={{
                        margin: "0 8px",
                        color: "rgba(255,255,255,.20)",
                      }}
                    >
                      /
                    </span>
                    <span>{breadcrumbDate}</span>
                  </>
                ) : null}
              </p>

              {/* Title */}
              <h1
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 400,
                  fontSize: "clamp(2.8rem,6vw,5.5rem)",
                  lineHeight: 0.96,
                  letterSpacing: "-.03em",
                  margin: 0,
                  color: T.ink.base,
                }}
              >
                {article.title}
              </h1>

              {/* Summary */}
              {article.summary ? (
                <p
                  style={{
                    marginTop: "22px",
                    fontSize: "18px",
                    lineHeight: 1.72,
                    color: "rgba(244,247,255,.60)",
                    maxWidth: "52ch",
                  }}
                >
                  {article.summary}
                </p>
              ) : null}

              {/* Meta row: section pill · read time · word count · date */}
              <div
                className="mt-6 flex flex-wrap items-center gap-3"
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,.40)",
                }}
              >
                {article.section?.name ? (
                  <span
                    style={{
                      padding: "3px 9px",
                      borderRadius: "999px",
                      border: "1px solid rgba(255,255,255,.18)",
                      background: "rgba(255,255,255,.06)",
                      color: "rgba(255,255,255,.65)",
                    }}
                  >
                    {article.section.name}
                  </span>
                ) : null}
                {readingTime ? <span>{readingTime} min read</span> : null}
                {wordCount > 0 ? (
                  <span>{wordCount.toLocaleString("en-US")} words</span>
                ) : null}
                {publishedDate ? (
                  <span style={{ marginLeft: "auto" }}>{publishedDate}</span>
                ) : null}
              </div>

              {/* Separator */}
              <div
                className="mt-8"
                style={{ borderTop: "1px solid rgba(255,255,255,.12)" }}
              />

              {/* Author + share strip */}
              <div className="mt-6 flex items-center gap-5">
                <div className="flex items-center gap-3">
                  <Avatar initials={authorInitial} size="md" />
                  <div>
                    {article.author ? (
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: T.ink.base,
                          margin: 0,
                        }}
                      >
                        {article.author}
                      </p>
                    ) : null}
                    {article.authorTitle ? (
                      <p
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "10px",
                          letterSpacing: ".14em",
                          textTransform: "uppercase",
                          color: T.ink.faint,
                          margin: 0,
                        }}
                      >
                        {article.authorTitle}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="ml-auto">
                  <ArticleShareButtons
                    title={article.title}
                    slug={article.slug}
                  />
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* ── Article body ──────────────────────────────────────────────── */}
        <section className="py-14 sm:py-20">
          <Container>
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_240px]">
              {/* Prose */}
              <article className="max-w-[700px] min-w-0">
                <div className="article-drop-cap">
                  <ArticleBodyBlocks blocks={article.body} />
                </div>

                {/* Tags */}
                {tags.length > 0 ? (
                  <div
                    className="mt-14 flex flex-wrap gap-2 border-t pt-8"
                    style={{ borderColor: T.border.line }}
                  >
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          borderRadius: "999px",
                          border: `1px solid ${T.border.line}`,
                          background: "rgba(255,255,255,.03)",
                          padding: "4px 12px",
                          fontFamily: T.font.mono,
                          fontSize: "10px",
                          letterSpacing: ".10em",
                          textTransform: "uppercase",
                          color: T.ink.faint,
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Back link */}
                <div
                  className="mt-10 border-t pt-6"
                  style={{ borderColor: T.border.line }}
                >
                  <GlobalLink
                    href="/blog"
                    className="inline-flex items-center gap-2 transition-colors hover:text-(--t-ink-dim)"
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      letterSpacing: ".10em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                    }}
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="h-3 w-3">
                      <path
                        d="M10 3L5 8l5 5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Back to journal
                  </GlobalLink>
                </div>
              </article>

              {/* Right sidebar */}
              <aside className="hidden lg:block">
                <div className="sticky top-24 space-y-8">
                  {/* Article metadata */}
                  <div
                    className="space-y-4 rounded-xl p-5"
                    style={{
                      background: T.bg.surface,
                      border: `1px solid ${T.border.line}`,
                    }}
                  >
                    {publishedDate ? (
                      <div>
                        <p
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: "9px",
                            letterSpacing: ".20em",
                            textTransform: "uppercase",
                            color: T.ink.ghost,
                            marginBottom: "4px",
                          }}
                        >
                          Published
                        </p>
                        <p style={{ fontSize: "13px", color: T.ink.low }}>
                          {publishedDate}
                        </p>
                      </div>
                    ) : null}

                    <div>
                      <p
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "9px",
                          letterSpacing: ".20em",
                          textTransform: "uppercase",
                          color: T.ink.ghost,
                          marginBottom: "4px",
                        }}
                      >
                        Reading time
                      </p>
                      <p style={{ fontSize: "13px", color: T.ink.low }}>
                        {readingTime} min
                      </p>
                    </div>

                    {article.category?.name ? (
                      <div>
                        <p
                          style={{
                            fontFamily: T.font.mono,
                            fontSize: "9px",
                            letterSpacing: ".20em",
                            textTransform: "uppercase",
                            color: T.ink.ghost,
                            marginBottom: "4px",
                          }}
                        >
                          Category
                        </p>
                        <p style={{ fontSize: "13px", color: T.ink.low }}>
                          {article.category.name}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* TOC */}
                  {headings.length > 0 ? (
                    <div>
                      <p
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "9px",
                          letterSpacing: ".20em",
                          textTransform: "uppercase",
                          color: T.ink.ghost,
                          marginBottom: "16px",
                        }}
                      >
                        In this article
                      </p>
                      <nav className="space-y-2">
                        {headings.map((h) => (
                          <a
                            key={h.id}
                            href={`#${h.id}`}
                            className="block text-[12px] leading-snug transition-colors hover:text-(--t-ink-dim)"
                            style={{
                              color: T.ink.faint,
                              paddingLeft:
                                h.level > 2 ? `${(h.level - 2) * 12}px` : "0",
                            }}
                          >
                            {h.text}
                          </a>
                        ))}
                      </nav>
                    </div>
                  ) : null}
                </div>
              </aside>
            </div>
          </Container>
        </section>

        {/* ── Author bio ────────────────────────────────────────────────── */}
        {article.author ? (
          <section
            className="border-t py-12"
            style={{ borderColor: T.border.line }}
          >
            <Container>
              <div className="max-w-[700px]">
                <div
                  className="flex items-start gap-5 rounded-2xl p-6 sm:p-8"
                  style={{
                    background: T.bg.surface,
                    border: `1px solid ${T.border.line}`,
                  }}
                >
                  <Avatar initials={authorInitial} size="lg" />
                  <div className="min-w-0">
                    <p
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: "9px",
                        letterSpacing: ".20em",
                        textTransform: "uppercase",
                        color: T.ink.ghost,
                        marginBottom: "4px",
                      }}
                    >
                      Written by
                    </p>
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: T.ink.base,
                        marginBottom: "2px",
                      }}
                    >
                      {article.author}
                    </p>
                    {article.authorTitle ? (
                      <p
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "10px",
                          letterSpacing: ".12em",
                          textTransform: "uppercase",
                          color: T.ink.faint,
                          marginBottom: "10px",
                        }}
                      >
                        {article.authorTitle}
                      </p>
                    ) : null}
                    {article.authorBio ? (
                      <p
                        style={{
                          fontSize: "13px",
                          lineHeight: 1.7,
                          color: T.ink.faint,
                        }}
                      >
                        {article.authorBio}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Container>
          </section>
        ) : null}

        {/* ── More from the journal ─────────────────────────────────────── */}
        {relatedCards.length > 0 ? (
          <section
            className="border-t py-14 sm:py-20"
            style={{ borderColor: T.border.line }}
          >
            <Container>
              <div className="mb-10">
                <p
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".22em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                    marginBottom: "14px",
                  }}
                >
                  Continue reading
                </p>
                <SectionHeader italic="from the journal." as="h2">
                  More
                </SectionHeader>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {relatedCards.map((a, i) => (
                  <BlogArticleCard key={a.documentId} article={a} index={i} />
                ))}
              </div>
            </Container>
          </section>
        ) : null}
      </main>
    </PageShell>
  )
}

BlogArticlePage.displayName = "BlogArticlePage"

export default BlogArticlePage
