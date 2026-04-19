import Image from "next/image"
import type { Locale } from "next-intl"

import { PageShell } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type {
  BlogArticleSummary,
  BlogLandingData,
} from "@/lib/strapi-api/content/server"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"

import BlogArticleList from "./BlogArticleList"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// Parse *italic* word syntax from CMS title strings
function RichTitle({ text }: { readonly text: string }) {
  const parts = text.split(/(\*[^*]+\*)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} style={{ fontStyle: "italic", color: T.ink.dim }}>
              {part.slice(1, -1)}
            </em>
          )
        }

        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// ── Featured article — horizontal editorial card ──────────────────────────────

function FeaturedArticleCard({
  article,
}: {
  readonly article: BlogArticleSummary
}) {
  if (!article.slug) return null
  const imgUrl = article.heroImage?.url
    ? formatStrapiMediaUrl(article.heroImage.url)
    : null
  const initial = (article.author ?? "?").charAt(0).toUpperCase()

  return (
    <GlobalLink
      href={`/blog/${article.slug}`}
      className="group relative overflow-hidden rounded-2xl"
      style={{ background: T.bg.surface, border: `1px solid ${T.border.line}` }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr]">
        {/* Left: image */}
        <div className="relative aspect-[4/3] overflow-hidden lg:aspect-auto lg:min-h-[440px]">
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={article.heroImage?.alternativeText ?? article.title ?? ""}
              fill
              priority
              className="object-cover opacity-70 transition-transform duration-700 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="h-full w-full bg-[radial-gradient(circle_at_30%_50%,rgba(40,80,180,0.3),transparent_60%),linear-gradient(145deg,#0d1830,#060b19)]" />
          )}
          {/* Gradient bleed into text panel on large screens */}
          <div className="absolute inset-0 hidden lg:block lg:bg-[linear-gradient(90deg,transparent_55%,rgba(6,11,25,0.85)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(6,11,25,0.9)_100%)] lg:hidden" />
        </div>

        {/* Right: text */}
        <div className="flex flex-col justify-end p-8 lg:p-12">
          {article.category ? (
            <p className="mb-5 font-mono text-[10px] tracking-[0.22em] text-white/30 uppercase">
              — {article.category}
            </p>
          ) : null}

          <h2 className="mb-5 font-[family-name:var(--font-fraunces)] text-[2.1rem] leading-[1.06] font-semibold tracking-[-0.02em] text-white italic sm:text-[2.6rem]">
            {article.title}
          </h2>

          {article.summary ? (
            <p className="mb-7 line-clamp-3 text-[13px] leading-7 text-white/42">
              {article.summary}
            </p>
          ) : null}

          <div className="mb-6 flex items-center gap-3">
            <div className="flex size-7 flex-none items-center justify-center rounded-full bg-white/10">
              <span className="font-mono text-[11px] text-white/50">
                {initial}
              </span>
            </div>
            {article.author ? (
              <span className="text-[12px] text-white/40">
                {article.author}
              </span>
            ) : null}
          </div>

          <span className="text-sm font-medium text-cyan-400/75 transition-colors group-hover:text-cyan-300">
            Read article →
          </span>
        </div>
      </div>
    </GlobalLink>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

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

  // Derive stats from articles
  const totalCount = articles.length
  const authorCount = new Set(
    articles.filter((a) => a.author).map((a) => a.author)
  ).size
  const categoryCount = new Set(
    articles.filter((a) => a.category).map((a) => a.category)
  ).size

  const heroTitle = landing?.heroTitle ?? "Field *notes* from the stacks."

  return (
    <PageShell className="flex flex-col">
      <GlobalHeader locale={locale} navbar={navbar} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section className="border-b border-white/6 py-20 sm:py-28">
          <Container>
            <div className="grid grid-cols-1 gap-14 lg:grid-cols-[1fr_280px] lg:items-end lg:gap-20">
              {/* Left: big title */}
              <div>
                <p className="mb-6 font-mono text-[11px] tracking-[0.22em] text-white/30 uppercase">
                  {landing?.heroEyebrow ?? "THE LIBRARY JOURNAL"}
                </p>
                <h1 className="font-[family-name:var(--font-fraunces)] text-[clamp(4rem,10vw,8rem)] leading-[0.9] font-semibold tracking-[-0.025em] text-white">
                  <RichTitle text={heroTitle} />
                </h1>
              </div>

              {/* Right: description + stats */}
              <div className="lg:pb-4">
                {landing?.heroText ? (
                  <p className="mb-8 text-[13px] leading-7 text-white/45">
                    {landing.heroText}
                  </p>
                ) : null}

                {totalCount > 0 ? (
                  <div className="flex items-baseline gap-4">
                    <div>
                      <p className="font-[family-name:var(--font-fraunces)] text-[2.6rem] leading-none font-light text-white tabular-nums">
                        {totalCount}
                      </p>
                      <p className="mt-1.5 font-mono text-[9px] tracking-[0.2em] text-white/28 uppercase">
                        Articles
                      </p>
                    </div>

                    {authorCount > 1 ? (
                      <>
                        <span className="pb-2 text-white/18">·</span>
                        <div>
                          <p className="font-[family-name:var(--font-fraunces)] text-[2.6rem] leading-none font-light text-white tabular-nums">
                            {authorCount}
                          </p>
                          <p className="mt-1.5 font-mono text-[9px] tracking-[0.2em] text-white/28 uppercase">
                            Writers
                          </p>
                        </div>
                      </>
                    ) : null}

                    {categoryCount > 1 ? (
                      <>
                        <span className="pb-2 text-white/18">·</span>
                        <div>
                          <p className="font-[family-name:var(--font-fraunces)] text-[2.6rem] leading-none font-light text-white tabular-nums">
                            {categoryCount}
                          </p>
                          <p className="mt-1.5 font-mono text-[9px] tracking-[0.2em] text-white/28 uppercase">
                            Topics
                          </p>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </Container>
        </section>

        {/* ── Featured article ───────────────────────────────────────────── */}
        {featuredArticle ? (
          <section className="border-b border-white/6 py-12 sm:py-16">
            <Container>
              <p className="mb-6 font-mono text-[10px] tracking-[0.22em] text-white/28 uppercase">
                — Featured this issue
              </p>
              <FeaturedArticleCard article={featuredArticle} />
            </Container>
          </section>
        ) : null}

        {/* ── Latest dispatches ─────────────────────────────────────────── */}
        {articles.length > 0 ? (
          <section className="py-14 sm:py-20">
            <Container>
              <div className="mb-10">
                <h2 className="font-[family-name:var(--font-fraunces)] text-[2.4rem] leading-[1.05] font-semibold tracking-[-0.02em] text-white sm:text-[3rem]">
                  Latest <em className="text-white/60 italic">dispatches</em>
                </h2>
              </div>
              <BlogArticleList articles={articles} />
            </Container>
          </section>
        ) : null}
      </main>
    </PageShell>
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
