import type { Locale } from "next-intl"

import { Badge, PageShell } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type {
  WikiArticleSummary,
  WikiCategorySummary,
  WikiLandingData,
  WikiNavCategory,
} from "@/lib/strapi-api/content/server"

type NavbarData = Parameters<typeof GlobalHeader>[0]["navbar"]

// ── Quick-start card ───────────────────────────────────────────────────────

// Quick-start path icons (SVG strings, matched to design)
const PATH_ICONS = [
  <svg
    key="0"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <path d="M4 7h16M4 12h16M4 17h10" />
  </svg>,
  <svg
    key="1"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <polyline points="4 17 10 11 4 5" />
    <path d="M12 19h8" />
  </svg>,
  <svg
    key="2"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
  >
    <path d="M2 12h4l3-9 4 18 3-9h6" />
  </svg>,
]

const QUICK_LABELS = ["Start here", "Dev setup", "API quick-start"]

function QuickPathCard({
  card,
  index,
}: {
  readonly card: WikiArticleSummary
  readonly index: number
}) {
  const Inner = (
    <div
      style={{
        position: "relative",
        padding: "22px",
        border: `1px solid ${T.border.line}`,
        borderRadius: "16px",
        background: "rgba(255,255,255,.02)",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        minHeight: "168px",
        overflow: "hidden",
        transition:
          "border-color 200ms, transform 300ms cubic-bezier(.2,.7,.2,1)",
      }}
      className="qpath-card group"
    >
      {/* Top gradient bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg,${T.accent.aurora},${T.accent.violet})`,
          opacity: 0.5,
          transition: "opacity 200ms",
        }}
        className="qpath-bar"
      />
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "9px",
            background: "rgba(127,223,255,.1)",
            border: "1px solid rgba(127,223,255,.25)",
            display: "grid",
            placeItems: "center",
            color: T.accent.aurora,
          }}
        >
          {PATH_ICONS[index % PATH_ICONS.length]}
        </div>
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.low,
            letterSpacing: ".14em",
            textTransform: "uppercase" as const,
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ~ 10 min
        </div>
      </div>
      {/* Title + desc */}
      <h3
        style={{
          fontFamily: T.font.serif,
          fontWeight: 400,
          fontSize: "22px",
          lineHeight: 1.15,
          letterSpacing: "-.02em",
          margin: 0,
          color: T.ink.base,
        }}
      >
        {card.title ?? "—"}
      </h3>
      {card.summary ? (
        <p
          style={{
            fontSize: "13px",
            color: T.ink.low,
            lineHeight: 1.55,
            margin: 0,
            fontWeight: 300,
          }}
        >
          {card.summary}
        </p>
      ) : null}
      {/* Footer arrow */}
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          color: T.accent.aurora,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginTop: "auto",
        }}
      >
        <span>{QUICK_LABELS[index % QUICK_LABELS.length]}</span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <span
            style={{
              display: "inline-block",
              width: "18px",
              height: "1px",
              background: "currentColor",
              position: "relative",
              verticalAlign: "middle",
            }}
          />
          <svg
            width="7"
            height="7"
            viewBox="0 0 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            style={{ marginLeft: "-1px" }}
          >
            <path d="M0 7 L7 0 M0 0 L7 0 L7 7" />
          </svg>
        </span>
      </div>
    </div>
  )

  if (!card.slug) return Inner

  return (
    <GlobalLink href={`/wiki/${card.slug}`} className="block">
      {Inner}
    </GlobalLink>
  )
}

// ── Domain card ────────────────────────────────────────────────────────────

