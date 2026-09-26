"use client"

import { useEffect, useState } from "react"

import { useMySubmissions, type Submission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"

import { SubmissionCard } from "./SubmissionCard"
import { ContributeNavBar } from "../../_components/ContributeNavBar"
import { ContributeSubpageHero } from "../../_components/ContributeSubpageHero"

const TABS = [
  { id: "all", label: "ALL" },
  { id: "draft", label: "DRAFTS" },
  { id: "pending", label: "UNDER REVIEW" },
  { id: "needs_info", label: "CHANGES REQUESTED" },
  { id: "approved", label: "APPROVED" },
  { id: "rejected", label: "REJECTED" },
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
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            background: T.bg.surface,
            borderRadius: "12px",
            height: "120px",
            marginBottom: "12px",
            animation: "pulse 2s cubic-bezier(.4,0,.6,1) infinite",
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
      : `No ${filter.replace("_", " ")} submissions`
  const description =
    filter === "all"
      ? "Your library additions, edits, and corrections will appear here once submitted."
      : "No submissions matching this filter at the moment."

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "60px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.ink.faint,
          marginBottom: "14px",
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          color: T.ink.dim,
          maxWidth: "360px",
          lineHeight: 1.65,
          margin: 0,
        }}
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
      <ContributeSubpageHero
        section="My Submissions"
        badge={
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
            }}
          >
            Auto-refresh · 60s
          </span>
        }
        heading="Your"
        headingItalic="contributions,"
        accentColor={T.ink.dim}
        headingAfter={
          <>
            <br />
            in flight.
          </>
        }
        body="Drafts, things under review, requests for changes, and recently published. Editorial board comments live alongside each one."
        minHeight="340px"
      />

      <ContributeNavBar />

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1360px] px-4 pt-10 pb-15 sm:px-8">
        {/* Filter tabs */}
        <div
          style={{
            display: "flex",
            gap: "0",
            overflowX: "auto",
            borderBottom: `1px solid ${T.border.line}`,
            marginBottom: "28px",
            scrollbarWidth: "none",
          }}
        >
          {TABS.map((tab) => {
            const isActive = activeFilter === tab.id
            const count = countForTab(submissions, tab.id)

            return (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: isActive
                    ? `2px solid ${T.accent.aurora}`
                    : "2px solid transparent",
                  padding: "10px 18px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  whiteSpace: "nowrap",
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  color: isActive ? T.ink.base : T.ink.faint,
                  transition: "color .15s, border-color .15s",
                }}
              >
                {tab.label}
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "13px",
                    background: isActive ? "var(--t-aurora-soft)" : T.bg.deep,
                    color: isActive ? T.accent.aurora : T.ink.faint,
                    borderRadius: "4px",
                    padding: "1px 6px",
                    lineHeight: 1.6,
                  }}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        {isLoading ? (
          <SkeletonCards />
        ) : filtered.length === 0 ? (
          <EmptyState filter={activeFilter} />
        ) : (
          <SubmissionList submissions={filtered} />
        )}
      </div>
    </>
  )
}

function SubmissionList({ submissions }: { submissions: Submission[] }) {
  const [visibleCount, setVisibleCount] = useState(5)
  const visible = submissions.slice(0, visibleCount)
  const remaining = submissions.length - visibleCount

  return (
    <div>
      {visible.map((sub, i) => (
        <SubmissionCard key={sub.documentId} submission={sub} index={i} />
      ))}
      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount((c) => c + 9)}
          style={{
            padding: "12px 24px",
            borderRadius: "10px",
            border: `1px solid ${T.border.line}`,
            background: "transparent",
            color: T.ink.faint,
            fontFamily: T.font.sans,
            fontSize: "13px",
            cursor: "pointer",
            width: "100%",
            marginTop: "10px",
          }}
        >
          {`Load ${remaining} earlier submission${remaining === 1 ? "" : "s"} →`}
        </button>
      )}
    </div>
  )
}
