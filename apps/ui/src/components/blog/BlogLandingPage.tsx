import type { Locale } from "next-intl"

import { HeroEyebrow, HeroLead, HeroTitle, PageShell } from "@/components/ds"
import { parseHeroText } from "@/components/ds/HeroTitle"
import GlobalHeader from "@/components/global/GlobalHeader"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"
import type {
  BlogArticleSummary,
  BlogLandingData,
  BlogSection,
} from "@/lib/strapi-api/content/server"

import BlogFeed from "./BlogFeed"
import { BlogSearchBar } from "./BlogSearchBar"

// ── Main page ─────────────────────────────────────────────────────────────────

export function BlogLandingPage({
  landing,
  articles,
  sections,
  locale,
}: {
  readonly landing: BlogLandingData | null
  readonly articles: BlogArticleSummary[]
  readonly sections: BlogSection[]
  readonly locale: Locale
}) {
  const featuredArticle = landing?.featuredArticle ?? articles[0] ?? null
  const totalCount = articles.length

  const heroTitle = landing?.heroTitle ?? "Field *notes* from the stacks."

  return (
    <PageShell className="flex flex-col">
      <GlobalHeader locale={locale} />

      <main className="relative z-10 flex-1">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            padding: "130px 0 60px",
            overflow: "hidden",
          }}
        >
          <DotHeroCanvas variant="journal" />
          {/* Vignette */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 110% 90% at 50% 50%, transparent 25%, var(--t-bg-space) 80%)",
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              maxWidth: "1296px",
              margin: "0 auto",
              padding: "0 24px",
              position: "relative",
              zIndex: 10,
            }}
          >
            <div
              style={{
                position: "relative",
                display: "grid",
                gridTemplateColumns: "1.3fr 0.9fr",
                gap: "56px",
                alignItems: "end",
              }}
              className="bhero-inner"
            >
              {/* Left: eyebrow + title */}
              <div>
                <HeroEyebrow icon="✦">
                  {landing?.heroEyebrow ?? "THE LIBRARY JOURNAL · EST. 2026"}
                </HeroEyebrow>

                <HeroTitle>{parseHeroText(heroTitle)}</HeroTitle>
              </div>

              {/* Right: description + search + stats */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                  paddingBottom: "24px",
                }}
              >
                {landing?.heroText ? (
                  <HeroLead maxWidth="48ch">{landing.heroText}</HeroLead>
                ) : null}

                {/* Search bar */}
                <BlogSearchBar />

                {/* Stats row */}
                {totalCount > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      gap: "24px",
                      paddingTop: "14px",
                      borderTop: `1px solid ${T.border.line}`,
                      fontFamily: T.font.mono,
                    }}
                  >
                    <div>
                      <b
                        style={{
                          display: "block",
                          fontFamily: T.font.serif,
                          fontSize: "22px",
                          color: T.ink.base,
                          letterSpacing: "-.02em",
                          fontWeight: 400,
                        }}
                      >
                        {totalCount}
                      </b>
                      <span
                        style={{
                          fontSize: "11px",
                          color: T.ink.low,
                          letterSpacing: ".12em",
                          textTransform: "uppercase",
                        }}
                      >
                        articles
                      </span>
                    </div>
                    {sections.length > 0 ? (
                      <div>
                        <b
                          style={{
                            display: "block",
                            fontFamily: T.font.serif,
                            fontSize: "22px",
                            color: T.ink.base,
                            letterSpacing: "-.02em",
                            fontWeight: 400,
                          }}
                        >
                          {sections.length}
                        </b>
                        <span
                          style={{
                            fontSize: "11px",
                            color: T.ink.low,
                            letterSpacing: ".12em",
                            textTransform: "uppercase",
                          }}
                        >
                          sections
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ── Feed (Sticky Filters + List) ─────────────────────────────── */}
        {articles.length > 0 && (
          <BlogFeed
            articles={articles}
            featuredArticle={featuredArticle}
            sections={sections}
          />
        )}
      </main>

      {/* Responsive overrides */}
      <style>{`
        @media (max-width: 960px) {
          .bhero-inner { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </PageShell>
  )
}

BlogLandingPage.displayName = "BlogLandingPage"

export default BlogLandingPage