function DomainCard({
  category,
  index,
}: {
  readonly category: WikiCategorySummary
  readonly index: number
}) {
  if (!category.slug) return null
  const subtopics = Array.isArray(category.subTopics)
    ? (category.subTopics as string[])
    : []

  return (
    <GlobalLink
      href={`/wiki?category=${category.slug}`}
      className="group"
      style={{
        background: T.bg.deep,
        padding: "26px 22px 22px",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        cursor: "pointer",
        transition: "background 300ms",
        minHeight: "260px",
        textDecoration: "none",
      }}
    >
      {/* Index number */}
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          color: T.ink.faint,
          letterSpacing: ".2em",
        }}
      >
        § 0{index + 1}
      </div>

      {/* Tag label */}
      {category.tagLabel ? (
        <Badge
          label={category.tagLabel}
          color={
            (
              [
                "aurora",
                "ember",
                "ok",
                "violet",
                "gold",
                "aurora",
                "ember",
                "ok",
              ] as const
            )[index % 8]!
          }
        />
      ) : null}

      {/* Category title */}
      <div
        style={{
          fontFamily: T.font.serif,
          fontWeight: 400,
          fontSize: "24px",
          lineHeight: 1.1,
          letterSpacing: "-.02em",
          color: T.ink.base,
        }}
      >
        {category.name}
      </div>

      {/* Description */}
      {category.description ? (
        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.55,
            color: T.ink.low,
            fontWeight: 300,
          }}
        >
          {category.description}
        </div>
      ) : null}

      {/* Subtopics bullet list */}
      {subtopics.length > 0 ? (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "auto 0 0",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            borderTop: `1px dashed ${T.border.line}`,
            paddingTop: "12px",
          }}
        >
          {subtopics.slice(0, 4).map((topic, i) => (
            <li
              key={i}
              style={{
                fontFamily: T.font.mono,
                fontSize: "11px",
                color: T.ink.dim,
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <span
                style={{
                  width: "3px",
                  height: "3px",
                  borderRadius: "50%",
                  background: T.accent.aurora,
                  flexShrink: 0,
                }}
              />
              {topic}
            </li>
          ))}
        </ul>
      ) : null}
    </GlobalLink>
  )
}

// ── Latest article row (changelog-style) ──────────────────────────────────

function ArticleChangelogRow({
  article,
  index,
}: {
  readonly article: WikiArticleSummary
  readonly index: number
}) {
  if (!article.slug) return null
  const FALLBACK_LABELS = [
    "GUIDE",
    "DOCS",
    "REF",
    "FEAT",
    "FIX",
    "API",
  ] as const
  const BADGE_COLORS = [
    "aurora",
    "gold",
    "ok",
    "aurora",
    "violet",
    "ok",
  ] as const
  const rawLabel = article.category?.name ?? FALLBACK_LABELS[index % 6]!
  const label: string = rawLabel.length > 10 ? rawLabel.slice(0, 10) : rawLabel
  const badgeColor = BADGE_COLORS[index % 6]!

  return (
    <GlobalLink
      href={`/wiki/${article.slug}`}
      style={{
        display: "grid",
        gridTemplateColumns: "100px auto 1fr",
        gap: "16px",
        padding: "14px 22px",
        borderBottom: `1px solid ${T.border.line}`,
        alignItems: "start",
        fontSize: "13px",
        textDecoration: "none",
        transition: "background 150ms",
      }}
      className="clog-row group"
    >
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          color: T.ink.faint,
          letterSpacing: ".12em",
          textTransform: "uppercase" as const,
          paddingTop: "3px",
        }}
      >
        {article.updatedAt
          ? new Date(article.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "—"}
      </div>
      <Badge label={label} color={badgeColor} />
      <div
        style={{
          color: T.ink.base,
          fontSize: "13px",
          lineHeight: 1.45,
          transition: "color 150ms",
        }}
      >
        {article.title}
      </div>
    </GlobalLink>
  )
}

// ── Contributor avatar ─────────────────────────────────────────────────────

const AVATAR_GRADIENTS = [
  `linear-gradient(135deg,${T.accent.aurora},${T.accent.violet})`,
  `linear-gradient(135deg,${T.accent.ember},${T.accent.gold})`,
  `linear-gradient(135deg,${T.accent.violet},#c4b5ff)`,
  `linear-gradient(135deg,${T.accent.gold},${T.accent.ember})`,
]

