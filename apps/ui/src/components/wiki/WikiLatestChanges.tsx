import { ArticleChangelogRow, ContribAvatar } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { WikiArticleSummary } from "@/lib/strapi-api/content/server"

export function WikiLatestChanges({
  articles,
  totalArticles,
  totalSections,
  title = "§ 02 · Latest changes",
}: {
  readonly articles: WikiArticleSummary[]
  readonly totalArticles: number
  readonly totalSections?: number
  readonly title?: string
}) {
  if (articles.length === 0) return null

  return (
    <section style={{ padding: "40px 0 80px" }}>
      <div style={{ maxWidth: "1296px", margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: "32px",
            alignItems: "start",
          }}
          className="split-grid"
        >
          {/* Left: changelog-style article list */}
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "18px",
              overflow: "hidden",
              background: T.bg.surface,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "18px 22px",
                borderBottom: `1px solid ${T.border.line}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontFamily: T.font.mono,
                fontSize: "11px",
                letterSpacing: ".18em",
                textTransform: "uppercase",
                color: T.ink.low,
              }}
            >
              <span>{title}</span>
              <span
                style={{
                  color: T.accent.ok,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    background: "currentColor",
                    boxShadow: `0 0 8px currentColor`,
                    display: "inline-block",
                  }}
                />
                Live · main
              </span>
            </div>

            {/* Article rows */}
            {articles.slice(0, 6).map((article, i) => (
              <ArticleChangelogRow
                key={article.documentId}
                article={article}
                index={i}
              />
            ))}
          </div>

          {/* Right: side cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {/* Contributors placeholder */}
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "16px",
                padding: "20px",
                background: T.bg.surface,
              }}
            >
              <h4
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: T.ink.low,
                  margin: "0 0 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                Top contributors · this month
                <span
                  style={{
                    flex: 1,
                    height: "1px",
                    background: T.border.line,
                    display: "inline-block",
                  }}
                />
              </h4>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {[
                  "LG",
                  "AB",
                  "MK",
                  "SP",
                  "JD",
                  "RT",
                  "EV",
                  "PL",
                  "NW",
                  "+18",
                ].map((init, i) => (
                  <ContribAvatar key={init} initials={init} index={i} />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "16px",
                padding: "20px",
                background: T.bg.surface,
              }}
            >
              <h4
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".22em",
                  textTransform: "uppercase",
                  color: T.ink.low,
                  margin: "0 0 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                At a glance
                <span
                  style={{
                    flex: 1,
                    height: "1px",
                    background: T.border.line,
                    display: "inline-block",
                  }}
                />
              </h4>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1px",
                  background: T.border.line,
                  borderRadius: "10px",
                  overflow: "hidden",
                  border: `1px solid ${T.border.line}`,
                }}
              >
                {[
                  { n: totalArticles, l: "Doc pages" },
                  ...(totalSections !== undefined
                    ? [{ n: totalSections, l: "Sections" }]
                    : []),
                  { n: "OSS", l: "Open source" },
                  { n: "Free", l: "Always" },
                ].map(({ n, l }) => (
                  <div
                    key={l}
                    style={{ padding: "14px", background: T.bg.deep }}
                  >
                    <div
                      style={{
                        fontFamily: T.font.serif,
                        fontSize: "24px",
                        letterSpacing: "-.02em",
                        color: T.ink.base,
                      }}
                    >
                      {n}
                    </div>
                    <div
                      style={{
                        fontFamily: T.font.mono,
                        fontSize: "10px",
                        color: T.ink.low,
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        marginTop: "3px",
                      }}
                    >
                      {l}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                background: `linear-gradient(140deg,rgba(127,223,255,.08),rgba(163,144,255,.06))`,
                border: `1px solid ${T.border.hi}`,
                borderRadius: "16px",
                padding: "20px",
                position: "relative",
              }}
            >
              <h3
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 400,
                  fontSize: "20px",
                  margin: "0 0 8px",
                  letterSpacing: "-.02em",
                  color: T.ink.base,
                }}
              >
                Stay updated
              </h3>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: 1.55,
                  color: T.ink.low,
                  margin: "0 0 16px",
                  maxWidth: "90%",
                }}
              >
                Get notified when major additions land in the wiki.
              </p>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <GlobalLink
                  href="/subscribe"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 14px",
                    borderRadius: "10px",
                    fontSize: "12px",
                    background: T.ink.base,
                    color: "#0a0b10",
                    textDecoration: "none",
                    fontWeight: 500,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{ opacity: 0.8 }}
                  >
                    <path d="m22 2-7 20-4-9-9-4Z" />
                    <path d="M22 2 11 13" />
                  </svg>
                  Subscribe to journal
                </GlobalLink>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
