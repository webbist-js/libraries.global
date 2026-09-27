import Image from "next/image"
import type { Locale } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { ArticleShareButtons } from "@/components/blog/ArticleShareButtons"
import { BlogArticleCard } from "@/components/blog/BlogArticleCard"
import { Badge } from "@/components/ds/Badge"
import { Breadcrumb } from "@/components/ds/Breadcrumb"
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

// ── Main page ─────────────────────────────────────────────────────────────────

export function BlogArticlePage({
  article,
  related,
  locale,
}: {
  readonly article: BlogArticleDetail | null
  readonly related?: BlogArticleSummary[]
  readonly locale: Locale
}) {
  if (!article) {
    return (
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <GlobalHeader locale={locale} />
        <main className="flex flex-1 items-center justify-center">
          <p style={{ color: T.ink.dim }}>Article not found.</p>
        </main>
      </div>
    )
  }

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  const readingTime = estimateReadingTime(article.body)
  const wordCount = countWords(article.body)
  const publishedDate = formatDate(article.publishedAt ?? article.updatedAt)
  const shortDate = formatDate(
    article.publishedAt ?? article.updatedAt,
    "short"
  )
  const headings = extractHeadings(article.body)

  // Curated related articles take priority; fall back to prop from page.tsx
  const relatedCards: BlogArticleSummary[] = (
    article.relatedArticles?.filter((a) => a.slug !== article.slug) ??
    related?.filter((a) => a.slug !== article.slug) ??
    []
  ).slice(0, 3)

  const authorInitial = (article.author ?? "?").charAt(0).toUpperCase()

  const metaRows = [
    { label: "Published", value: publishedDate },
    {
      label: "Reading time",
      value: readingTime ? `${readingTime} min` : null,
    },
    {
      label: "Words",
      value: wordCount > 0 ? wordCount.toLocaleString("en-GB") : null,
    },
    { label: "Section", value: article.section?.name },
    { label: "Category", value: article.category?.name },
  ].filter((row): row is { label: string; value: string } => !!row.value)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void, color: T.ink.base }}
    >
      <GlobalHeader locale={locale} />

      <main className="relative z-10 mx-auto w-full max-w-[1360px] flex-1 px-4 pt-6 pb-22 sm:px-8 sm:pt-10">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Journal", href: "/journal" },
            ...(article.section?.slug
              ? [
                  {
                    label: article.section.name ?? article.section.slug,
                    href: `/journal?section=${article.section.slug}`,
                  },
                ]
              : []),
            { label: article.title ?? "" },
          ]}
        />

        {/* Content: article column + sidebar */}
        <div className="mt-4 grid grid-cols-1 items-start gap-x-10 gap-y-7 lg:grid-cols-[minmax(0,880px)_300px] lg:justify-between">
          <div className="flex min-w-0 flex-col gap-5">
            {/* Hero — in-flow, on paper */}
            <header>
              <div className="mb-3.5 flex flex-wrap items-center gap-2">
                {(article.section?.name ?? article.category?.name) ? (
                  <Badge
                    label={
                      (article.section?.name ??
                        article.category?.name) as string
                    }
                    color="violet"
                    size="md"
                  />
                ) : null}
                <span className="text-[15px]" style={{ color: T.ink.dim }}>
                  {[shortDate, readingTime ? `${readingTime} min read` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>

              <h1
                className="m-0 text-[clamp(40px,5.2vw,68px)] leading-[1.02] tracking-[-0.02em] text-balance"
                style={{ fontFamily: T.font.serif, fontWeight: 500 }}
              >
                {article.title}
              </h1>

              {article.summary ? (
                <p
                  className="mt-4 mb-0 max-w-[62ch] text-[19px] leading-[1.6] text-pretty"
                  style={{ color: T.ink.dim }}
                >
                  {article.summary}
                </p>
              ) : null}

              {/* Byline + share */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-10 flex-none items-center justify-center rounded-full text-[15px] font-semibold"
                    style={{
                      background: "var(--tint-national-bg)",
                      color: "var(--tint-national-fg)",
                    }}
                  >
                    {authorInitial}
                  </span>
                  <div>
                    <p
                      className="m-0 text-[15px] font-semibold"
                      style={{ color: T.ink.base }}
                    >
                      {article.author ?? "The Journal"}
                    </p>
                    {article.authorTitle ? (
                      <p
                        className="m-0 text-[14px]"
                        style={{ color: T.ink.dim }}
                      >
                        {article.authorTitle}
                      </p>
                    ) : null}
                  </div>
                </div>

                <ArticleShareButtons
                  title={article.title}
                  slug={article.slug}
                />
              </div>
            </header>

            {/* Hero image */}
            {imgUrl ? (
              <figure className="m-0 mt-2">
                <div
                  className="relative aspect-[16/9] overflow-hidden rounded-3xl"
                  style={{ background: T.bg.deep }}
                >
                  <Image
                    src={imgUrl}
                    alt={
                      article.heroImage?.alternativeText ?? article.title ?? ""
                    }
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 880px"
                    className="object-cover"
                  />
                </div>
              </figure>
            ) : null}

            {/* Prose — white section card on paper */}
            <article
              className="rounded-3xl border px-6 py-8 sm:px-12 sm:py-11"
              style={{ background: T.bg.deep, borderColor: T.border.line }}
            >
              <div className="article-drop-cap [&_h2]:mt-10 [&_h2]:[font-family:var(--font-newsreader),Georgia,serif] [&_h2]:text-[28px] [&_h2]:font-medium [&_h2]:tracking-[-0.01em] [&_h3]:mt-8 [&_h3]:[font-family:var(--font-newsreader),Georgia,serif] [&_h3]:text-[21px] [&_h3]:font-medium [&_li]:text-[17px] [&_li]:leading-[1.7] [&_p]:text-[17px] [&_p]:leading-[1.7]">
                <ArticleBodyBlocks blocks={article.body} />
              </div>
            </article>

            {/* Author bio */}
            {article.author ? (
              <div
                className="flex items-start gap-5 rounded-3xl border p-6 sm:p-7"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-14 flex-none items-center justify-center rounded-full text-[20px] font-semibold"
                  style={{
                    background: "var(--tint-national-bg)",
                    color: "var(--tint-national-fg)",
                  }}
                >
                  {authorInitial}
                </span>
                <div className="min-w-0">
                  <p
                    className="m-0 mb-0.5 text-[14px] font-semibold"
                    style={{ color: T.ink.dim }}
                  >
                    Written by
                  </p>
                  <p
                    className="m-0 text-[22px]"
                    style={{
                      fontFamily: T.font.serif,
                      fontWeight: 500,
                      color: T.ink.base,
                    }}
                  >
                    {article.author}
                  </p>
                  {article.authorTitle ? (
                    <p
                      className="m-0 mt-0.5 text-[14px]"
                      style={{ color: T.ink.dim }}
                    >
                      {article.authorTitle}
                    </p>
                  ) : null}
                  {article.authorBio ? (
                    <p
                      className="m-0 mt-3 text-[15px] leading-[1.6]"
                      style={{ color: T.ink.base }}
                    >
                      {article.authorBio}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Back link */}
            <GlobalLink
              href="/journal"
              className="mt-1 inline-flex w-fit items-center gap-2 text-[15px] font-semibold underline decoration-transparent underline-offset-[3px] transition-colors hover:decoration-current"
              style={{ color: T.accent.primary }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              >
                <path
                  d="M10 3L5 8l5 5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back to the journal
            </GlobalLink>
          </div>

          {/* Sidebar */}
          <aside className="top-24 flex flex-col gap-4 lg:sticky">
            {metaRows.length > 0 ? (
              <div
                className="rounded-[20px] border p-5"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
              >
                <p
                  className="m-0 mb-2 text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  About this article
                </p>
                <dl className="m-0">
                  {metaRows.map((row) => (
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
            ) : null}

            {headings.length > 0 ? (
              <nav
                aria-label="In this article"
                className="hidden rounded-[20px] border p-5 lg:block"
                style={{ background: T.bg.deep, borderColor: T.border.line }}
              >
                <p
                  className="m-0 mb-2 text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  In this article
                </p>
                <ul
                  className="m-0 flex list-none flex-col gap-1 border-l p-0 pl-3"
                  style={{ borderColor: T.border.divider }}
                >
                  {headings.map((h) => (
                    <li
                      key={h.id}
                      style={
                        h.level > 2
                          ? { paddingLeft: `${(h.level - 2) * 12}px` }
                          : undefined
                      }
                    >
                      <a
                        href={`#${h.id}`}
                        className="block py-0.5 text-[14px] leading-snug transition-colors hover:text-(--t-accent-primary)"
                        style={{ color: T.ink.dim }}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </aside>
        </div>

        {/* More from the journal */}
        {relatedCards.length > 0 ? (
          <section
            aria-labelledby="related-heading"
            className="mt-16 border-t pt-12"
            style={{ borderColor: T.border.line }}
          >
            <h2
              id="related-heading"
              className="m-0 mb-8 text-[clamp(28px,3vw,40px)] leading-[1.05]"
              style={{
                fontFamily: T.font.serif,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                color: T.ink.base,
              }}
            >
              More{" "}
              <em style={{ fontWeight: 400, color: T.accent.primary }}>
                from the journal
              </em>
            </h2>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {relatedCards.map((a) => (
                <BlogArticleCard key={a.documentId} article={a} />
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  )
}

BlogArticlePage.displayName = "BlogArticlePage"

export default BlogArticlePage