function ContribAvatar({
  initials,
  index,
}: {
  initials: string
  index: number
}) {
  return (
    <span
      title={initials}
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        background: AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length],
        display: "grid",
        placeItems: "center",
        color: "#0a0f2a",
        fontFamily: T.font.serif,
        fontSize: "11px",
        fontWeight: 500,
        border: `1px solid ${T.border.hi}`,
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export function WikiLandingPage({
  landing,
  articles,
  navCategories,
  navbar,
  locale,
}: {
  readonly landing: WikiLandingData | null
  readonly articles: WikiArticleSummary[]
  readonly navCategories: WikiNavCategory[]
  readonly navbar?: NavbarData
  readonly locale: Locale
}) {
  const categories = (landing?.featuredCategories ??
    []) as WikiCategorySummary[]
  const quickStartCards = Array.isArray(landing?.quickStartCards)
    ? landing.quickStartCards
    : []
  const totalArticles = articles.length
  const totalCategories = navCategories.length

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
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "5px 11px",
                  borderRadius: "999px",
                  fontSize: "10px",
                  border: `1px solid ${T.border.line}`,
                  background: "rgba(255,255,255,.03)",
                  fontFamily: T.font.mono,
                  letterSpacing: ".22em",
                  color: T.ink.dim,
                  textTransform: "uppercase",
                  marginBottom: "22px",
                }}
              >
                <span>☉</span>
                <span>{landing?.heroEyebrow ?? "Documentation"}</span>
                {landing?.version ? (
                  <span style={{ color: T.accent.aurora }}>
                    · v{landing.version}
                  </span>
                ) : null}
              </div>

              <h1
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 400,
                  fontSize: "clamp(56px,8.4vw,128px)",
                  lineHeight: 0.92,
                  letterSpacing: "-.045em",
                  margin: 0,
                  textWrap: "balance",
                }}
              >
                {landing?.heroTitle ? (
                  <>
                    {landing.heroTitle.split(",")[0]},
                    <br />
                    <span
                      style={{
                        background: `linear-gradient(180deg,${T.accent.aurora} 0%,#c8ebff 55%,${T.accent.violet} 120%)`,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        fontStyle: "italic",
                        fontWeight: 300,
                      }}
                    >
                      {
                        landing.heroTitle
                          .split(",")
                          .slice(1)
                          .join(",")
                          .trim()
                          .split(" ")[0]
                      }
                    </span>{" "}
                    <em
                      style={{
                        fontStyle: "italic",
                        fontWeight: 300,
                        color: T.ink.low,
                      }}
                    >
                      {landing.heroTitle
                        .split(",")
                        .slice(1)
                        .join(",")
                        .trim()
                        .split(" ")
                        .slice(1)
                        .join(" ")}
                    </em>
                  </>
                ) : (
                  <>
                    Build, contribute,
                    <br />
                    <span
                      style={{
                        background: `linear-gradient(180deg,${T.accent.aurora} 0%,#c8ebff 55%,${T.accent.violet} 120%)`,
                        WebkitBackgroundClip: "text",
                        backgroundClip: "text",
                        color: "transparent",
                        fontStyle: "italic",
                        fontWeight: 300,
                      }}
                    >
                      extend
                    </span>{" "}
                    <em
                      style={{
                        fontStyle: "italic",
                        fontWeight: 300,
                        color: T.ink.low,
                      }}
                    >
                      the atlas.
                    </em>
                  </>
                )}
              </h1>
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
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 14px",
                  borderRadius: "12px",
                  border: `1px solid ${T.border.hi}`,
                  background: "rgba(8,12,30,.5)",
                  fontFamily: T.font.mono,
                  fontSize: "12px",
                  color: T.ink.dim,
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  style={{ color: T.ink.low, flexShrink: 0 }}
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <span
                  style={{
                    flex: 1,
                    color: T.ink.faint,
                    fontSize: "13px",
                    fontWeight: 400,
                  }}
                >
                  Search docs, categories, articles…
                </span>
                <span
                  style={{
                    padding: "3px 7px",
                    borderRadius: "5px",
                    background: "rgba(255,255,255,.06)",
                    border: `1px solid ${T.border.hi}`,
                    fontSize: "10px",
                    color: T.ink.dim,
                  }}
                >
                  ⌘K
                </span>
              </div>

              {/* Stats row */}
              {totalArticles > 0 || totalCategories > 0 ? (
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
                  {totalCategories > 0 ? (
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
                        {totalCategories}
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
                <QuickPathCard key={i} card={card} index={i} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══════════════ DOMAIN GRID ═══════════════ */}
      {categories.length > 0 ? (
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
                  {categories.length} rooms of{" "}
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
                {categories.length} sections · {totalArticles} articles
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
              {categories.map((cat, i) => (
                <DomainCard key={cat.documentId} category={cat} index={i} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══════════════ LATEST ARTICLES + SIDE CARDS ═══════════════ */}
      {articles.length > 0 ? (
        <section style={{ padding: "40px 0 80px" }}>
          <div
            style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 32px" }}
          >
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
                  background: "rgba(255,255,255,.02)",
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
                  <span>§ 02 · Latest changes</span>
                  <span
                    style={{
                      color: T.accent.ok,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
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
                    background: "rgba(255,255,255,.02)",
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
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                  >
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
                    background: "rgba(255,255,255,.02)",
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
                      { n: totalCategories, l: "Sections" },
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

                {/* CTA card */}
                <div
                  style={{
                    background: `linear-gradient(140deg,rgba(127,223,255,.08),rgba(163,144,255,.06))`,
                    border: `1px solid ${T.border.hi}`,
                    borderRadius: "16px",
                    padding: "20px",
                    position: "relative",
                  }}
                >
                  {/* Hash corners */}
                  {[
                    {
                      top: "-1px",
                      right: "-1px",
                      borderLeft: 0,
                      borderBottom: 0,
                    },
                    {
                      bottom: "-1px",
                      left: "-1px",
                      borderRight: 0,
                      borderTop: 0,
                    },
                  ].map((style, i) => (
                    <span
                      key={i}
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        width: "10px",
                        height: "10px",
                        border: `1px solid ${T.border.hi}`,
                        ...style,
                      }}
                    />
                  ))}
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
                    Make your first contribution.
                  </h3>
                  <p
                    style={{
                      color: T.ink.dim,
                      fontSize: "13px",
                      lineHeight: 1.55,
                      margin: "0 0 14px",
                      fontWeight: 300,
                    }}
                  >
                    Open issues are waiting. Pick one, open a PR, get your name
                    in the atlas.
                  </p>
                  <div
                    style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}
                  >
                    <a
                      href="https://github.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        fontWeight: 500,
                        background: T.ink.base,
                        color: "#0a0f2a",
                        textDecoration: "none",
                        transition: "all 200ms",
                      }}
                    >
                      Good first issues →
                    </a>
                    <GlobalLink
                      href="/wiki"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        fontSize: "12px",
                        background: "transparent",
                        color: T.ink.base,
                        border: `1px solid ${T.border.hi}`,
                        textDecoration: "none",
                        transition: "all 200ms",
                      }}
                    >
                      Browse docs
                    </GlobalLink>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

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
        .qpath-card:hover { border-color: rgba(255,255,255,.16) !important; transform: translateY(-3px); }
        .qpath-card:hover .qpath-bar { opacity: 1 !important; }
        .clog-row:hover { background: rgba(255,255,255,.025); }
        .clog-row:last-child { border-bottom: none !important; }
      `}</style>
    </PageShell>
  )
}

WikiLandingPage.displayName = "WikiLandingPage"

export default WikiLandingPage
