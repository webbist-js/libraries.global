import Image from "next/image"
import type { Locale } from "next-intl"

import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { homepagePanelClassName } from "@/components/home/homepage.constants"
import type {
  WikiArticleSummary,
  WikiCategorySummary,
  WikiLandingData,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import { cn } from "@/lib/styles"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

function formatDate(dateStr?: string | null) {
  if (!dateStr) return null

  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

// ── Featured article card ──────────────────────────────────────────────────────

function FeaturedArticleCard({ article }: { article: WikiArticleSummary }) {
  if (!article.slug) return null

  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null

  return (
    <GlobalLink
      href={`/wiki/${article.slug}`}
      className={cn(
        homepagePanelClassName,
        "group relative flex min-h-[20rem] flex-col justify-end overflow-hidden transition-[border-color,box-shadow] duration-500 hover:border-cyan-200/16 hover:shadow-[0_24px_80px_rgba(6,16,40,0.55)] sm:min-h-[28rem]"
      )}
    >
      {/* Background */}
      {imgUrl ? (
        <div className="absolute inset-0">
          <Image
            src={imgUrl}
            alt={article.heroImage?.alternativeText ?? article.title ?? ""}
            fill
            className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,rgba(79,70,229,0.2),transparent_70%)]" />
      )}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,8,22,0.2)_0%,rgba(5,8,22,0.0)_25%,rgba(5,8,22,0.7)_65%,rgba(5,8,22,0.95)_100%)]" />

      <div className="relative z-10 space-y-3 p-6 sm:p-8">
        {article.category?.name ? (
          <p className="text-[10px] font-semibold tracking-[0.14em] text-cyan-300/80 uppercase">
            {article.category.name}
          </p>
        ) : null}
        <h3 className="text-2xl leading-tight font-bold tracking-tight text-white transition-[text-shadow] duration-500 group-hover:[text-shadow:0_0_30px_rgba(148,224,255,0.15)] sm:text-3xl">
          {article.title}
        </h3>
        {article.summary ? (
          <p className="line-clamp-2 max-w-xl text-sm leading-6 text-white/55">
            {article.summary}
          </p>
        ) : null}
        <p className="text-xs font-medium text-indigo-400 transition-colors group-hover:text-indigo-300">
          Read article →
        </p>
      </div>
    </GlobalLink>
  )
}

// ── Category card ──────────────────────────────────────────────────────────────

function CategoryCard({ category }: { category: WikiCategorySummary }) {
  if (!category.slug) return null

  return (
    <GlobalLink
      href={`/wiki?category=${category.slug}`}
      className={cn(
        homepagePanelClassName,
        "group flex flex-col gap-3 p-5 transition-[border-color,box-shadow,background-color] duration-500 hover:border-cyan-200/16 hover:bg-white/[0.07] hover:shadow-[0_20px_60px_rgba(6,16,40,0.4)]"
      )}
    >
      {/* Icon */}
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10">
        <span className="text-lg text-indigo-300">⬡</span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-white transition-colors group-hover:text-cyan-50">
          {category.name}
        </h3>
        {category.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/45">
            {category.description}
          </p>
        ) : null}
      </div>
    </GlobalLink>
  )
}

// ── Popular articles list ──────────────────────────────────────────────────────

function PopularArticleRow({
  article,
  index,
}: {
  article: WikiArticleSummary
  index: number
}) {
  if (!article.slug) return null

  return (
    <GlobalLink
      href={`/wiki/${article.slug}`}
      className="group flex items-start gap-5 py-5 transition-opacity duration-200 hover:opacity-80"
    >
      <span className="mt-0.5 w-5 shrink-0 text-right text-sm font-bold text-white/20 tabular-nums">
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="flex-1 space-y-1">
        <h4 className="text-sm leading-snug font-semibold text-white transition-colors group-hover:text-cyan-50">
          {article.title}
        </h4>
        {article.summary ? (
          <p className="line-clamp-2 text-xs leading-5 text-white/45">
            {article.summary}
          </p>
        ) : null}
        <div className="flex items-center gap-3 pt-0.5">
          {article.updatedAt ? (
            <span className="text-[10px] text-white/28">
              Updated: {formatDate(article.updatedAt)}
            </span>
          ) : null}
          {article.author ? (
            <>
              <span className="text-white/16">·</span>
              <span className="text-[10px] text-white/28">
                {article.author}
              </span>
            </>
          ) : null}
        </div>
      </div>
    </GlobalLink>
  )
}

