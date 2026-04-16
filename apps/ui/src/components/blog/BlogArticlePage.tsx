import Image from "next/image"
import type { Locale } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { BlogArticleCard } from "@/components/blog/BlogArticleCard"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import type {
  BlogArticleDetail,
  BlogArticleSummary,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

const categoryColors: Record<string, string> = {
  Research: "text-indigo-300 border-indigo-400/30 bg-indigo-500/10",
  Tech: "text-cyan-300 border-cyan-400/30 bg-cyan-500/10",
  Culture: "text-amber-300 border-amber-400/30 bg-amber-500/10",
  Editorial: "text-purple-300 border-purple-400/30 bg-purple-500/10",
  Preservation: "text-emerald-300 border-emerald-400/30 bg-emerald-500/10",
  Ethics: "text-rose-300 border-rose-400/30 bg-rose-500/10",
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null

  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

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
      <div className="relative isolate flex min-h-screen w-full flex-col bg-[#050816] text-white">
        <GlobalHeader locale={locale} navbar={navbar} />
        <main className="flex flex-1 items-center justify-center">
          <p className="text-white/40">Article not found.</p>
        </main>
      </div>
    )
  }

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  const categoryClass = article.category
    ? (categoryColors[article.category] ??
      "text-white/50 border-white/16 bg-white/6")
    : null

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050816] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(92,149,255,0.08),transparent_34%),radial-gradient(circle_at_75%_60%,rgba(103,221,255,0.06),transparent_28%)]" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* Article header */}
        <section className="border-b border-white/6 py-14 sm:py-20">
          <Container>
            <div className="mx-auto max-w-3xl">
              {/* Breadcrumb */}
              <div className="mb-6 flex items-center gap-1.5 text-xs text-white/36">
                <GlobalLink
                  href="/blog"
                  className="transition-colors hover:text-white/65"
                >
                  Blog
                </GlobalLink>
                <span className="text-white/20">›</span>
                {article.category ? (
                  <span className="text-white/50">{article.category}</span>
                ) : null}
              </div>

              {/* Category + meta row */}
              <div className="mb-5 flex flex-wrap items-center gap-3">
                {article.category && categoryClass ? (
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase",
                      categoryClass
                    )}
                  >
                    {article.category}
                  </span>
                ) : null}
                {article.author ? (
                  <span className="text-xs text-white/40">
                    {article.author}
                  </span>
                ) : null}
                <span className="text-xs text-white/28">
                  {formatDate(article.publishedAt ?? article.updatedAt)}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-[clamp(1.75rem,4vw,3rem)] leading-[1.1] font-bold tracking-tight text-white">
                {article.title}
              </h1>

              {/* Summary */}
              {article.summary ? (
                <p className="mt-5 text-lg leading-8 text-white/55">
                  {article.summary}
                </p>
              ) : null}
            </div>
          </Container>
        </section>

        {/* Hero image */}
        {imgUrl ? (
          <div className="relative aspect-[21/9] w-full overflow-hidden">
            <Image
              src={imgUrl}
              alt={article.heroImage?.alternativeText ?? article.title ?? ""}
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.2)_0%,transparent_30%,transparent_70%,rgba(5,8,22,0.4)_100%)]" />
          </div>
        ) : null}

        {/* Article body */}
        <section className="py-14 sm:py-18">
          <Container>
            <div className="mx-auto max-w-3xl">
              <ArticleBodyBlocks blocks={article.body} />
            </div>
          </Container>
        </section>

        {/* Related articles */}
        {related && related.length > 0 ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mb-8">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  Continue reading
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  More articles
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.slice(0, 3).map((a) => (
                  <BlogArticleCard
                    key={a.documentId}
                    article={a}
                    locale={locale}
                  />
                ))}
              </div>
            </Container>
          </section>
        ) : null}
      </main>
    </div>
  )
}

BlogArticlePage.displayName = "BlogArticlePage"

export default BlogArticlePage
