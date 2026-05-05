import type { Locale } from "next-intl"

import {
  Badge,
  Breadcrumb,
  MetaRow,
  PageShell,
  type BadgeColor,
} from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import GlobalLink from "@/components/global/GlobalLink"
import {
  countWords,
  estimateReadingTime,
  extractHeadings,
  formatRelativeDate,
} from "@/lib/article-helpers"
import { T } from "@/lib/design-tokens"
import type {
  WikiArticleDetail,
  WikiArticleStatus,
  WikiSectionNav,
} from "@/lib/strapi-api/content/server"

import { WikiArticleEditBody } from "./editor/WikiArticleEditBody"
import { WikiArticleEditProvider } from "./editor/WikiArticleEditContext"
import { WikiArticleEditSidebarPanel } from "./editor/WikiArticleEditSidebarPanel"
import { WikiArticleEditToggle } from "./editor/WikiArticleEditToggle"
import { WikiProgressBar } from "./WikiProgressBar"

// ── Status badge config ──────────────────────────────────────────────────────

const STATUS_TO_BADGE_COLOR: Record<WikiArticleStatus, BadgeColor> = {
  stable: "ok",
  beta: "warn",
  experimental: "ember",
  draft: "dim",
  deprecated: "danger",
}

const STATUS_LABELS: Record<WikiArticleStatus, string> = {
  stable: "Stable",
  beta: "Beta",
  experimental: "Experimental",
  draft: "Draft",
  deprecated: "Deprecated",
}

function StatusBadge({ status }: { status?: WikiArticleStatus | null }) {
  if (!status) return null

  return (
    <Badge
      label={STATUS_LABELS[status] ?? status}
      color={STATUS_TO_BADGE_COLOR[status] ?? "dim"}
      dot
    />
  )
}

// ── Nav status badge (sidebar) ───────────────────────────────────────────────

// Keep NavStatusBadge as-is — it's a compact sidebar variant that intentionally
// differs from the shared Badge component (smaller padding, abbreviated labels).
const STATUS_CONFIG_NAV: Record<
  WikiArticleStatus,
  { label: string; color: string; border: string; bg: string; dot: string }
> = {
  stable: {
    label: "Stable",
    color: T.accent.ok,
    border: "rgba(142,240,179,.3)",
    bg: "rgba(142,240,179,.1)",
    dot: T.accent.ok,
  },
  beta: {
    label: "Beta",
    color: T.accent.warn,
    border: "rgba(255,207,122,.3)",
    bg: "rgba(255,207,122,.1)",
    dot: T.accent.warn,
  },
  experimental: {
    label: "Experimental",
    color: T.accent.ember,
    border: "rgba(255,184,138,.3)",
    bg: "rgba(255,184,138,.1)",
    dot: T.accent.ember,
  },
  draft: {
    label: "Draft",
    color: T.ink.low,
    border: T.border.line,
    bg: "var(--t-bg-deep)",
    dot: T.ink.faint,
  },
  deprecated: {
    label: "Deprecated",
    color: T.accent.danger,
    border: "rgba(255,138,138,.3)",
    bg: "rgba(255,138,138,.1)",
    dot: T.accent.danger,
  },
}

function NavStatusBadge({ status }: { status?: WikiArticleStatus | null }) {
  if (!status || status === "stable") return null
  const cfg = STATUS_CONFIG_NAV[status]
  if (!cfg) return null

  return (
    <span
      style={{
        fontFamily: T.font.mono,
        fontSize: "9px",
        padding: "1px 5px",
        borderRadius: "3px",
        background: cfg.bg,
        color: cfg.color,
        letterSpacing: ".08em",
        flexShrink: 0,
      }}
    >
      {status === "beta"
        ? "Beta"
        : status === "experimental"
          ? "Exp"
          : status === "deprecated"
            ? "Dep"
            : "Draft"}
    </span>
  )
}

// ── Left sidebar navigation ──────────────────────────────────────────────────

