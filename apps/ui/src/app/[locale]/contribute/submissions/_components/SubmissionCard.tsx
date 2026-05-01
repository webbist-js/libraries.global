"use client"

import React from "react"

import type { Submission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

// ---------------------------------------------------------------------------
// CSS animations (injected once)
// ---------------------------------------------------------------------------

const CARD_ANIMATIONS = `
@keyframes sub-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes progress-shimmer {
  0%   { opacity: 0.6; }
  50%  { opacity: 1; }
  100% { opacity: 0.6; }
}
`

let injected = false

function injectAnimations() {
  if (injected || typeof document === "undefined") return

  injected = true

  const s = document.createElement("style")
  s.textContent = CARD_ANIMATIONS
  document.head.append(s)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)

  if (mins < 2) return "Just now"
  if (mins < 60) return `${mins}m ago`

  const hours = Math.floor(mins / 60)

  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)

  if (days < 7) return `${days}d ago`

  return new Date(dateStr)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase()
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const date = d
    .toLocaleDateString("en-US", { day: "numeric", month: "short" })
    .toUpperCase()
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return `${date} · ${time}`
}

function getChangeDescription(submission: Submission): string {
  if (submission.editSummary) return submission.editSummary
  if (submission.note) return submission.note

  const fieldCount = Object.values(submission.fields ?? {}).filter(
    (v) =>
      v !== null &&
      v !== undefined &&
      v !== "" &&
      !(Array.isArray(v) && v.length === 0)
  ).length

  if (fieldCount > 0) {
    return `${fieldCount} field${fieldCount === 1 ? "" : "s"} provided`
  }

  return "Submitted for review"
}

function buildEyebrowParts(submission: Submission): string[] {
  const parts: string[] = []
  const fields = submission.fields ?? {}

  if (fields.country) parts.push(String(fields.country).toUpperCase())
  if (fields.city) parts.push(String(fields.city).toUpperCase())
  if (submission.createdAt) {
    parts.push(`SUBMITTED ${formatDateTime(submission.createdAt)}`)
  }

  return parts
}

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  draft: {
    label: "DRAFT",
    color: T.ink.faint,
    bg: T.bg.deep,
    border: T.border.line,
  },
  pending: {
    label: "UNDER REVIEW",
    color: T.accent.aurora,
    bg: "rgba(127,223,255,0.08)",
    border: "rgba(127,223,255,0.30)",
  },
  approved: {
    label: "APPROVED",
    color: T.accent.ok,
    bg: "rgba(142,240,179,0.08)",
    border: "rgba(142,240,179,0.30)",
  },
  needs_info: {
    label: "CHANGES REQUESTED",
    color: T.accent.warn,
    bg: "rgba(255,207,122,0.08)",
    border: "rgba(255,207,122,0.30)",
  },
  rejected: {
    label: "REJECTED",
    color: T.accent.danger,
    bg: "rgba(255,138,138,0.08)",
    border: "rgba(255,138,138,0.30)",
  },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  new_library: { label: "ADD", color: T.accent.ok },
  library_edit: { label: "EDIT", color: T.accent.aurora },
  correction: { label: "CORRECTION", color: T.accent.aurora },
  library_claim: { label: "CLAIM", color: T.accent.violet },
  wiki_edit: { label: "WIKI", color: T.accent.violet },
  blog_submission: { label: "BLOG", color: T.accent.gold },
  topic_suggestion: { label: "TOPIC", color: T.ink.faint },
}

// ---------------------------------------------------------------------------
// Pipeline — two-row layout
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  "SUBMITTED",
  "UNDER\u00A0REVIEW",
  "APPROVED",
  "PUBLISHED",
] as const

const STAGE_INDEX_BY_STATUS: Record<string, number> = {
  pending: 1,
  needs_info: 1,
  approved: 2,
  published: 3,
}

function getPipelineState(status: string) {
  const isRejected = status === "rejected"

  return {
    isRejected,
    stageIndex: isRejected ? 1 : (STAGE_INDEX_BY_STATUS[status] ?? 1),
  }
}

function getPipelineDotState({
  index,
  stageIndex,
  isRejected,
}: {
  index: number
  stageIndex: number
  isRejected: boolean
}) {
  return {
    done: index < stageIndex,
    current: index === stageIndex && !isRejected,
    failed: isRejected && index === 1,
  }
}

function getPipelineLineColor({
  index,
  stageIndex,
  isRejected,
}: {
  index: number
  stageIndex: number
  isRejected: boolean
}) {
  if (index === 0) return "transparent"
  if (isRejected && index <= 1) return T.accent.danger
  if (index <= stageIndex) return T.accent.aurora

  return T.border.line
}

