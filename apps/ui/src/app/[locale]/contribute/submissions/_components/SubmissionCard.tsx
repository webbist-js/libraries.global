"use client"

import { Icon } from "@iconify/react"
import React from "react"

import type { Submission } from "@/hooks/useSubmissions"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

// ---------------------------------------------------------------------------
// CSS animations (injected once)
// ---------------------------------------------------------------------------

const CARD_ANIMATIONS = `
@keyframes sub-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
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

  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr)
  const date = d.toLocaleDateString("en-US", { day: "numeric", month: "short" })
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

  if (fields.country) parts.push(String(fields.country))
  if (fields.city) parts.push(String(fields.city))
  if (submission.createdAt) {
    parts.push(`Submitted ${formatDateTime(submission.createdAt)}`)
  }

  return parts
}

function humanizeType(type: string): string {
  const label = type.replaceAll("_", " ")

  return label.charAt(0).toUpperCase() + label.slice(1)
}

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

type StatusStyle = { label: string; icon: string; bg: string; fg: string }

const PENDING_STATUS: StatusStyle = {
  label: "Under review",
  icon: "mdi:clock-outline",
  bg: TYPE_TINT.academic.bg,
  fg: TYPE_TINT.academic.fg,
}

const STATUS_CONFIG: Record<string, StatusStyle> = {
  draft: {
    label: "Draft",
    icon: "mdi:pencil-outline",
    bg: TYPE_TINT.neutral.bg,
    fg: TYPE_TINT.neutral.fg,
  },
  pending: PENDING_STATUS,
  approved: {
    label: "Approved",
    icon: "mdi:check-circle-outline",
    bg: "#E6EFE6",
    fg: T.accent.ok,
  },
  needs_info: {
    label: "Changes requested",
    icon: "mdi:alert-circle-outline",
    bg: "#F5EEDC",
    fg: T.accent.warn,
  },
  rejected: {
    label: "Rejected",
    icon: "mdi:close-circle-outline",
    bg: "#F6E3DA",
    fg: T.accent.danger,
  },
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; fg: string }> = {
  new_library: { label: "Addition", ...TYPE_TINT.public },
  library_edit: { label: "Edit", ...TYPE_TINT.academic },
  correction: { label: "Correction", ...TYPE_TINT.academic },
  library_claim: { label: "Claim", ...TYPE_TINT.national },
  wiki_edit: { label: "Docs", ...TYPE_TINT.national },
  blog_submission: { label: "Journal", ...TYPE_TINT.special },
  topic_suggestion: { label: "Topic", ...TYPE_TINT.neutral },
}

// ---------------------------------------------------------------------------
// Pipeline — two-row layout
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  "Submitted",
  "Under review",
  "Approved",
  "Published",
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
  if (index <= stageIndex) return T.accent.primary

  return T.border.hi
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
      boxShadow: "0 0 0 3px #F6E3DA",
    }
  }

  if (current) {
    return {
      background: T.accent.primary,
      border: T.accent.primary,
      boxShadow: `0 0 0 3px ${T.accent.chip}`,
    }
  }

  if (done) {
    return {
      background: T.accent.primary,
      border: T.accent.primary,
      boxShadow: "none",
    }
  }

  return {
    background: T.bg.deep,
    border: T.border.hi,
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

  return T.ink.low
}

function SubmissionPipeline({ status }: { status: string }) {
  if (status === "draft") return null

  const { isRejected, stageIndex } = getPipelineState(status)

  return (
    <div className="mt-5 max-w-[480px]">
      <div className="flex items-center px-1" aria-hidden="true">
        {PIPELINE_STAGES.map((stage, index) => {
          const dotState = getPipelineDotState({
            index,
            stageIndex,
            isRejected,
          })
          const dotStyles = getPipelineDotStyles(dotState)

          return (
            <React.Fragment key={stage}>
              {index > 0 && (
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background: getPipelineLineColor({
                      index,
                      stageIndex,
                      isRejected,
                    }),
                    borderRadius: "1px",
                  }}
                />
              )}

              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  background: dotStyles.background,
                  border: `2px solid ${dotStyles.border}`,
                  flexShrink: 0,
                  transition: "background 0.3s",
                  boxShadow: dotStyles.boxShadow,
                }}
              />
            </React.Fragment>
          )
        })}
      </div>

      <ol className="m-0 mt-2 flex list-none justify-between gap-2 p-0">
        {PIPELINE_STAGES.map((stage, index) => {
          const dotState = getPipelineDotState({
            index,
            stageIndex,
            isRejected,
          })

          return (
            <li
              key={stage}
              aria-current={dotState.current ? "step" : undefined}
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                fontWeight: dotState.current || dotState.failed ? 600 : 500,
                color: getPipelineLabelColor(dotState),
                lineHeight: 1.3,
                textAlign:
                  index === 0
                    ? "left"
                    : index === PIPELINE_STAGES.length - 1
                      ? "right"
                      : "center",
              }}
            >
              {stage}
            </li>
          )
        })}
      </ol>
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
      <dt className="text-[14px]" style={{ color: T.ink.dim }}>
        {label}
      </dt>
      <dd
        className="m-0 text-[15px] font-semibold"
        style={{ color: valueColor ?? T.ink.base }}
      >
        {value}
      </dd>
    </div>
  )
}

const PANEL_CLASS =
  "m-0 flex shrink-0 flex-col gap-3 border-t pt-4 sm:w-[200px] sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6"

function StatusPanel({ submission }: { submission: Submission }) {
  const { status, updatedAt, createdAt, reviewedAt } = submission

  const panelStyle: React.CSSProperties = { borderColor: T.border.divider }

  if (status === "draft") {
    return (
      <dl className={PANEL_CLASS} style={panelStyle}>
        <StatusPanelRow
          label="Last saved"
          value={formatRelativeTime(updatedAt ?? createdAt)}
        />
        <StatusPanelRow label="Status" value="In progress" />

        <div className="mt-1">
          <Link
            href="/contribute/add"
            className="inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[15px] font-semibold whitespace-nowrap text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
            style={{ background: T.accent.primary }}
          >
            Continue
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </dl>
    )
  }

  if (status === "pending") {
    return (
      <dl className={PANEL_CLASS} style={panelStyle}>
        <StatusPanelRow
          label="Status"
          value="Awaiting review"
          valueColor={T.accent.primary}
        />
        <StatusPanelRow label="Est. response" value="2–5 days" />
        <StatusPanelRow label="Reviewer" value="Editorial board" />
      </dl>
    )
  }

  if (status === "needs_info") {
    return (
      <dl className={PANEL_CLASS} style={panelStyle}>
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
      </dl>
    )
  }

  if (status === "approved") {
    return (
      <dl className={PANEL_CLASS} style={panelStyle}>
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
      </dl>
    )
  }

  if (status === "rejected") {
    return (
      <dl className={PANEL_CLASS} style={panelStyle}>
        <StatusPanelRow
          label="Decision"
          value="Not accepted"
          valueColor={T.accent.danger}
        />
        <StatusPanelRow
          label="Reviewed"
          value={reviewedAt ? formatRelativeTime(reviewedAt) : "—"}
        />
      </dl>
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
  const fg = isWarning ? T.accent.warn : T.accent.danger

  return (
    <div
      className="mt-5 flex items-start gap-3.5 rounded-[14px] px-5 py-4"
      style={{ background: isWarning ? "#F5EEDC" : "#F6E3DA" }}
    >
      <div
        aria-hidden="true"
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
        style={{ background: T.bg.deep, color: fg }}
      >
        EB
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="m-0 mb-1 flex items-center gap-1.5 text-[14px] font-semibold"
          style={{ color: fg }}
        >
          <Icon
            icon={
              isWarning ? "mdi:message-alert-outline" : "mdi:message-outline"
            }
            width={16}
            height={16}
            aria-hidden="true"
          />
          {isWarning ? "Editorial board" : "Reviewer note"}
        </p>

        <p
          className="m-0 text-[15px] leading-[1.6]"
          style={{ color: T.ink.base }}
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

  const statusCfg = STATUS_CONFIG[submission.status] ?? PENDING_STATUS

  const typeCfg = TYPE_CONFIG[submission.submissionType] ?? {
    label: humanizeType(submission.submissionType),
    ...TYPE_TINT.neutral,
  }

  const title =
    (submission.fields?.name as string | undefined) ??
    submission.targetSlug ??
    "Untitled submission"

  const eyebrowParts = buildEyebrowParts(submission)

  return (
    <article
      className="rounded-[20px] px-5 py-5 sm:px-7 sm:py-6"
      style={{
        border: `1px solid ${T.border.line}`,
        background: T.bg.deep,
        animation: `sub-fade-in 0.35s ease both`,
        animationDelay: `${index * 55}ms`,
        opacity: 0,
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span
          className="shrink-0 rounded-full px-3 py-1 text-[13px] font-semibold"
          style={{ background: typeCfg.bg, color: typeCfg.fg }}
        >
          {typeCfg.label}
        </span>

        {eyebrowParts.length > 0 && (
          <span className="min-w-0 text-[14px]" style={{ color: T.ink.dim }}>
            {eyebrowParts.join(" · ")}
          </span>
        )}

        <span
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold whitespace-nowrap"
          style={{ background: statusCfg.bg, color: statusCfg.fg }}
        >
          <Icon
            icon={statusCfg.icon}
            width={14}
            height={14}
            aria-hidden="true"
          />
          {statusCfg.label}
        </span>
      </div>

      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div className="min-w-0 flex-1">
          <h3
            className="m-0 break-words"
            style={{
              fontFamily: T.font.serif,
              fontSize: "22px",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
              color: T.ink.base,
            }}
          >
            {title}
          </h3>

          <p
            className="mt-1 mb-0 text-[15px] leading-[1.55] break-words"
            style={{ color: T.ink.dim }}
          >
            {getChangeDescription(submission)}
          </p>

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
    </article>
  )
}
