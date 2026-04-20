import type { Locale } from "next-intl"

import { HeroEyebrow, HeroTitle, PageShell } from "@/components/ds"
import { parseHeroText } from "@/components/ds/HeroTitle"
import { Container } from "@/components/elementary/Container"
import GlobalHeader from "@/components/global/GlobalHeader"
import type {
  BlogArticleSummary,
  BlogLandingData,
} from "@/lib/strapi-api/content/server"

import BlogFeed from "./BlogFeed"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

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
    articles.filter((a) => a.section?.name).map((a) => a.section?.name)
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
                <HeroEyebrow>
                  {landing?.heroEyebrow ?? "THE LIBRARY JOURNAL · EST. 2026"}
                </HeroEyebrow>

                <HeroTitle>{parseHeroText(heroTitle)}</HeroTitle>
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

        {/* ── Feed (Sticky Filters + List) ─────────────────────────────── */}
        {articles.length > 0 && (
          <BlogFeed articles={articles} featuredArticle={featuredArticle} />
        )}
      </main>
    </PageShell>
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