function getPipelineDotStyles({
  done,
  current,
  failed,
}: {
  done: boolean
  current: boolean
  failed: boolean
}) {
  if (failed) {
    return {
      background: T.accent.danger,
      border: T.accent.danger,
      boxShadow: `0 0 7px ${T.accent.danger}55`,
    }
  }

  if (current) {
    return {
      background: T.accent.aurora,
      border: T.accent.aurora,
      boxShadow: `0 0 7px ${T.accent.aurora}55`,
    }
  }

  if (done) {
    return {
      background: "rgba(127,223,255,0.22)",
      border: T.accent.aurora,
      boxShadow: "none",
    }
  }

  return {
    background: T.bg.surface,
    border: T.border.line,
    boxShadow: "none",
  }
}

function getPipelineLabelColor({
  done,
  current,
  failed,
}: {
  done: boolean
  current: boolean
  failed: boolean
}) {
  if (failed) return T.accent.danger
  if (current) return T.ink.base
  if (done) return T.ink.dim

  return T.ink.faint
}

function SubmissionPipeline({ status }: { status: string }) {
  if (status === "draft") return null

  const { isRejected, stageIndex } = getPipelineState(status)

  return (
    <div style={{ marginTop: "16px", maxWidth: "480px" }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        {PIPELINE_STAGES.map((stage, index) => {
          const dotState = getPipelineDotState({
            index,
            stageIndex,
            isRejected,
          })
          const dotStyles = getPipelineDotStyles(dotState)
          const isActiveSegment =
            !isRejected && index === stageIndex && index > 0

          return (
            <React.Fragment key={stage}>
              {index > 0 && (
                <div
                  style={{
                    flex: 1,
                    height: "1.5px",
                    background: getPipelineLineColor({
                      index,
                      stageIndex,
                      isRejected,
                    }),
                    borderRadius: "1px",
                    animation: isActiveSegment
                      ? "progress-shimmer 2.4s ease-in-out infinite"
                      : undefined,
                  }}
                />
              )}

              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: dotStyles.background,
                  border: `1.5px solid ${dotStyles.border}`,
                  flexShrink: 0,
                  transition: "background 0.3s, box-shadow 0.3s",
                  boxShadow: dotStyles.boxShadow,
                }}
              />
            </React.Fragment>
          )
        })}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "5px",
        }}
      >
        {PIPELINE_STAGES.map((stage, index) => {
          const dotState = getPipelineDotState({
            index,
            stageIndex,
            isRejected,
          })

          return (
            <span
              key={stage}
              style={{
                fontFamily: T.font.mono,
                fontSize: "7.5px",
                letterSpacing: ".08em",
                textTransform: "uppercase",
                color: getPipelineLabelColor(dotState),
                lineHeight: 1,
                textAlign:
                  index === 0
                    ? "left"
                    : index === PIPELINE_STAGES.length - 1
                      ? "right"
                      : "center",
              }}
            >
              {stage}
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right-side status panel
// ---------------------------------------------------------------------------

function StatusPanelRow({
  label,
  value,
  valueColor,
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "9px",
          letterSpacing: ".14em",
          textTransform: "uppercase",
          color: T.ink.faint,
          marginBottom: "2px",
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "11px",
          letterSpacing: ".06em",
          color: valueColor ?? T.ink.dim,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function StatusPanel({ submission }: { submission: Submission }) {
  const { status, updatedAt, createdAt, reviewedAt } = submission

  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    minWidth: "172px",
    maxWidth: "192px",
    flexShrink: 0,
    paddingLeft: "20px",
    borderLeft: `1px solid ${T.border.line}`,
  }

  if (status === "draft") {
    return (
      <div style={panelStyle}>
        <StatusPanelRow
          label="Last saved"
          value={formatRelativeTime(updatedAt ?? createdAt)}
        />
        <StatusPanelRow label="Status" value="In progress" />

        <div style={{ marginTop: "2px" }}>
          <Link
            href="/contribute/add"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "7px 14px",
              borderRadius: "6px",
              border: `1px solid rgba(127,223,255,0.28)`,
              background: "rgba(127,223,255,0.07)",
              color: T.accent.aurora,
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            Continue →
          </Link>
        </div>
      </div>
    )
  }

  if (status === "pending") {
    return (
      <div style={panelStyle}>
        <StatusPanelRow
          label="Status"
          value="Awaiting review"
          valueColor={T.accent.aurora}
        />
        <StatusPanelRow label="Est. response" value="2–5 days" />
        <StatusPanelRow label="Reviewer" value="Editorial board" />
      </div>
    )
  }

  if (status === "needs_info") {
    return (
      <div style={panelStyle}>
        <StatusPanelRow
          label="Action required"
          value="Respond to reviewer"
          valueColor={T.accent.warn}
        />
        <StatusPanelRow
          label="Requested"
          value={formatRelativeTime(updatedAt ?? createdAt)}
        />
        <StatusPanelRow label="Items to address" value="See note below" />
      </div>
    )
  }

  if (status === "approved") {
    return (
      <div style={panelStyle}>
        <StatusPanelRow
          label="Decision"
          value="Approved"
          valueColor={T.accent.ok}
        />
        <StatusPanelRow
          label="Reviewed"
          value={reviewedAt ? formatRelativeTime(reviewedAt) : "—"}
        />
        <StatusPanelRow label="Publishing" value="Next build queue" />
      </div>
    )
  }

  if (status === "rejected") {
    return (
      <div style={panelStyle}>
        <StatusPanelRow
          label="Decision"
          value="Not accepted"
          valueColor={T.accent.danger}
        />
        <StatusPanelRow
          label="Reviewed"
          value={reviewedAt ? formatRelativeTime(reviewedAt) : "—"}
        />
      </div>
    )
  }

  return null
}

// ---------------------------------------------------------------------------
// Editorial note
// ---------------------------------------------------------------------------

function EditorialNote({
  note,
  status,
}: {
  note: string
  status: "needs_info" | "rejected"
}) {
  const isWarning = status === "needs_info"

  return (
    <div
      style={{
        marginTop: "16px",
        padding: "14px 16px",
        borderRadius: "10px",
        border: `1px solid ${
          isWarning ? T.accent.warn + "30" : T.accent.danger + "28"
        }`,
        background: isWarning
          ? "rgba(255,207,122,0.03)"
          : "rgba(255,138,138,0.02)",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "50%",
          background: isWarning
            ? "rgba(255,207,122,0.10)"
            : "rgba(255,138,138,0.10)",
          border: `1px solid ${isWarning ? T.accent.warn : T.accent.danger}40`,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: T.font.mono,
          fontSize: "9px",
          fontWeight: 700,
          color: isWarning ? T.accent.warn : T.accent.danger,
          marginTop: "1px",
        }}
      >
        EB
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: isWarning ? T.accent.warn : T.accent.danger,
            opacity: 0.75,
            marginBottom: "7px",
          }}
        >
          {isWarning ? "Editorial Board" : "Reviewer Note"}
        </div>

        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "14px",
            color: T.ink.dim,
            margin: 0,
            lineHeight: 1.65,
          }}
        >
          {note}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function SubmissionCard({
  submission,
  index = 0,
}: {
  submission: Submission
  index?: number
}) {
  React.useEffect(() => {
    injectAnimations()
  }, [])

  const statusCfg = STATUS_CONFIG[submission.status] ?? {
    label: "PENDING",
    color: T.accent.aurora,
    bg: "rgba(127,223,255,0.08)",
    border: "rgba(127,223,255,0.28)",
  }

  const typeCfg = TYPE_CONFIG[submission.submissionType] ?? {
    label: submission.submissionType.toUpperCase(),
    color: T.ink.faint,
  }

  const title =
    (submission.fields?.name as string | undefined) ??
    submission.targetSlug ??
    "Untitled submission"

  const eyebrowParts = buildEyebrowParts(submission)

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "14px",
        padding: "20px 24px",
        background: T.bg.surface,
        marginBottom: "12px",
        animation: `sub-fade-in 0.35s ease both`,
        animationDelay: `${index * 55}ms`,
        opacity: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "10px",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            display: "inline-block",
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".16em",
            textTransform: "uppercase",
            color: typeCfg.color,
            background: `${typeCfg.color}14`,
            border: `1px solid ${typeCfg.color}38`,
            borderRadius: "4px",
            padding: "3px 8px",
            flexShrink: 0,
          }}
        >
          {typeCfg.label}
        </span>

        {eyebrowParts.length > 0 && (
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".08em",
              color: T.ink.faint,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
            }}
          >
            {eyebrowParts.join(" · ")}
          </span>
        )}

        <div style={{ marginLeft: "auto", flexShrink: 0 }}>
          <div
            style={{
              background: statusCfg.bg,
              border: `1px solid ${statusCfg.border}`,
              borderRadius: "20px",
              padding: "4px 12px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: statusCfg.color,
                whiteSpace: "nowrap",
              }}
            >
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: T.font.sans,
              fontSize: "17px",
              fontWeight: 500,
              color: T.ink.base,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              lineHeight: 1.3,
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.faint,
              marginTop: "3px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {getChangeDescription(submission)}
          </div>

          <SubmissionPipeline status={submission.status} />
        </div>

        <StatusPanel submission={submission} />
      </div>

      {submission.status === "needs_info" && submission.reviewNote && (
        <EditorialNote note={submission.reviewNote} status="needs_info" />
      )}

      {submission.status === "rejected" && submission.reviewNote && (
        <EditorialNote note={submission.reviewNote} status="rejected" />
      )}
    </div>
  )
}
