"use client"

import { useEffect, useState } from "react"

import { useMySubmissions, type Submission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"

import { SubmissionCard } from "./SubmissionCard"
import { ContributeSectionHeader } from "../../_components/ContributeSectionHeader"

const TABS = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "pending", label: "Under review" },
  { id: "needs_info", label: "Changes requested" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
]

function filterSubmissions(
  submissions: Submission[],
  filter: string
): Submission[] {
  if (filter === "all") return submissions

  return submissions.filter((s) => s.status === filter)
}

function countForTab(submissions: Submission[], tabId: string): number {
  if (tabId === "all") return submissions.length

  return submissions.filter((s) => s.status === tabId).length
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[148px] animate-pulse rounded-[20px]"
          style={{
            background: T.bg.deep,
            border: `1px solid ${T.border.line}`,
          }}
        />
      ))}
    </div>
  )
}

function EmptyState({ filter }: { filter: string }) {
  const label =
    filter === "all"
      ? "No submissions yet"
      : `No ${(TABS.find((tab) => tab.id === filter)?.label ?? filter.replace("_", " ")).toLowerCase()} submissions`
  const description =
    filter === "all"
      ? "Your library additions, edits, and corrections will appear here once submitted."
      : "No submissions matching this filter at the moment."

  return (
    <div
      className="flex flex-col items-center rounded-[20px] px-6 py-12 text-center"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <h2
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "24px",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: T.ink.base,
        }}
      >
        {label}
      </h2>
      <p
        className="mt-2 mb-0 max-w-[44ch] text-[15px] leading-[1.6]"
        style={{ color: T.ink.dim }}
      >
        {description}
      </p>
    </div>
  )
}

export function SubmissionsShell() {
  const [activeFilter, setActiveFilter] = useState<string>("all")
  const { data: submissions = [], isLoading, refetch } = useMySubmissions()

  useEffect(() => {
    refetch()
    const id = setInterval(() => refetch(), 60000)

    return () => clearInterval(id)
  }, [refetch])

  const filtered = filterSubmissions(submissions, activeFilter)

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <ContributeSectionHeader
        section="My submissions"
        title="Your contributions, *in flight.*"
        lead="Drafts, things under review, requests for changes, and recently published. Editorial board comments live alongside each one."
      >
        <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
          This list refreshes every minute.
        </p>
      </ContributeSectionHeader>

      <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-16 sm:px-8">
        <div
          role="group"
          aria-label="Filter submissions by status"
          className="mb-7 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ borderBottom: `1px solid ${T.border.line}` }}
        >
          {TABS.map((tab) => {
            const isActive = activeFilter === tab.id
            const count = countForTab(submissions, tab.id)

            return (
              <button
                key={tab.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActiveFilter(tab.id)}
                className="-mb-px flex items-center gap-2 whitespace-nowrap"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? `3px solid ${T.accent.primary}`
                    : "3px solid transparent",
                  padding: "12px 14px 10px",
                  cursor: "pointer",
                  fontFamily: T.font.sans,
                  fontSize: "15px",
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? T.ink.base : T.ink.dim,
                  transition: "color 150ms",
                }}
              >
                {tab.label}
                <span
                  className="rounded-full px-2 text-[13px] font-semibold"
                  style={{
                    background: isActive ? T.accent.chip : T.bg.muted,
                    color: isActive ? T.accent.primary : T.ink.dim,
                    lineHeight: "20px",
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        <div aria-live="polite">
          {isLoading ? (
            <SkeletonCards />
          ) : filtered.length === 0 ? (
            <EmptyState filter={activeFilter} />
          ) : (
            <SubmissionList submissions={filtered} />
          )}
        </div>
      </div>
    </>
  )
}

function SubmissionList({ submissions }: { submissions: Submission[] }) {
  const [visibleCount, setVisibleCount] = useState(5)
  const visible = submissions.slice(0, visibleCount)
  const remaining = submissions.length - visibleCount

  return (
    <div className="flex flex-col gap-4">
      {visible.map((sub, i) => (
        <SubmissionCard key={sub.documentId} submission={sub} index={i} />
      ))}
      {remaining > 0 && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + 9)}
          className="self-center rounded-full border px-6 py-2.5 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface)"
          style={{
            borderColor: T.border.hi,
            background: T.bg.deep,
            color: T.ink.base,
            cursor: "pointer",
          }}
        >
          {`Load ${remaining} earlier submission${remaining === 1 ? "" : "s"}`}
        </button>
      )}
    </div>
  )
}
