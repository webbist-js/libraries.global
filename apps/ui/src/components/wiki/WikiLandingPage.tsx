import type { Locale } from "next-intl"

import {
  HeroEyebrow,
  HeroTitle,
  PageShell,
  QuickPathCard,
  SectionDomainCard,
} from "@/components/ds"
import { parseHeroText } from "@/components/ds/HeroTitle"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import type {
  WikiArticleSummary,
  WikiLandingData,
  WikiNavCategory,
  WikiSectionNav,
} from "@/lib/strapi-api/content/server"

import { WikiLatestChanges } from "./WikiLatestChanges"
import { WikiSearchBar } from "./WikiSearchBar"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// ── Main page ──────────────────────────────────────────────────────────────

export function WikiLandingPage({
  landing,
  articles,
  navCategories,
  wikiSections,
  navbar,
  locale,
}: {
  readonly landing: WikiLandingData | null
  readonly articles: WikiArticleSummary[]
  readonly navCategories: WikiNavCategory[]
  readonly wikiSections: WikiSectionNav[]
  readonly navbar?: NavbarData
  readonly locale: Locale
}) {
  const quickStartCards = Array.isArray(landing?.quickStartCards)
    ? landing.quickStartCards
    : []
  const totalArticles = articles.length
  const totalSections = wikiSections.length

  return (
    <PageShell>
      <GlobalHeader locale={locale} navbar={navbar} />

      {/* ═══════════════ HERO ═══════════════ */}
      <section
        style={{
          position: "relative",
          padding: "130px 0 60px",
          overflow: "hidden",
        }}
      >
        {/* Graticule grid */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.12,
            backgroundImage: `linear-gradient(to right,${T.border.line} 1px,transparent 1px),linear-gradient(to bottom,${T.border.line} 1px,transparent 1px)`,
            backgroundSize: "6.25% 80px",
            maskImage:
              "radial-gradient(ellipse at 80% 40%, black 10%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 80% 40%, black 10%, transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 32px" }}
        >
          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "1.3fr 0.9fr",
              gap: "56px",
              alignItems: "end",
            }}
            className="dhero-inner"
          >
            {/* Left: eyebrow + title */}
            <div>
              <HeroEyebrow
                icon="☉"
                accent={landing?.version ? `· v${landing.version}` : undefined}
              >
                {landing?.heroEyebrow ?? "Documentation"}
              </HeroEyebrow>

              <HeroTitle>
                {parseHeroText(
                  landing?.heroTitle ?? "Build, contribute, *extend* the atlas."
                )}
              </HeroTitle>
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
                <p
                  style={{
                    fontSize: "15px",
                    lineHeight: 1.68,
                    color: T.ink.dim,
                    fontWeight: 300,
                    maxWidth: "48ch",
                    margin: 0,
                  }}
                >
                  {landing.heroText}
                </p>
              ) : null}

              {/* Search bar */}
              <WikiSearchBar />

              {/* Stats row */}
              {totalArticles > 0 || totalSections > 0 ? (
                <div
                  style={{
                    display: "flex",
                    gap: "24px",
                    paddingTop: "14px",
                    borderTop: `1px solid ${T.border.line}`,
                    fontFamily: T.font.mono,
                  }}
                >
                  {totalArticles > 0 ? (
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
                        {totalArticles}
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
                  ) : null}
                  {totalSections > 0 ? (
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
                        {totalSections}
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

      {/* ═══════════════ QUICK-START PATHS ═══════════════ */}
      {quickStartCards.length > 0 ? (
        <section style={{ padding: "24px 0 10px" }}>
          <div
            style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 32px" }}
          >
            <div
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                color: T.ink.faint,
                letterSpacing: ".22em",
                textTransform: "uppercase",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "18px",
              }}
            >
              <span
                style={{
                  width: "40px",
                  height: "1px",
                  background: T.border.hi,
                  display: "inline-block",
                }}
              />
              § 00 · Quick start · for anyone
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "16px",
              }}
              className="qpaths-grid"
            >
              {quickStartCards.slice(0, 3).map((card, i) => (
                <QuickPathCard key={card.documentId} card={card} index={i} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══════════════ DOMAIN GRID ═══════════════ */}
      <section style={{ padding: "80px 0 40px" }}>
        <div
          style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 32px" }}
        >
          {/* Section header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: "28px",
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  color: T.ink.faint,
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  marginBottom: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    width: "40px",
                    height: "1px",
                    background: T.border.hi,
                    display: "inline-block",
                  }}
                />
                § 01 · Docs by domain
              </div>
              <h2
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 400,
                  fontSize: "clamp(32px,4vw,48px)",
                  lineHeight: 1,
                  letterSpacing: "-.03em",
                  margin: 0,
                  color: T.ink.base,
                }}
              >
                {wikiSections.length} rooms of{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 300,
                    color: T.ink.low,
                  }}
                >
                  the project.
                </em>
              </h2>
            </div>
            <div
              style={{
                fontFamily: T.font.mono,
                fontSize: "11px",
                color: T.ink.low,
                letterSpacing: ".16em",
                textTransform: "uppercase",
              }}
            >
              {totalSections} sections · {totalArticles} articles
            </div>
          </div>

          {/* Domain cards grid — separated by 1px lines like the design */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1px",
              background: T.border.line,
              border: `1px solid ${T.border.line}`,
              borderRadius: "20px",
              overflow: "hidden",
            }}
            className="domains-grid"
          >
            {wikiSections.map((section, i) => (
              <SectionDomainCard
                key={section.documentId}
                section={section}
                index={i}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ LATEST ARTICLES + SIDE CARDS ═══════════════ */}
      <WikiLatestChanges
        articles={articles}
        totalArticles={totalArticles}
        totalSections={totalSections}
      />

      {/* Responsive overrides via <style> */}
      <style>{`
        @media (max-width: 960px) {
          .dhero-inner { grid-template-columns: 1fr !important; }
          .split-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 900px) {
          .qpaths-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 1100px) {
          .domains-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
        @media (max-width: 640px) {
          .domains-grid { grid-template-columns: 1fr !important; }
        }
        .qpath-card:hover { border-color: var(--t-border-hi) !important; transform: translateY(-3px); }
        .qpath-card:hover .qpath-bar { opacity: 1 !important; }
        .clog-row:hover { background: var(--t-bg-surface); }
        .clog-row:last-child { border-bottom: none !important; }
      `}</style>
    </PageShell>
  )
}

WikiLandingPage.displayName = "WikiLandingPage"

export default WikiLandingPage
