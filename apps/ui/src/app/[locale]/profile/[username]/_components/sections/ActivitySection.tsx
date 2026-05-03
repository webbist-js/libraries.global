"use client"

import { Icon } from "@iconify/react"
import { useEffect, useMemo, useState } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { T } from "@/lib/design-tokens"

import { ContributionHeatmap } from "../ContributionHeatmap"

// ── Type icons ─────────────────────────────────────────────────────────────────

const ACTIVITY_META: Record<
  string,
  { label: string; icon: string; color: string; verb: string }
> = {
  new_library: {
    label: "Added",
    icon: "mdi:book-plus-outline",
    color: T.accent.ok,
    verb: "added library",
  },
  library_edit: {
    label: "Edited",
    icon: "mdi:pencil-outline",
    color: T.accent.aurora,
    verb: "edited",
  },
  correction: {
    label: "Correction",
    icon: "mdi:flag-outline",
    color: T.accent.gold,
    verb: "flagged correction",
  },
  wiki_edit: {
    label: "Wiki",
    icon: "mdi:book-edit-outline",
    color: T.accent.violet,
    verb: "edited wiki",
  },
  library_claim: {
    label: "Claimed",
    icon: "mdi:shield-check-outline",
    color: T.accent.gold,
    verb: "claimed",
  },
  topic_suggestion: {
    label: "Topic",
    icon: "mdi:tag-outline",
    color: T.ink.dim,
    verb: "suggested topic",
  },
  blog_submission: {
    label: "Article",
    icon: "mdi:newspaper-variant-outline",
    color: T.ink.dim,
    verb: "submitted article",
  },
}

// ── Date helpers ───────────────────────────────────────────────────────────────

function toDateKey(iso: string): string {
  return iso.slice(0, 10) // YYYY-MM-DD
}

function formatDayLabel(dateKey: string): string {
  const d = new Date(dateKey + "T00:00:00")
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const diff = Math.round((now.getTime() - d.getTime()) / 86_400_000)
  if (diff === 0) return "Today"
  if (diff === 1) return "Yesterday"
  if (diff < 7) return `${diff} days ago`

  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function groupByDay(
  subs: PublicSubmission[]
): { key: string; label: string; items: PublicSubmission[] }[] {
  const groups: Map<string, PublicSubmission[]> = new Map()
  for (const s of subs) {
    const key = toDateKey(s.createdAt)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(s)
  }

  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: formatDayLabel(key),
    items,
  }))
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const FALLBACK_ACTIVITY = ACTIVITY_META.correction!

function ActivityRow({ sub }: { sub: PublicSubmission }) {
  const meta = ACTIVITY_META[sub.submissionType] ?? FALLBACK_ACTIVITY
  const isApproved = sub.status === "approved"
  const isPending = sub.status === "pending" || sub.status === "needs_info"

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "12px 0",
      }}
    >
      {/* Timeline dot + line (handled by parent) */}
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "7px",
          border: `1px solid ${meta.color}30`,
          background: `${meta.color}10`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: "2px",
        }}
      >
        <Icon icon={meta.icon} width={13} style={{ color: meta.color }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.base,
            margin: "0 0 3px",
            lineHeight: 1.4,
          }}
        >
          <span style={{ color: meta.color, fontWeight: 500 }}>
            {meta.verb}
          </span>{" "}
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub.targetLabel ?? sub.targetSlug ?? sub.submissionType}
          </span>
        </p>
        {sub.editSummary && (
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "11px",
              color: T.ink.faint,
              margin: "0 0 4px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {sub.editSummary}
          </p>
        )}
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".10em",
            textTransform: "uppercase",
            color: isApproved
              ? T.accent.ok
              : isPending
                ? T.accent.warn
                : T.ink.faint,
            border: `1px solid ${
              isApproved
                ? "rgba(142,240,179,0.25)"
                : isPending
                  ? "rgba(255,207,122,0.25)"
                  : T.border.line
            }`,
            borderRadius: "4px",
            padding: "1px 6px",
          }}
        >
          {isApproved
            ? "approved"
            : isPending
              ? "under review"
              : sub.status === "needs_info"
                ? "changes requested"
                : sub.status}
        </span>
      </div>

      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          color: T.ink.faint,
          textTransform: "uppercase",
          letterSpacing: ".06em",
          flexShrink: 0,
          paddingTop: "4px",
        }}
      >
        {new Date(sub.createdAt).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  )
}

