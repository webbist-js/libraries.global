"use client"

import { useEffect, useState } from "react"

import { useMySubmissions, type Submission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"

import { SubmissionCard } from "./SubmissionCard"

const TABS = [
  { id: "all", label: "ALL" },
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
            background: "rgba(255,255,255,0.04)",
            borderRadius: "12px",
            height: "100px",
            marginBottom: "12px",
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
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
          color: T.ink.faint,
          marginBottom: "12px",
        }}
      >
        {label}
      </div>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "13px",
          color: T.ink.dim,
          maxWidth: "320px",
          lineHeight: 1.6,
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
    <div
      style={{
        maxWidth: "760px",
        margin: "0 auto",
        padding: "32px 20px 40px",
      }}
    >
      {/* Breadcrumb + auto-refresh row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          CONTRIBUTE / MY SUBMISSIONS
        </span>
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.ink.faint,
          }}
        >
          AUTO-REFRESH · 60S
        </span>
      </div>

      {/* Page heading */}
      <h1
        style={{
          fontFamily: T.font.serif,
          fontWeight: 700,
          fontSize: "clamp(1.8rem, 4vw, 3rem)",
          color: T.ink.base,
          margin: "0 0 12px",
          lineHeight: 1.15,
        }}
      >
        Your <em style={{ fontStyle: "italic" }}>contributions</em>, in flight.
      </h1>
      <p
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          color: T.ink.dim,
          lineHeight: 1.65,
          margin: "0 0 32px",
          maxWidth: "560px",
        }}
      >
        Drafts, things under review, requests for changes, and recently
        published. Editorial board comments live alongside each one.
      </p>

      {/* Filter tabs */}
      <div
        style={{
          display: "flex",
          gap: "0",
          overflowX: "auto",
          borderBottom: `1px solid ${T.border.line}`,
          marginBottom: "24px",
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
                padding: "8px 16px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: isActive ? T.ink.base : T.ink.faint,
                transition: "color .15s, border-color .15s",
              }}
            >
              {tab.label}
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "8px",
                  letterSpacing: ".08em",
                  background: isActive
                    ? "rgba(127,223,255,0.12)"
                    : "rgba(255,255,255,0.06)",
                  color: isActive ? T.accent.aurora : T.ink.faint,
                  borderRadius: "4px",
                  padding: "1px 5px",
                  lineHeight: 1.5,
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
  )
}

function SubmissionList({ submissions }: { submissions: Submission[] }) {
  const [visibleCount, setVisibleCount] = useState(5)
  const visible = submissions.slice(0, visibleCount)
  const remaining = submissions.length - visibleCount

  return (
    <div>
      {visible.map((sub) => (
        <SubmissionCard key={sub.documentId} submission={sub} />
      ))}
      {remaining > 0 && (
        <button
          onClick={() => setVisibleCount((c) => c + 9)}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: `1px solid ${T.border.line}`,
            background: "transparent",
            color: T.ink.faint,
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".12em",
            cursor: "pointer",
            width: "100%",
            marginTop: "8px",
            textTransform: "uppercase",
          }}
        >
          {`Load ${remaining} earlier submission${remaining === 1 ? "" : "s"} →`}
        </button>
      )}
    </div>
  )
}
