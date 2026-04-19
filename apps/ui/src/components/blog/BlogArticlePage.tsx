import Image from "next/image"
import type { Locale } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { BlogArticleCard } from "@/components/blog/BlogArticleCard"
import { Avatar, Breadcrumb, MetaRow, PageShell, Pager } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import {
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
          <p className="text-white/40">Article not found.</p>
        </main>
      </PageShell>
    )
  }

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  const readingTime = estimateReadingTime(article.body)
  const publishedDate = formatDate(article.publishedAt ?? article.updatedAt)
  const headings = extractHeadings(article.body)
  const relatedCards =
    related?.filter((a) => a.slug !== article.slug).slice(0, 3) ?? []
  const tags = Array.isArray(article.tags) ? article.tags : []

  return (
    <PageShell className="flex flex-col">
      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* ── Hero — full-bleed image with title overlay ─────────────────── */}
        <section className="relative isolate flex min-h-[52vh] flex-col justify-end overflow-hidden">
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
          {/* Overlay gradients */}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.25)_0%,rgba(5,8,22,0.1)_30%,rgba(5,8,22,0.7)_68%,rgba(5,8,22,0.97)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,22,0.5)_0%,transparent_60%)]" />

          {/* Overlaid text content */}
          <Container className="relative z-10 pt-40 pb-12">
            <div className="max-w-[720px]">
              {/* Breadcrumb */}
              <div className="mb-5">
                <Breadcrumb
                  items={[
                    { label: "Blog", href: "/blog" },
                    { label: article.title ?? "" },
                  ]}
                />
              </div>

              {/* Title */}
              <h1 className="font-[family-name:var(--font-fraunces)] text-[clamp(2.2rem,5vw,4rem)] leading-[1.02] font-semibold tracking-[-0.02em] text-white italic">
                {article.title}
              </h1>

              {article.summary ? (
                <p className="mt-5 max-w-[54ch] text-[15px] leading-7 text-white/52">
                  {article.summary}
                </p>
              ) : null}
            </div>
          </Container>
        </section>

        {/* ── Author + meta row ─────────────────────────────────────────── */}
        <div
          className="border-b border-white/[0.06] backdrop-blur-sm"
          style={{ background: `${T.bg.space}cc` }}
        >
          <Container>
            <div className="flex flex-wrap items-center gap-5 py-5">
              <div className="flex items-center gap-3">
                <Avatar
                  initials={(article.author ?? "?").charAt(0)}
                  size="md"
                />
                {article.author ? (
                  <div>
                    <p className="text-[13px] font-medium text-white/75">
                      {article.author}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="ml-auto">
                <MetaRow
                  items={[
                    readingTime ? `${readingTime} min read` : null,
                    formatDate(article.publishedAt ?? article.updatedAt),
                    article.author ?? null,
                  ]}
                />
              </div>
            </div>
          </Container>
        </div>

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
                  <div className="mt-14 flex flex-wrap gap-2 border-t border-white/6 pt-8">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-mono text-[10px] tracking-[0.1em] text-white/38 uppercase"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {/* Back link */}
                <div className="mt-10 border-t border-white/6 pt-6">
                  <GlobalLink
                    href="/blog"
                    className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.1em] text-white/35 uppercase transition-colors hover:text-white/60"
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
                <div className="sticky top-8 space-y-8">
                  {/* Article metadata */}
                  <div
                    className="space-y-4 rounded-xl p-5"
                    style={{
                      background: T.bg.surface,
                      border: `1px solid ${T.border.line}`,
                    }}
                  >
                    <div>
                      <p className="mb-1 font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">
                        Published
                      </p>
                      <p className="text-[13px] text-white/60">
                        {publishedDate}
                      </p>
                    </div>
                    <div>
                      <p className="mb-1 font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">
                        Reading time
                      </p>
                      <p className="text-[13px] text-white/60">
                        {readingTime} min
                      </p>
                    </div>
                    {article.category ? (
                      <div>
                        <p className="mb-1 font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">
                          Category
                        </p>
                        <p className="text-[13px] text-white/60">
                          {article.category}
                        </p>
                      </div>
                    ) : null}
                  </div>

                  {/* TOC */}
                  {headings.length > 0 ? (
                    <div>
                      <p className="mb-4 font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">
                        In this article
                      </p>
                      <nav className="space-y-2">
                        {headings.map((h) => (
                          <a
                            key={h.id}
                            href={`#${h.id}`}
                            className="block text-[12px] leading-snug text-white/38 transition-colors hover:text-white/70"
                            style={{
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
          <section className="border-t border-white/[0.06] py-12">
            <Container>
              <div className="max-w-[700px]">
                <div
                  className="flex items-start gap-5 rounded-2xl p-6 sm:p-8"
                  style={{
                    background: T.bg.surface,
                    border: `1px solid ${T.border.line}`,
                  }}
                >
                  <Avatar
                    initials={(article.author ?? "?").charAt(0)}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="mb-0.5 font-mono text-[9px] tracking-[0.2em] text-white/25 uppercase">
                      Written by
                    </p>
                    <p className="mb-2 text-[15px] font-medium text-white">
                      {article.author}
                    </p>
                    {article.authorBio ? (
                      <p className="text-[13px] leading-6 text-white/45">
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
          <section className="border-t border-white/[0.06] py-14 sm:py-20">
            <Container>
              <div className="mb-10">
                <p className="mb-4 font-mono text-[11px] tracking-[0.22em] text-white/30 uppercase">
                  Continue reading
                </p>
                <h2 className="font-[family-name:var(--font-fraunces)] text-[2.2rem] leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-[2.8rem]">
                  More from{" "}
                  <em className="text-white/60 italic">the journal</em>
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {relatedCards.map((a, i) => (
                  <BlogArticleCard key={a.documentId} article={a} index={i} />
                ))}
              </div>

              <div className="mt-10">
                <Pager
                  prev={
                    relatedCards[0]?.slug
                      ? {
                          label: relatedCards[0].title ?? "",
                          href: `/blog/${relatedCards[0].slug}`,
                        }
                      : undefined
                  }
                  next={
                    relatedCards[1]?.slug
                      ? {
                          label: relatedCards[1].title ?? "",
                          href: `/blog/${relatedCards[1].slug}`,
                        }
                      : undefined
                  }
                />
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
