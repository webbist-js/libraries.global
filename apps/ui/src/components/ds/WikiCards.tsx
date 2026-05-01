import { Badge } from "@/components/ds"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type {
  WikiArticleSummary,
  WikiSectionNav,
} from "@/lib/strapi-api/content/server"

// ── Quick-start card ───────────────────────────────────────────────────────

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

export function QuickPathCard({
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
        background: T.bg.surface,
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
            textTransform: "uppercase",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          ~ 10 min
        </div>
      </div>
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

  const sectionSlug = card.section?.slug
  const href = sectionSlug
    ? `/wiki/${sectionSlug}/${card.slug}`
    : `/wiki/${card.slug}`

  return (
    <GlobalLink href={href} className="block">
      {Inner}
    </GlobalLink>
  )
}

// ── Domain card ────────────────────────────────────────────────────────────

const BADGE_COLORS = [
  "aurora",
  "ember",
  "ok",
  "violet",
  "gold",
  "aurora",
  "ember",
  "ok",
] as const

export function SectionDomainCard({
  section,
  index,
}: {
  readonly section: WikiSectionNav
  readonly index: number
}) {
  const sectionNum = String(index + 1).padStart(2, "0")

  const uniqueCategories = Array.from(
    new Map(
      section.articles
        .map((a) => a.category)
        .filter((c) => c && c.name && c.slug)
        .map((c) => [c!.slug, c])
    ).values()
  )

  return (
    <GlobalLink
      href={`/wiki/${section.slug}`}
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
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          color: T.ink.faint,
          letterSpacing: ".2em",
        }}
      >
        § 01.{sectionNum}
      </div>
      <div style={{ display: "flex" }}>
        <Badge
          label={section.name}
          color={BADGE_COLORS[index % BADGE_COLORS.length]!}
        />
      </div>
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
        {section.label ?? section.name}
      </div>
      {section.description ? (
        <div
          style={{
            fontSize: "13px",
            lineHeight: 1.55,
            color: T.ink.low,
            fontWeight: 300,
          }}
        >
          {section.description}
        </div>
      ) : null}
      {uniqueCategories.length > 0 ? (
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
          {uniqueCategories.map((category) => (
            <li
              key={category!.slug!}
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
              {category!.name}
            </li>
          ))}
        </ul>
      ) : null}
    </GlobalLink>
  )
}

// ── Latest article row (changelog-style) ──────────────────────────────────

export function ArticleChangelogRow({
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
  const FALLBACK_BADGE_COLORS = [
    "aurora",
    "gold",
    "ok",
    "aurora",
    "violet",
    "ok",
  ] as const
  const rawLabel =
    article.section?.name ??
    article.category?.name ??
    FALLBACK_LABELS[index % 6]!
  const label: string = rawLabel.length > 10 ? rawLabel.slice(0, 10) : rawLabel
  const badgeColor = FALLBACK_BADGE_COLORS[index % 6]!

  const sectionSlug = article.section?.slug
  const href = sectionSlug
    ? `/wiki/${sectionSlug}/${article.slug}`
    : `/wiki/${article.slug}`

  return (
    <GlobalLink
      href={href}
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
          textTransform: "uppercase",
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

export function ContribAvatar({
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
