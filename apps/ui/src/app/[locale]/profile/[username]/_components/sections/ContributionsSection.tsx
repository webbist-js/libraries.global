"use client"

import { Icon } from "@iconify/react"
import { useEffect, useMemo, useState } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { T } from "@/lib/design-tokens"

// ── Type config ───────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { label: string; icon: string; color: string; bg: string; border: string }
> = {
  new_library: {
    label: "Added",
    icon: "mdi:book-plus-outline",
    color: T.accent.ok,
    bg: "rgba(142,240,179,0.08)",
    border: "rgba(142,240,179,0.22)",
  },
  library_edit: {
    label: "Edited",
    icon: "mdi:pencil-outline",
    color: T.accent.aurora,
    bg: "rgba(127,223,255,0.08)",
    border: "rgba(127,223,255,0.22)",
  },
  correction: {
    label: "Correction",
    icon: "mdi:flag-outline",
    color: T.accent.gold,
    bg: "rgba(232,201,138,0.08)",
    border: "rgba(232,201,138,0.22)",
  },
  wiki_edit: {
    label: "Wiki",
    icon: "mdi:book-edit-outline",
    color: T.accent.violet,
    bg: "rgba(163,144,255,0.08)",
    border: "rgba(163,144,255,0.22)",
  },
  library_claim: {
    label: "Claimed",
    icon: "mdi:shield-check-outline",
    color: T.accent.gold,
    bg: "rgba(232,201,138,0.08)",
    border: "rgba(232,201,138,0.22)",
  },
  topic_suggestion: {
    label: "Topic",
    icon: "mdi:tag-outline",
    color: T.ink.dim,
    bg: T.bg.deep,
    border: T.border.line,
  },
  blog_submission: {
    label: "Article",
    icon: "mdi:newspaper-variant-outline",
    color: T.ink.dim,
    bg: T.bg.deep,
    border: T.border.line,
  },
}

const STATUS_META: Record<
  string,
  { label: string; color: string; border: string }
> = {
  approved: {
    label: "Approved",
    color: T.accent.ok,
    border: "rgba(142,240,179,0.3)",
  },
  pending: {
    label: "Under review",
    color: T.accent.warn,
    border: "rgba(255,207,122,0.3)",
  },
  needs_info: {
    label: "Changes requested",
    color: T.accent.ember,
    border: "rgba(255,184,138,0.3)",
  },
  rejected: {
    label: "Declined",
    color: T.accent.danger,
    border: "rgba(255,138,138,0.3)",
  },
}

