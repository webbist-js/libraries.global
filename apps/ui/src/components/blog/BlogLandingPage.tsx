import Image from "next/image"
import type { Locale } from "next-intl"

import {
  BlogArticleCard,
  BlogArticleCardWide,
} from "@/components/blog/BlogArticleCard"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import type {
  BlogArticleSummary,
  BlogLandingData,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

const CATEGORIES = [
  "All",
  "Research",
  "Tech",
  "Culture",
  "Editorial",
  "Preservation",
  "Ethics",
] as const

// ── Featured hero article ──────────────────────────────────────────────────────

function FeaturedHero({
  article,
  landing,
}: {
  article: BlogArticleSummary
  landing: BlogLandingData
}) {
  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  return (
    <section className="relative isolate flex min-h-[72vh] flex-col justify-end overflow-hidden">
      {/* Background image */}
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
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(79,70,229,0.22),transparent_70%)]" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.4)_0%,rgba(5,8,22,0.0)_30%,rgba(5,8,22,0.0)_40%,rgba(5,8,22,0.85)_80%,rgba(5,8,22,1)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,8,22,0.6)_0%,transparent_60%)]" />

      <Container className="relative pt-32 pb-14 sm:pb-20">
        <div className="max-w-2xl space-y-5">
          {/* Eyebrow */}
          <div className="flex items-center gap-3">
            {article.category ? (
              <span className="inline-flex items-center rounded-full border border-indigo-400/30 bg-indigo-500/12 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-indigo-300 uppercase">
                {article.category}
              </span>
            ) : null}
            <span className="text-[10px] font-medium tracking-[0.12em] text-white/36 uppercase">
              Featured
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] font-bold tracking-tight text-white">
            {article.title}
          </h1>

          {/* Summary */}
          {article.summary ? (
            <p className="max-w-xl text-base leading-7 text-white/60">
              {article.summary}
            </p>
          ) : null}

          {/* CTA */}
          {article.slug ? (
            <div className="flex items-center gap-4 pt-1">
              <GlobalLink
                href={`/blog/${article.slug}`}
                className="inline-flex items-center gap-2 rounded-2xl bg-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_4px_24px_rgba(99,102,241,0.35)] transition-colors hover:bg-indigo-400"
              >
                Read article
              </GlobalLink>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  )
}

// ── Category filter ────────────────────────────────────────────────────────────

function CategoryFilters({
  active,
  counts,
}: {
  active: string
  counts?: Record<string, number>
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          className={cn(
            "rounded-full border px-4 py-1.5 text-xs font-medium transition-all duration-200",
            active === cat
              ? "border-indigo-400/40 bg-indigo-500/16 text-indigo-200"
              : "border-white/10 bg-white/4 text-white/50 hover:border-white/20 hover:bg-white/8 hover:text-white/75"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

// ── Article list section ───────────────────────────────────────────────────────

function ArticleGrid({
  articles,
  locale,
  featuredSlug,
}: {
  articles: BlogArticleSummary[]
  locale: Locale
  featuredSlug?: string | null
}) {
  // Exclude the featured hero article from the main grid
  const rest = articles.filter((a) => a.slug !== featuredSlug)

  if (rest.length === 0) return null

  const [primary, ...secondary] = rest

  return (
    <div className="space-y-4">
      {/* Large first article */}
      {primary ? <BlogArticleCard article={primary} locale={locale} /> : null}

      {/* Secondary grid */}
      {secondary.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {secondary.map((article) => (
            <BlogArticleCard
              key={article.documentId}
              article={article}
              locale={locale}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ── Sidebar recent ─────────────────────────────────────────────────────────────

function SidebarRecent({
  articles,
  locale,
}: {
  articles: BlogArticleSummary[]
  locale: Locale
}) {
  if (articles.length === 0) return null

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-semibold tracking-[0.14em] text-white/36 uppercase">
        Latest
      </p>
      <div className="space-y-3">
        {articles.slice(0, 5).map((article) => (
          <BlogArticleCardWide
            key={article.documentId}
            article={article}
            locale={locale}
          />
        ))}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function BlogLandingPage({
  landing,
  articles,
  navbar,
  locale,
}: {
  readonly landing: BlogLandingData | null
  readonly articles: BlogArticleSummary[]
  readonly navbar?: NavbarData
  readonly locale: Locale
}) {
  const featuredArticle = landing?.featuredArticle ?? articles[0] ?? null
  const featuredSlug = featuredArticle?.slug

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050816] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_85%,rgba(92,149,255,0.07),transparent_40%),radial-gradient(circle_at_85%_15%,rgba(103,221,255,0.05),transparent_35%)]" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* Hero */}
        {featuredArticle ? (
          <FeaturedHero article={featuredArticle} landing={landing ?? {}} />
        ) : (
          <section className="relative isolate flex min-h-[40vh] flex-col justify-end overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(79,70,229,0.18),transparent_70%)]" />
            <Container className="relative pt-32 pb-14 sm:pb-20">
              <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-indigo-400/70 uppercase">
                The Library Blog
              </p>
              <h1 className="text-[clamp(2.5rem,6vw,5rem)] leading-[1.0] font-bold tracking-tight text-white">
                {landing?.heroTitle ?? "Editorial"}
              </h1>
              {landing?.heroText ? (
                <p className="mt-4 max-w-xl text-base text-white/55">
                  {landing.heroText}
                </p>
              ) : null}
            </Container>
          </section>
        )}

        {/* Articles section */}
        <section className="border-t border-white/6 py-14 sm:py-18">
          <Container>
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="mb-1 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  All Articles
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Latest Stories
                </h2>
              </div>
            </div>

            <div className="mb-8">
              <CategoryFilters active="All" />
            </div>

            <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
              {/* Main grid */}
              <div className="lg:col-span-2">
                <ArticleGrid
                  articles={articles}
                  locale={locale}
                  featuredSlug={featuredSlug}
                />
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-1">
                <SidebarRecent articles={articles} locale={locale} />
              </div>
            </div>
          </Container>
        </section>
      </main>
    </div>
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
