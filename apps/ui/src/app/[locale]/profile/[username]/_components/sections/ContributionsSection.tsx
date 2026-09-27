"use client"

import { useEffect, useMemo, useState } from "react"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { T } from "@/lib/design-tokens"

import {
  CARD,
  ContributionRow,
  SectionTitle,
  StatCard,
  TextLink,
} from "../ProfileSectionUI"

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

// ── Filters ───────────────────────────────────────────────────────────────

const FILTER_TABS = [
  { id: "all", label: "All" },
  { id: "new_library", label: "Added" },
  { id: "library_edit", label: "Edited" },
  { id: "wiki_edit", label: "Knowledge" },
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
  const counts = useMemo(() => {
    const c: Record<FilterId, number> = {
      all: 0,
      new_library: 0,
      library_edit: 0,
      wiki_edit: 0,
      library_claim: 0,
      other: 0,
    }
    for (const tab of FILTER_TABS) {
      c[tab.id] = submissions.filter((s) => matchesFilter(s, tab.id)).length
    }

    return c
  }, [submissions])
  const activeLabel =
    FILTER_TABS.find((t) => t.id === activeFilter)?.label ?? "All"
  const totalPts = submissions
    .map(estimatePoints)
    .filter((p): p is number => p !== null)
    .reduce((a, b) => a + b, 0)

  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading contributions"
        style={{ ...CARD, overflow: "hidden" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 px-6 py-4"
            style={{
              borderTop: i ? `1px solid ${T.border.divider}` : undefined,
            }}
          >
            <div
              className="size-11 shrink-0 rounded-[14px]"
              style={{ background: T.bg.muted }}
            />
            <div className="flex-1">
              <div
                className="mb-2 h-3 w-3/5 rounded"
                style={{ background: T.bg.muted }}
              />
              <div
                className="h-2.5 w-2/5 rounded"
                style={{ background: T.bg.muted }}
              />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (submissions.length === 0) {
    return (
      <section aria-labelledby="ct-empty" style={{ ...CARD, padding: "24px" }}>
        <SectionTitle as="h2" id="ct-empty">
          Contributions
        </SectionTitle>
        <p className="m-0 mt-2 text-[15px]" style={{ color: T.ink.dim }}>
          No contributions yet. Added libraries, edits and wiki changes will
          appear here once submitted.
        </p>
        <p className="m-0 mt-3">
          <TextLink href="/contribute">Start contributing</TextLink>
        </p>
      </section>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stat cards */}
      <h2 className="sr-only">Contribution summary</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Total"
          value={String(total)}
          bg="var(--tint-neutral-bg)"
          fg="var(--tint-neutral-fg)"
          icon="mdi:format-list-bulleted"
        />
        <StatCard
          label="Accepted"
          value={String(approved)}
          bg="var(--tint-public-bg)"
          fg="var(--tint-public-fg)"
          icon="mdi:check-circle-outline"
        />
        <StatCard
          label="In review"
          value={String(pending)}
          bg="var(--tint-academic-bg)"
          fg="var(--tint-academic-fg)"
          icon="mdi:clock-outline"
        />
        <StatCard
          label="Points earned"
          value={totalPts.toLocaleString()}
          bg="var(--tint-national-bg)"
          fg="var(--tint-national-fg)"
          icon="mdi:star-four-points-outline"
        />
      </div>

      {/* List */}
      <section aria-labelledby="ct-list" style={CARD}>
        <div className="flex flex-col gap-4 px-6 pt-5 pb-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <SectionTitle as="h2" id="ct-list">
              All contributions
            </SectionTitle>
            <span
              className="text-[15px]"
              style={{ color: T.ink.dim }}
              aria-live="polite"
            >
              {filtered.length}{" "}
              {filtered.length === 1 ? "contribution" : "contributions"}
              {activeFilter === "all" ? "" : ` · ${activeLabel}`}
            </span>
          </div>

          <fieldset className="m-0 border-0 p-0">
            <legend className="sr-only">Filter by type</legend>
            <div className="flex flex-wrap gap-2">
              {FILTER_TABS.map((tab) => {
                const active = activeFilter === tab.id
                const count = counts[tab.id]

                return (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setActiveFilter(tab.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[14px] font-semibold transition-colors"
                    style={
                      active
                        ? {
                            background: T.accent.chip,
                            borderColor: T.accent.primary,
                            color: T.accent.primaryHover,
                          }
                        : {
                            background: T.bg.deep,
                            borderColor: T.border.hi,
                            color: T.ink.base,
                          }
                    }
                  >
                    {tab.label}
                    <span
                      className="text-[13px] font-medium"
                      style={{
                        color: active ? T.accent.primaryHover : T.ink.low,
                      }}
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>

        {grouped.length === 0 ? (
          <p
            className="m-0 border-t px-6 py-6 text-[15px]"
            style={{ borderTopColor: T.border.divider, color: T.ink.dim }}
          >
            No contributions of this type yet.
          </p>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <h3
                className="m-0 border-t px-6 pt-4 pb-1 text-[14px] font-semibold"
                style={{ borderTopColor: T.border.line, color: T.ink.low }}
              >
                {group.label}
              </h3>
              <ul className="m-0 list-none p-0">
                {group.items.map((sub) => (
                  <ContributionRow
                    key={sub.documentId}
                    item={sub}
                    points={estimatePoints(sub)}
                    showStatusIcon
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}
