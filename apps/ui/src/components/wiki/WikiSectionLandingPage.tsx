import type { Locale } from "next-intl"

import {
  HeroEyebrow,
  HeroLead,
  HeroTitle,
  PageShell,
  StickySubNav,
} from "@/components/ds"
import { parseHeroText } from "@/components/ds/HeroTitle"
import GlobalHeader from "@/components/global/GlobalHeader"
import { DotHeroCanvas } from "@/components/ui/DotHeroCanvas"
import { T } from "@/lib/design-tokens"
import type { WikiSectionNav } from "@/lib/strapi-api/content/server"

import { WikiLatestChanges } from "./WikiLatestChanges"
import { WikiSectionFeed } from "./WikiSectionFeed"

export function WikiSectionLandingPage({
  section,
  allSections = [],
  locale,
}: {
  readonly section: WikiSectionNav
  readonly allSections?: WikiSectionNav[]
  readonly locale: Locale
}) {
  const articles = section.articles || []
  const totalArticles = articles.length

  const sectionTabs = [
    { id: "all", label: "All sections", href: "/wiki" as const },
    ...allSections.map((s) => ({
      id: s.slug,
      label: s.name,
      href: `/wiki/${s.slug}` as const,
    })),
  ]

  return (
    <PageShell>
      <GlobalHeader locale={locale} />

      {/* ═══════════════ HERO ═══════════════ */}
      <section
        style={{
          position: "relative",
          padding: "130px 0 60px",
          overflow: "hidden",
        }}
      >
        <DotHeroCanvas variant="knowledge" />
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
            className="dhero-inner"
          >
            <div>
              <HeroEyebrow icon="☉">Wiki Section</HeroEyebrow>

              <HeroTitle>
                {parseHeroText(`*${section.name}* documents and references.`)}
              </HeroTitle>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                paddingBottom: "24px",
              }}
            >
              {section.description ? (
                <HeroLead maxWidth="48ch">{section.description}</HeroLead>
              ) : null}

              {totalArticles > 0 ? (
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
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ SECTIONS SUBNAV ═══════════════ */}
      {sectionTabs.length > 0 && (
        <StickySubNav tabs={sectionTabs} activeId={section.slug} />
      )}

      {/* ═══════════════ FEED (FILTER BAR + LISTING) ═══════════════ */}
      {articles.length > 0 ? (
        <WikiSectionFeed section={section} articles={articles} />
      ) : null}

      {/* ═══════════════ LATEST CHANGES ═══════════════ */}
      {articles.length > 0 ? (
        <WikiLatestChanges
          articles={articles.map((a) => ({ ...a, section })) as any}
          title={`§ 02 · Latest in ${section.name}`}
          totalArticles={totalArticles}
        />
      ) : null}

      <style>{`
        @media (max-width: 960px) {
          .dhero-inner { grid-template-columns: 1fr !important; }
          .split-grid { grid-template-columns: 1fr !important; }
        }
        .clog-row:hover { background: var(--t-bg-surface); }
        .clog-row:last-child { border-bottom: none !important; }
      `}</style>
    </PageShell>
  )
}

WikiSectionLandingPage.displayName = "WikiSectionLandingPage"

export default WikiSectionLandingPage