function StatPill({
  icon,
  label,
  value,
  accent,
}: {
  icon: string
  label: string
  value: number | string
  accent?: string
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "16px 20px",
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        background: T.bg.surface,
        flex: "1 1 130px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <Icon
          icon={icon}
          width={14}
          style={{ color: accent ?? T.ink.faint, flexShrink: 0 }}
        />
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontFamily: T.font.serif,
          fontSize: "26px",
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

// ── Main ───────────────────────────────────────────────────────────────────────

export function ActivitySection({ username }: { username: string }) {
  const [submissions, setSubmissions] = useState<PublicSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [now] = useState<number>(() => Date.now())

  useEffect(() => {
    fetch(`/api/profile/${encodeURIComponent(username)}/contributions`)
      .then((r) => r.json())
      .then((json: { data?: PublicSubmission[] }) => {
        setSubmissions(json.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [username])

  const thirtyDayCount = useMemo(() => {
    const cutoff = now - 30 * 86_400_000

    return submissions.filter((s) => new Date(s.createdAt).getTime() > cutoff)
      .length
  }, [submissions])

  const approvedCount = useMemo(
    () => submissions.filter((s) => s.status === "approved").length,
    [submissions]
  )

  const grouped = useMemo(() => groupByDay(submissions), [submissions])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Contribution heatmap */}
      <ContributionHeatmap submissions={submissions} now={now} />

      {loading ? (
        /* Skeleton */
        <div
          style={{
            border: `1px solid ${T.border.line}`,
            borderRadius: "12px",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginBottom: "20px",
              flexWrap: "wrap",
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  flex: "1 1 130px",
                  height: "80px",
                  borderRadius: "12px",
                  background: T.bg.surface,
                }}
              />
            ))}
          </div>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "center",
                padding: "12px 0",
                borderTop: i ? `1px solid ${T.border.line}` : undefined,
              }}
            >
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  background: T.bg.surface,
                  flexShrink: 0,
                }}
              />
              <div
                style={{
                  height: "12px",
                  borderRadius: "4px",
                  background: T.bg.surface,
                  width: "55%",
                }}
              />
            </div>
          ))}
        </div>
      ) : submissions.length === 0 ? (
        /* Empty state */
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
            No activity yet
          </p>
          <p style={{ fontSize: "13px", color: T.ink.faint, margin: 0 }}>
            Library edits, additions, and wiki contributions will appear here.
          </p>
        </div>
      ) : (
        /* Stats + timeline */
        <>
          {/* Summary stats */}
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <StatPill
              icon="mdi:calendar-month-outline"
              label="Last 30 days"
              value={thirtyDayCount}
              accent={T.accent.aurora}
            />
            <StatPill
              icon="mdi:check-circle-outline"
              label="Approved total"
              value={approvedCount}
              accent={T.accent.ok}
            />
            <StatPill
              icon="mdi:history"
              label="All time"
              value={submissions.length}
            />
          </div>

          {/* Timeline feed */}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {grouped.map((group) => (
              <div
                key={group.key}
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
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      letterSpacing: ".14em",
                      textTransform: "uppercase",
                      color: T.ink.faint,
                    }}
                  >
                    {group.label}
                  </span>
                  <span
                    style={{
                      fontFamily: T.font.mono,
                      fontSize: "9px",
                      color: T.ink.faint,
                      opacity: 0.6,
                    }}
                  >
                    {group.items.length}{" "}
                    {group.items.length === 1 ? "event" : "events"}
                  </span>
                </div>
                <div style={{ padding: "0 20px" }}>
                  {group.items.map((sub, i) => (
                    <div
                      key={sub.documentId}
                      style={{
                        borderTop:
                          i > 0 ? `1px solid ${T.border.line}` : undefined,
                      }}
                    >
                      <ActivityRow sub={sub} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
