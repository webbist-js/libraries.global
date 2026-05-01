import type { Locale } from "next-intl"

import { HeroEyebrow, HeroTitle, PageShell } from "@/components/ds"
import { parseHeroText } from "@/components/ds/HeroTitle"
import GlobalHeader from "@/components/global/GlobalHeader"
import { T } from "@/lib/design-tokens"
import type { WikiSectionNav } from "@/lib/strapi-api/content/server"

import { WikiLatestChanges } from "./WikiLatestChanges"
import { WikiSectionFeed } from "./WikiSectionFeed"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

export function WikiSectionLandingPage({
  section,
  navbar,
  locale,
}: {
  readonly section: WikiSectionNav
  readonly navbar?: NavbarData
  readonly locale: Locale
}) {
  const articles = section.articles || []
  const totalArticles = articles.length

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
                  {section.description}
                </p>
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