// ── Stats bar ──────────────────────────────────────────────────────────────────

function StatsBar({
  stats,
}: {
  stats: { label: string; value?: string | null }[]
}) {
  return (
    <div className="grid grid-cols-2 gap-px border-t border-white/6 sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div key={i} className="flex flex-col gap-1 px-6 py-8 sm:px-10">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-white/36 uppercase">
            {stat.label}
          </span>
          <span className="text-2xl font-bold tracking-tight text-white tabular-nums">
            {stat.value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function WikiLandingPage({
  landing,
  articles,
  navbar,
  locale,
}: {
  readonly landing: WikiLandingData | null
  readonly articles: WikiArticleSummary[]
  readonly navbar?: NavbarData
  readonly locale: Locale
}) {
  const featuredArticle = landing?.featuredArticle ?? articles[0] ?? null
  const categories = landing?.featuredCategories ?? []
  const stats = landing?.stats ?? []

  const popularArticles = articles
    .filter((a) => a.slug !== featuredArticle?.slug)
    .slice(0, 8)

  return (
    <div className="relative isolate flex min-h-screen w-full flex-col overflow-x-hidden bg-[#050816] text-white">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(92,149,255,0.08),transparent_38%),radial-gradient(circle_at_78%_65%,rgba(103,221,255,0.06),transparent_32%)]" />

      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* Hero header */}
        <section className="border-b border-white/6 py-16 sm:py-24">
          <Container>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px w-5 bg-cyan-400/50" />
              <span className="text-[10px] font-semibold tracking-[0.18em] text-cyan-400/70 uppercase">
                Knowledge Hub
              </span>
            </div>
            <h1 className="text-[clamp(2.5rem,7vw,6rem)] leading-[0.95] font-bold tracking-tight text-white">
              {landing?.heroTitle ?? "Wiki"}
            </h1>
            {landing?.heroText ? (
              <p className="mt-5 max-w-xl text-base leading-7 text-white/50">
                {landing.heroText}
              </p>
            ) : null}
          </Container>
        </section>

        {/* Featured article + categories */}
        <section className="py-14 sm:py-18">
          <Container>
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
              {/* Featured article — spans 2 cols on large */}
              {featuredArticle ? (
                <div className="lg:col-span-2">
                  <p className="mb-4 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                    Featured
                  </p>
                  <FeaturedArticleCard article={featuredArticle} />
                </div>
              ) : null}

              {/* Categories */}
              {categories.length > 0 ? (
                <div className="lg:col-span-1">
                  <p className="mb-4 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                    Directories
                  </p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    {categories.slice(0, 4).map((cat) => (
                      <CategoryCard key={cat.documentId} category={cat} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Container>
        </section>

        {/* Popular documentation */}
        {popularArticles.length > 0 ? (
          <section className="border-t border-white/6 py-14 sm:py-18">
            <Container>
              <div className="mb-2">
                <p className="mb-1 text-[11px] font-semibold tracking-[0.16em] text-white/36 uppercase">
                  Documentation
                </p>
                <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Popular Articles
                </h2>
              </div>

              <div className="mt-6 grid grid-cols-1 divide-y divide-white/6 lg:grid-cols-2 lg:gap-x-12 lg:divide-y-0">
                {[
                  popularArticles.slice(
                    0,
                    Math.ceil(popularArticles.length / 2)
                  ),
                  popularArticles.slice(Math.ceil(popularArticles.length / 2)),
                ].map((col, ci) => (
                  <div key={ci} className="divide-y divide-white/6">
                    {col.map((article, i) => (
                      <PopularArticleRow
                        key={article.documentId}
                        article={article}
                        index={ci * Math.ceil(popularArticles.length / 2) + i}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </Container>
          </section>
        ) : null}

        {/* Stats */}
        {stats.length > 0 ? <StatsBar stats={stats} /> : null}
      </main>
    </div>
  )
}

WikiLandingPage.displayName = "WikiLandingPage"

export default WikiLandingPage