function WikiLeftNav({
  navSections,
  currentSlug,
}: {
  readonly navSections: WikiSectionNav[]
  readonly currentSlug?: string | null
}) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* Back link */}
      <GlobalLink
        href="/wiki"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          fontFamily: T.font.mono,
          fontSize: "11px",
          letterSpacing: ".14em",
          color: T.ink.faint,
          textTransform: "uppercase",
          marginBottom: "16px",
          textDecoration: "none",
          transition: "color 200ms",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path
            d="M10 3L5 8l5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Knowledge Hub
      </GlobalLink>

      {/* Category groups */}
      {navSections.map((section, catIdx) => (
        <div key={section.documentId} style={{ marginBottom: "18px" }}>
          {/* Group header */}
          <div
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.low,
              margin: "0 0 8px",
              padding: "0 10px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ color: T.ink.faint }}>
              {String(catIdx + 1).padStart(2, "0")}
            </span>
            {section.name}
          </div>

          {/* Articles list */}
          {section.articles && section.articles.length > 0 ? (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: "1px",
                borderLeft: `1px solid ${T.border.line}`,
                marginLeft: "10px",
              }}
            >
              {section.articles.map((article) => {
                const isActive = article.slug === currentSlug

                return (
                  <li key={article.documentId}>
                    <GlobalLink
                      href={`/wiki/${article.slug}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: isActive ? "6px 12px 6px 11px" : "6px 12px",
                        fontSize: "14px",
                        color: isActive ? T.ink.base : T.ink.dim,
                        background: isActive
                          ? "var(--t-aurora-soft)"
                          : "transparent",
                        borderLeft: isActive
                          ? `2px solid ${T.accent.aurora}`
                          : "2px solid transparent",
                        borderRadius: "0 6px 6px 0",
                        marginLeft: "6px",
                        textDecoration: "none",
                        transition: "color 200ms, background 200ms",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {article.title}
                      </span>
                      <NavStatusBadge status={article.articleStatus} />
                    </GlobalLink>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ))}
    </nav>
  )
}

// ── Right sidebar TOC + meta ─────────────────────────────────────────────────

function WikiRightPanel({
  headings,
  article,
  wordCount,
}: {
  readonly headings: { text: string; level: number; id: string }[]
  readonly article: WikiArticleDetail
  readonly wordCount: number
}) {
  const status = article.articleStatus
  const statusCfg = status
    ? (STATUS_CONFIG_NAV[status] ?? STATUS_CONFIG_NAV.stable)
    : STATUS_CONFIG_NAV.stable
  const editedAgo = formatRelativeDate(article.updatedAt)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* TOC */}
      {headings.length > 0 ? (
        <div>
          <h6
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              letterSpacing: ".22em",
              textTransform: "uppercase",
              color: T.ink.low,
              margin: "0 0 14px",
            }}
          >
            On this page
          </h6>
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "0 0 0 0",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
              borderLeft: `1px solid ${T.border.line}`,
            }}
          >
            {headings.map((h) => (
              <li
                key={h.id}
                style={{
                  padding: h.level > 2 ? "4px 10px 4px 22px" : "4px 10px",
                  fontSize: h.level > 2 ? "12px" : "12.5px",
                  color: T.ink.low,
                  borderLeft: "1px solid transparent",
                  marginLeft: "-1px",
                  lineHeight: 1.4,
                }}
              >
                <a
                  href={`#${h.id}`}
                  style={{
                    color: "inherit",
                    textDecoration: "none",
                    display: "block",
                    transition: "color 200ms",
                  }}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Meta box */}
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          color: T.ink.faint,
          letterSpacing: ".12em",
          lineHeight: 1.8,
          padding: "12px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "10px",
          background: "var(--t-bg-deep)",
        }}
      >
        {[
          {
            k: "Status",
            v: (
              <span
                style={{
                  color: statusCfg.color,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    background: statusCfg.dot,
                    display: "inline-block",
                  }}
                />
                {statusCfg.label}
              </span>
            ),
          },
          editedAgo
            ? {
                k: "Edited",
                v: <span style={{ color: T.ink.base }}>{editedAgo}</span>,
              }
            : null,
          article.author
            ? {
                k: "Author",
                v: <span style={{ color: T.ink.base }}>{article.author}</span>,
              }
            : null,
          wordCount > 0
            ? {
                k: "Words",
                v: (
                  <span style={{ color: T.ink.base }}>
                    {wordCount.toLocaleString()}
                  </span>
                ),
              }
            : null,
        ]
          .filter(Boolean)
          .map((row) => (
            <div
              key={row!.k}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "3px 0",
                borderBottom: `1px dashed ${T.border.line}`,
              }}
            >
              <span style={{ color: T.ink.low }}>{row!.k}</span>
              {row!.v}
            </div>
          ))}
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function WikiArticlePage({
  article,
  navSections,
  locale,
}: {
  readonly article: WikiArticleDetail | null
  readonly navSections: WikiSectionNav[]
  readonly locale: Locale
}) {
  if (!article) {
    return (
      <PageShell>
        <GlobalHeader locale={locale} />
        <main
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: "80px 32px",
          }}
        >
          <p
            style={{
              color: T.ink.faint,
              fontFamily: T.font.mono,
              fontSize: "13px",
            }}
          >
            Article not found.
          </p>
        </main>
      </PageShell>
    )
  }

  const readingTime = estimateReadingTime(article.body)
  const headings = extractHeadings(article.body)
  const wordCount = countWords(article.body)
  const editedAgo = formatRelativeDate(article.updatedAt)

  // Split title: put last 2+ words in italic Fraunces (matching design aesthetic)
  const titleWords = (article.title ?? "").split(" ")
  const breakAt = Math.max(titleWords.length - 2, 1)
  const titleMain = titleWords.slice(0, breakAt).join(" ")
  const titleItalic = titleWords.slice(breakAt).join(" ")

  return (
    <PageShell>
      <WikiProgressBar />
      <GlobalHeader locale={locale} />

      {/* ── Three-column shell ─────────────────────────────────────────── */}
      <WikiArticleEditProvider slug={article.slug ?? ""}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "280px minmax(0,1fr) 240px",
            maxWidth: "1480px",
            margin: "0 auto",
            padding: "0 0",
          }}
          className="doc-shell-grid"
        >
          {/* ── LEFT SIDEBAR ──────────────────────────────────────────────── */}
          <aside
            style={{
              borderRight: `1px solid ${T.border.line}`,
            }}
            className="doc-sidebar-col"
          >
            <div
              style={{
                position: "sticky",
                top: "56px",
                height: "calc(100vh - 56px)",
                overflowY: "auto",
                padding: "28px 16px 28px 20px",
              }}
            >
              {/* Inline search (decorative ⌘K trigger) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: `1px solid ${T.border.line}`,
                  background: "var(--t-bg-deep)",
                  marginBottom: "18px",
                }}
              >
                <svg
                  width="13"
                  height="13"
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
                    fontFamily: T.font.mono,
                    fontSize: "12px",
                    color: T.ink.faint,
                  }}
                >
                  Filter docs…
                </span>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    color: T.ink.faint,
                    padding: "3px 6px",
                    border: `1px solid ${T.border.line}`,
                    borderRadius: "4px",
                  }}
                >
                  ⌘K
                </span>
              </div>

              <WikiLeftNav
                navSections={navSections}
                currentSlug={article.slug}
              />
            </div>
          </aside>

          {/* ── MAIN CONTENT ──────────────────────────────────────────────── */}
          <article style={{ minWidth: 0, padding: "40px 48px 80px" }}>
            <div style={{ maxWidth: "720px", margin: "0 auto" }}>
              {/* Breadcrumb */}
              <div style={{ marginBottom: "24px" }}>
                <Breadcrumb
                  items={[
                    { label: "Wiki", href: "/wiki" },
                    ...(article.section
                      ? [
                          {
                            label: article.section.name,
                            href: `/wiki?section=${article.section.slug}`,
                          },
                        ]
                      : []),
                    { label: article.title ?? "" },
                  ]}
                />
              </div>

              {/* ── Article header ─────────────────────────────────────────── */}
              <header
                style={{
                  paddingBottom: "24px",
                  borderBottom: `1px solid ${T.border.line}`,
                  marginBottom: "32px",
                }}
              >
                {/* Kicker: type tag + status tag + meta */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    marginBottom: "16px",
                    flexWrap: "wrap",
                  }}
                >
                  {article.category?.name ? (
                    <Badge label={article.category.name} color="aurora" />
                  ) : null}

                  <StatusBadge status={article.articleStatus} />

                  <MetaRow
                    items={[
                      readingTime > 0 ? `~ ${readingTime} min read` : null,
                      editedAgo ? `Last edited ${editedAgo}` : null,
                      article.author ?? null,
                    ]}
                  />
                </div>

                {/* Title */}
                <h1
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 400,
                    fontSize: "clamp(40px,5.6vw,72px)",
                    lineHeight: 0.98,
                    letterSpacing: "-.032em",
                    margin: "0 0 18px",
                    textWrap: "balance",
                    color: T.ink.base,
                  }}
                >
                  {titleMain}{" "}
                  <em
                    style={{
                      fontStyle: "italic",
                      fontWeight: 300,
                      color: T.ink.low,
                    }}
                  >
                    {titleItalic}
                  </em>
                </h1>

                {/* Summary / dek */}
                {article.summary ? (
                  <p
                    style={{
                      fontSize: "17px",
                      lineHeight: 1.55,
                      color: T.ink.dim,
                      fontWeight: 300,
                      maxWidth: "60ch",
                      margin: 0,
                    }}
                  >
                    {article.summary}
                  </p>
                ) : null}

                {/* Toolbar: author avatar + actions */}
                <div
                  style={{
                    marginTop: "24px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: "16px",
                  }}
                >
                  {/* Author avatar */}
                  {article.author ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <span
                        style={{
                          width: "30px",
                          height: "30px",
                          borderRadius: "50%",
                          background: `linear-gradient(135deg,${T.accent.aurora},${T.accent.violet})`,
                          display: "grid",
                          placeItems: "center",
                          color: "#0a0f2a",
                          fontFamily: T.font.serif,
                          fontSize: "11px",
                          fontWeight: 500,
                          border: `2px solid ${T.bg.void}`,
                          flexShrink: 0,
                        }}
                      >
                        {article.author.slice(0, 2).toUpperCase()}
                      </span>
                      <span
                        style={{
                          fontFamily: T.font.mono,
                          fontSize: "11px",
                          color: T.ink.low,
                        }}
                      >
                        {article.author}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: "6px" }}>
                    <WikiArticleEditToggle />
                    <button
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: `1px solid ${T.border.line}`,
                        background: "var(--t-bg-deep)",
                        fontFamily: T.font.mono,
                        fontSize: "11px",
                        color: T.ink.dim,
                        letterSpacing: ".06em",
                        cursor: "pointer",
                      }}
                    >
                      Report issue
                    </button>
                  </div>
                </div>
              </header>

              {/* ── Article body ─────────────────────────────────────────── */}
              <WikiArticleEditBody
                slug={article.slug ?? ""}
                locale={locale}
                body={article.body as Record<string, unknown>[]}
              />

              {/* ── Footer ───────────────────────────────────────────────── */}
              <div
                style={{
                  marginTop: "40px",
                  paddingTop: "24px",
                  borderTop: `1px solid ${T.border.line}`,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "24px",
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                {/* Feedback */}
                <div
                  style={{
                    fontSize: "13px",
                    color: T.ink.low,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                  }}
                >
                  <span>Was this page helpful?</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {["↑ Yes", "↓ No"].map((label) => (
                      <button
                        key={label}
                        style={{
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: `1px solid ${T.border.line}`,
                          background: "transparent",
                          color: T.ink.dim,
                          fontFamily: T.font.mono,
                          fontSize: "12px",
                          cursor: "pointer",
                          transition: "border-color 200ms, color 200ms",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Last edited meta */}
                {editedAgo ? (
                  <div
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "11px",
                      color: T.ink.faint,
                      letterSpacing: ".06em",
                    }}
                  >
                    Last edited {editedAgo}
                    {article.author ? ` · by ${article.author}` : ""}
                  </div>
                ) : null}
              </div>

              {/* ── Prev / Next pager ───────────────────────────────────── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginTop: "32px",
                }}
              >
                <GlobalLink
                  href="/wiki"
                  style={{
                    padding: "18px",
                    border: `1px solid ${T.border.line}`,
                    borderRadius: "12px",
                    background: "var(--t-bg-deep)",
                    textDecoration: "none",
                    transition: "border-color 200ms, background 200ms",
                  }}
                >
                  <div
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "10px",
                      letterSpacing: ".2em",
                      textTransform: "uppercase",
                      color: T.ink.low,
                      marginBottom: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    ← Back
                  </div>
                  <div
                    style={{
                      fontFamily: T.font.serif,
                      fontSize: "17px",
                      color: T.ink.base,
                      letterSpacing: "-.02em",
                      lineHeight: 1.25,
                    }}
                  >
                    All docs
                  </div>
                </GlobalLink>
                <div />
              </div>
            </div>
          </article>

          {/* ── RIGHT SIDEBAR ─────────────────────────────────────────────── */}
          <aside
            style={{ borderLeft: `1px solid ${T.border.line}` }}
            className="doc-outline-col"
          >
            <div
              style={{
                position: "sticky",
                top: "56px",
                height: "calc(100vh - 56px)",
                overflowY: "auto",
                padding: "44px 16px 28px 20px",
              }}
            >
              <WikiArticleEditSidebarPanel />
              <WikiRightPanel
                headings={headings}
                article={article}
                wordCount={wordCount}
              />
            </div>
          </aside>
        </div>

        {/* Responsive overrides */}
        <style>{`
        @media (max-width: 1200px) {
          .doc-shell-grid { grid-template-columns: 240px minmax(0,1fr) !important; }
          .doc-outline-col { display: none !important; }
        }
        @media (max-width: 900px) {
          .doc-shell-grid { grid-template-columns: minmax(0,1fr) !important; }
          .doc-sidebar-col { display: none !important; }
          article { padding: 32px 24px 60px !important; }
        }
      `}</style>
      </WikiArticleEditProvider>
    </PageShell>
  )
}

WikiArticlePage.displayName = "WikiArticlePage"

export default WikiArticlePage