// Estimated points per type/status (mirrors rewards plugin)
function estimatePoints(s: PublicSubmission): number | null {
  if (s.status !== "approved") return null
  switch (s.submissionType) {
    case "new_library":
      return 50
    case "library_edit":
      return 10
    case "wiki_edit":
      return 5
    case "library_claim":
      return 5

    default:
      return null
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function formatRelativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Yesterday"
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`

  return `${Math.floor(days / 365)} years ago`
}

function groupByDay(
  subs: PublicSubmission[]
): { label: string; items: PublicSubmission[] }[] {
  const groups: Map<string, PublicSubmission[]> = new Map()
  for (const s of subs) {
    const d = new Date(s.createdAt)
    const key = d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  return [...groups.entries()].map(([label, items]) => ({ label, items }))
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "new_library", label: "Added" },
  { id: "library_edit", label: "Edited" },
  { id: "wiki_edit", label: "Wiki" },
  { id: "library_claim", label: "Claimed" },
  { id: "other", label: "Other" },
] as const

type FilterId = (typeof FILTER_TABS)[number]["id"]

function matchesFilter(s: PublicSubmission, filter: FilterId): boolean {
  if (filter === "all") return true
  if (filter === "other")
    return ![
      "new_library",
      "library_edit",
      "wiki_edit",
      "library_claim",
    ].includes(s.submissionType)

  return s.submissionType === filter
}

// ── Components ────────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <div
      style={{
        padding: "16px 20px",
        background: T.bg.surface,
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.faint,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: "28px",
          fontWeight: 700,
          color: accent ?? T.ink.base,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  )
}

const FALLBACK_TYPE = TYPE_META.correction!
const FALLBACK_STATUS = STATUS_META.pending!

function ContributionRow({ sub }: { sub: PublicSubmission }) {
  const meta = TYPE_META[sub.submissionType] ?? FALLBACK_TYPE
  const statusMeta = STATUS_META[sub.status] ?? FALLBACK_STATUS
  const pts = estimatePoints(sub)

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "14px 20px",
        borderTop: `1px solid ${T.border.line}`,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "10px",
          border: `1px solid ${meta.border}`,
          background: meta.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon icon={meta.icon} width={16} style={{ color: meta.color }} />
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "4px",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: meta.color,
              padding: "2px 7px",
              borderRadius: "5px",
              border: `1px solid ${meta.border}`,
              background: meta.bg,
              flexShrink: 0,
            }}
          >
            {meta.label}
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: T.ink.base,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub.targetLabel ?? sub.targetSlug ?? sub.submissionType}
          </span>
        </div>
        {sub.editSummary && (
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "11px",
              color: T.ink.faint,
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub.editSummary}
          </p>
        )}
      </div>

      {/* Right: status + date + points */}
      <div
        style={{
          flexShrink: 0,
          textAlign: "right",
          display: "flex",
          flexDirection: "column",
          gap: "5px",
          alignItems: "flex-end",
        }}
      >
        {statusMeta && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".10em",
              textTransform: "uppercase",
              color: statusMeta.color,
              padding: "2px 7px",
              borderRadius: "5px",
              border: `1px solid ${statusMeta.border}`,
            }}
          >
            {statusMeta.label}
          </span>
        )}
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            color: T.ink.faint,
            textTransform: "uppercase",
            letterSpacing: ".06em",
          }}
        >
          {formatRelativeDate(sub.createdAt)}
        </span>
        {pts !== null && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              color: T.accent.ok,
              fontWeight: 600,
            }}
          >
            +{pts} pts
          </span>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ContributionsSection({ username }: { username: string }) {
  const [submissions, setSubmissions] = useState<PublicSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterId>("all")

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}/contributions`)
      .then((r) => r.json())
      .then((json: { data?: PublicSubmission[] }) => {
        setSubmissions(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username])

  const filtered = useMemo(
    () => submissions.filter((s) => matchesFilter(s, activeFilter)),
    [submissions, activeFilter]
  )

  const grouped = useMemo(() => groupByDay(filtered), [filtered])

  const total = submissions.length
  const approved = submissions.filter((s) => s.status === "approved").length
  const pending = submissions.filter(
    (s) => s.status === "pending" || s.status === "needs_info"
  ).length
  const totalPts = submissions
    .map(estimatePoints)
    .filter((p): p is number => p !== null)
    .reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              padding: "14px 20px",
              borderTop: i ? `1px solid ${T.border.line}` : undefined,
              display: "flex",
              gap: "14px",
              alignItems: "center",
            }}
          >
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                background: T.bg.surface,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  height: "12px",
                  borderRadius: "4px",
                  background: T.bg.surface,
                  width: "60%",
                  marginBottom: "6px",
                }}
              />
              <div
                style={{
                  height: "10px",
                  borderRadius: "4px",
                  background: T.bg.surface,
                  width: "40%",
                }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          padding: "48px",
          textAlign: "center",
          background: T.bg.surface,
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: "0 0 8px",
          }}
        >
          No contributions yet
        </p>
        <p style={{ fontSize: "13px", color: T.ink.faint, margin: 0 }}>
          Submitted additions, edits, and wiki changes will appear here once
          approved or under review.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "1px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          overflow: "hidden",
          background: T.border.line,
        }}
      >
        <StatCell label="Total" value={total} />
        <StatCell label="Approved" value={approved} accent={T.accent.ok} />
        <StatCell label="Under review" value={pending} accent={T.accent.warn} />
        <StatCell
          label="Points earned"
          value={totalPts}
          accent={T.accent.aurora}
        />
      </div>

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: "0",
          borderBottom: `1px solid ${T.border.line}`,
          overflowX: "auto",
        }}
      >
        {FILTER_TABS.map((tab) => {
          const count =
            tab.id === "all"
              ? submissions.length
              : tab.id === "other"
                ? submissions.filter(
                    (s) =>
                      ![
                        "new_library",
                        "library_edit",
                        "wiki_edit",
                        "library_claim",
                      ].includes(s.submissionType)
                  ).length
                : submissions.filter((s) => s.submissionType === tab.id).length

          const active = activeFilter === tab.id

          return (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              style={{
                padding: "10px 16px",
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: active ? T.ink.base : T.ink.faint,
                background: "transparent",
                border: "none",
                borderBottom: active
                  ? `2px solid ${T.accent.aurora}`
                  : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={{
                    fontSize: "10px",
                    color: active ? T.accent.aurora : T.ink.faint,
                    opacity: 0.8,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Grouped list */}
      {grouped.length === 0 ? (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            border: `1px solid ${T.border.line}`,
            borderRadius: "12px",
          }}
        >
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              margin: 0,
            }}
          >
            No contributions in this category
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {grouped.map((group) => (
            <div
              key={group.label}
              style={{
                border: `1px solid ${T.border.line}`,
                borderRadius: "12px",
                overflow: "hidden",
                background: T.bg.surface,
              }}
            >
              <div
                style={{
                  padding: "10px 20px",
                  background: T.bg.surface,
                  borderBottom: `1px solid ${T.border.line}`,
                }}
              >
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    letterSpacing: ".14em",
                    textTransform: "uppercase",
                    color: T.ink.faint,
                  }}
                >
                  {group.label}
                </span>
              </div>
              {group.items.map((sub) => (
                <ContributionRow key={sub.documentId} sub={sub} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
