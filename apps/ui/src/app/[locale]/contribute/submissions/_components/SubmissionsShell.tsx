"use client"

import { useEffect, useState } from "react"

import { ContributeHeroShell } from "@/components/ds"
import { useMySubmissions, type Submission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"

import { SubmissionCard } from "./SubmissionCard"
import { ContributeNavBar } from "../../_components/ContributeNavBar"

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
            background: "rgba(255,255,255,0.04)",
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
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".18em",
          textTransform: "uppercase",
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
      <ContributeHeroShell
        minHeight="340px"
        overlay="radial-gradient(ellipse 70% 90% at 30% 40%, rgba(127,223,255,0.04) 0%, transparent 60%), linear-gradient(to bottom, rgba(3,5,17,0) 0%, rgba(3,5,17,0.80) 100%)"
      >
        <div className="relative z-10 mx-auto w-full max-w-5xl px-6 pt-32 pb-12 md:px-10">
          {/* Eyebrow row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
            }}
          >
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".20em",
                textTransform: "uppercase",
                color: T.accent.aurora,
                opacity: 0.7,
                margin: 0,
              }}
            >
              Contribute / My Submissions
            </p>
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.ink.faint,
              }}
            >
              Auto-refresh · 60s
            </span>
          </div>

          {/* H1 */}
          <h1
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(2.8rem, 6vw, 5rem)",
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 0.95,
              color: T.ink.base,
              margin: "0 0 18px",
            }}
          >
            Your{" "}
            <em
              style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: "rgba(244,247,255,0.55)",
              }}
            >
              contributions
            </em>
            ,
            <br />
            in flight.
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "15px",
              color: T.ink.dim,
              lineHeight: 1.65,
              margin: 0,
              maxWidth: "52ch",
            }}
          >
            Drafts, things under review, requests for changes, and recently
            published. Editorial board comments live alongside each one.
          </p>
        </div>
      </ContributeHeroShell>

      <ContributeNavBar />

      {/* ── Content ────────────────────────────────────────────────────── */}
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          padding: "40px 24px 60px",
        }}
      >
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
                  fontFamily: T.font.mono,
                  fontSize: "10px",
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
                    fontSize: "9px",
                    letterSpacing: ".06em",
                    background: isActive
                      ? "rgba(127,223,255,0.12)"
                      : "rgba(255,255,255,0.06)",
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
            borderRadius: "8px",
            border: `1px solid ${T.border.line}`,
            background: "transparent",
            color: T.ink.faint,
            fontFamily: T.font.mono,
            fontSize: "11px",
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
