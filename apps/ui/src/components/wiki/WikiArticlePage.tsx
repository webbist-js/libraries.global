import Image from "next/image"
import type { Locale } from "next-intl"

import { ArticleBodyBlocks } from "@/components/blog/ArticleBodyBlocks"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import type {
  WikiArticleDetail,
  WikiArticleSummary,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null

  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

// ── Related article card ───────────────────────────────────────────────────────

function RelatedArticleCard({ article }: { article: WikiArticleSummary }) {
  if (!article.slug) return null

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  return (
    <GlobalLink
      href={`/wiki/${article.slug}`}
      className={cn(
        homepagePanelClassName,
        "group flex flex-col overflow-hidden transition-[border-color,box-shadow,background-color] duration-500 hover:border-cyan-200/16 hover:bg-white/[0.07]"
      )}
    >
      {imgUrl ? (
        <div className="relative aspect-video overflow-hidden">
          <Image
            src={imgUrl}
            alt={article.heroImage?.alternativeText ?? article.title ?? ""}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        </div>
      ) : (
        <div className="aspect-video bg-white/4" />
      )}
      <div className="flex flex-col gap-2 p-4">
        {article.category?.name ? (
          <p className="text-[10px] font-semibold tracking-[0.12em] text-cyan-300/70 uppercase">
            {article.category.name}
          </p>
        ) : null}
        <h4 className="text-sm leading-snug font-semibold text-white transition-colors group-hover:text-cyan-50">
          {article.title}
        </h4>
        {article.summary ? (
          <p className="line-clamp-2 text-xs leading-5 text-white/45">
            {article.summary}
          </p>
        ) : null}
      </div>
    </GlobalLink>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function WikiArticlePage({
  article,
  navbar,
  locale,
}: {
  readonly article: WikiArticleDetail | null
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

  const related = article.relatedArticles ?? []

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
              <div className="mb-6 flex flex-wrap items-center gap-1.5 text-xs text-white/36">
                <GlobalLink
                  href="/wiki"
                  className="transition-colors hover:text-white/65"
                >
                  Wiki
                </GlobalLink>
                {article.category?.name ? (
                  <>
                    <span className="text-white/20">›</span>
                    <GlobalLink
                      href={`/wiki?category=${article.category.slug}`}
                      className="transition-colors hover:text-white/65"
                    >
                      {article.category.name}
                    </GlobalLink>
                  </>
                ) : null}
              </div>

              {/* Category eyebrow */}
              {article.category?.name ? (
                <p className="mb-3 text-[10px] font-semibold tracking-[0.16em] text-cyan-400/70 uppercase">
                  {article.category.name}
                </p>
              ) : null}

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

              {/* Meta row */}
              <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-white/6 pt-5 text-xs text-white/30">
                {article.author ? (
                  <span className="text-white/45">{article.author}</span>
                ) : null}
                {article.updatedAt ? (
                  <span>Updated: {formatDate(article.updatedAt)}</span>
                ) : null}
              </div>
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

        {/* Article body + sidebar */}
        <section className="py-14 sm:py-18">
          <Container>
            <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_280px]">
              {/* Body */}
              <div className="min-w-0">
                <ArticleBodyBlocks blocks={article.body} />
              </div>

              {/* Sidebar — related articles */}
              {related.length > 0 ? (
                <aside className="space-y-4">
                  <p className="text-[10px] font-semibold tracking-[0.14em] text-white/36 uppercase">
                    Related articles
                  </p>
                  <div className="space-y-3">
                    {related.slice(0, 4).map((r) => (
                      <RelatedArticleCard key={r.documentId} article={r} />
                    ))}
                  </div>
                </aside>
              ) : null}
            </div>
          </Container>
        </section>
      </main>
    </div>
  )
}

WikiArticlePage.displayName = "WikiArticlePage"

export default WikiArticlePage
