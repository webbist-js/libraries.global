"use client"

import React from "react"

import type { Submission } from "@/hooks/useSubmissions"
import { T } from "@/lib/design-tokens"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return "Just now"
  if (hours < 24) return `${hours}H AGO`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} DAYS AGO`

  return new Date(dateStr)
    .toLocaleDateString("en-US", { month: "short", day: "numeric" })
    .toUpperCase()
}

function getChangeDescription(submission: Submission): string {
  const fieldCount = Object.keys(submission.fields ?? {}).length
  if (fieldCount > 0)
    return `${fieldCount} field${fieldCount === 1 ? "" : "s"} changed`
  if (submission.editSummary) return submission.editSummary
  if (submission.note) return submission.note

  return "Submitted for review"
}

function getSubtext(submission: Submission): string {
  const fields = submission.fields ?? {}
  const parts: string[] = []
  if (fields.country) parts.push(String(fields.country))
  if (fields.libraryType) parts.push(String(fields.libraryType))
  if (fields.collectionSize) parts.push(String(fields.collectionSize))
  if (parts.length > 0) return parts.join(" · ")

  return (
    TYPE_CONFIG[submission.submissionType]?.label ?? submission.submissionType
  )
}

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  pending: {
    label: "UNDER REVIEW",
    color: T.accent.aurora,
    bg: "rgba(127,223,255,0.1)",
    border: "rgba(127,223,255,0.3)",
  },
  approved: {
    label: "APPROVED",
    color: T.accent.ok,
    bg: "rgba(142,240,179,0.1)",
    border: "rgba(142,240,179,0.3)",
  },
  needs_info: {
    label: "CHANGES REQUESTED",
    color: T.accent.warn,
    bg: "rgba(255,207,122,0.1)",
    border: "rgba(255,207,122,0.3)",
  },
  rejected: {
    label: "REJECTED",
    color: T.accent.danger,
    bg: "rgba(255,138,138,0.1)",
    border: "rgba(255,138,138,0.3)",
  },
}

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  new_library: { label: "ADD", color: T.accent.ok },
  library_edit: { label: "EDIT", color: T.accent.aurora },
  correction: { label: "EDIT", color: T.accent.aurora },
  library_claim: { label: "CLAIM", color: T.accent.violet },
  wiki_edit: { label: "WIKI", color: T.accent.violet },
  blog_submission: { label: "BLOG", color: T.accent.gold },
  topic_suggestion: { label: "TOPIC", color: T.ink.faint },
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

function SubmissionPipeline({ status }: { status: string }) {
  const stages = ["SUBMITTED", "UNDER REVIEW", "APPROVED", "PUBLISHED"]
  const stageIndex =
    (
      {
        pending: 1,
        needs_info: 1,
        approved: 2,
        rejected: 1,
      } as Record<string, number>
    )[status] ?? 1

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0",
        margin: "12px 0 4px",
      }}
    >
      {stages.map((stage, i) => {
        const done = i <= stageIndex
        const current = i === stageIndex

        return (
          <React.Fragment key={stage}>
            {i > 0 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  background: done ? T.accent.aurora : T.border.line,
                  opacity: done ? 1 : 0.5,
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  background: current
                    ? T.accent.aurora
                    : done
                      ? "rgba(127,223,255,0.4)"
                      : T.border.hi,
                  boxShadow: current ? `0 0 8px ${T.accent.aurora}` : "none",
                  border: `2px solid ${done || current ? T.accent.aurora : T.border.line}`,
                }}
              />
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "7px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: current ? T.ink.base : T.ink.faint,
                  whiteSpace: "nowrap",
                }}
              >
                {stage}
              </span>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export function SubmissionCard({ submission }: { submission: Submission }) {
  const statusCfg = STATUS_CONFIG[submission.status] ?? STATUS_CONFIG.pending
  const typeCfg = TYPE_CONFIG[submission.submissionType] ?? {
    label: submission.submissionType.toUpperCase(),
    color: T.ink.faint,
  }

  const entityMeta = [submission.targetEntityType, submission.targetSlug]
    .filter(Boolean)
    .join(" · ")

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "14px",
        padding: "20px 24px",
        background: "rgba(255,255,255,0.02)",
        marginBottom: "12px",
        position: "relative",
      }}
    >
      {/* Status badge — top right */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "20px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: statusCfg.bg,
          border: `1px solid ${statusCfg.border}`,
          borderRadius: "20px",
          padding: "3px 10px",
        }}
      >
        <span
          style={{
            fontFamily: T.font.mono,
            fontSize: "7px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: statusCfg.color,
          }}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "10px",
          paddingRight: "130px",
        }}
      >
        {/* Type chip */}
        <span
          style={{
            display: "inline-block",
            fontFamily: T.font.mono,
            fontSize: "7px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: typeCfg.color,
            background: `${typeCfg.color}18`,
            border: `1px solid ${typeCfg.color}44`,
            borderRadius: "4px",
            padding: "3px 7px",
            flexShrink: 0,
            marginTop: "1px",
          }}
        >
          {typeCfg.label}
        </span>

        {/* Entity info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {entityMeta && (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".1em",
                color: T.ink.dim,
                display: "block",
                marginBottom: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {entityMeta}
            </span>
          )}
          {/* Timestamp */}
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".1em",
              color: T.ink.faint,
              textTransform: "uppercase",
            }}
          >
            {formatRelativeTime(submission.createdAt)}
          </span>
        </div>
      </div>

      {/* Title line */}
      <div
        style={{
          fontFamily: T.font.sans,
          fontSize: "14px",
          fontWeight: 500,
          color: T.ink.base,
          margin: "10px 0 4px",
          paddingRight: "130px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {submission.targetSlug ?? "Untitled submission"}
        {" — "}
        <span style={{ color: T.ink.dim }}>
          {getChangeDescription(submission)}
        </span>
      </div>

      {/* Subtext */}
      <div
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".08em",
          color: T.ink.faint,
          textTransform: "uppercase",
          marginBottom: "2px",
        }}
      >
        {getSubtext(submission)}
      </div>

      {/* Pipeline */}
      <SubmissionPipeline status={submission.status} />

      {/* Editorial comment (needs_info only) */}
      {submission.status === "needs_info" && submission.reviewNote && (
        <div
          style={{
            marginTop: "12px",
            padding: "12px 16px",
            borderRadius: "10px",
            border: `1px solid ${T.accent.warn}33`,
            background: "rgba(255,207,122,0.04)",
          }}
        >
          <div
            style={{
              fontFamily: T.font.mono,
              fontSize: "7px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
              marginBottom: "6px",
            }}
          >
            Jean-Marc Lefèvre · EDITORIAL BOARD
          </div>
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              color: T.ink.dim,
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            {submission.reviewNote}
          </p>
        </div>
      )}
    </div>
  )
}
