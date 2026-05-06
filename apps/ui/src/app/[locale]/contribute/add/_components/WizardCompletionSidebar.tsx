"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

import type { FormData } from "./wizard.types"

// One check per step — mirrors calcScore exactly.
const STEP_CHECKS = (f: FormData) => [
  {
    step: 1,
    label: "Identity",
    detail: "Name, type & status",
    done: !!f.name && !!f.libraryType && !!f.operationalStatus,
  },
  {
    step: 2,
    label: "Location",
    detail: "City & country",
    done: !!f.city && !!f.country,
  },
  {
    step: 3,
    label: "Contact",
    detail: "Website or catalogue URL",
    done: !!(f.website || f.catalogueUrl),
  },
  {
    step: 4,
    label: "Collections",
    detail: "Collection size",
    done: !!f.collectionSize,
  },
  {
    step: 5,
    label: "History",
    detail: "Founded year",
    done: !!f.foundedYear,
  },
  {
    step: 6,
    label: "Imagery",
    detail: "Hero image URL",
    done: f.uploadedImages.length > 0,
  },
  {
    step: 7,
    label: "Sources",
    detail: "Evidence URL & summary",
    done: !!f.evidenceUrl && !!f.editSummary,
  },
]

interface WizardCompletionSidebarProps {
  score: number
  formData: FormData
}

export function WizardCompletionSidebar({
  score,
  formData,
}: WizardCompletionSidebarProps) {
  const checks = STEP_CHECKS(formData)
  const doneCount = checks.filter((c) => c.done).length

  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Completeness meter */}
      <div
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          padding: "16px",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "10px",
          }}
        >
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "11px",
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            Completeness
          </span>
          <span
            style={{
              fontFamily: T.font.serif,
              fontSize: "28px",
              color: T.ink.base,
              lineHeight: 1,
            }}
          >
            {score}
            <span style={{ fontSize: "14px", color: T.ink.dim }}> / 100</span>
          </span>
        </div>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Submission completeness: ${score}%`}
          style={{
            height: "4px",
            borderRadius: "2px",
            background: T.border.line,
            overflow: "hidden",
            marginBottom: "16px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${score}%`,
              background: score === 100 ? T.accent.ok : T.accent.aurora,
              borderRadius: "2px",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Step checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {checks.map((check) => (
            <div
              key={check.step}
              style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}
            >
              <Icon
                icon={check.done ? "mdi:check-circle" : "mdi:circle-outline"}
                style={{
                  color: check.done ? T.accent.aurora : T.ink.faint,
                  fontSize: "15px",
                  flexShrink: 0,
                  marginTop: "1px",
                }}
                aria-hidden="true"
              />
              <div>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "13px",
                    letterSpacing: ".06em",
                    color: check.done ? T.ink.base : T.ink.dim,
                    display: "block",
                    lineHeight: 1.3,
                  }}
                >
                  {check.label}
                </span>
                <span
                  style={{
                    fontFamily: T.font.mono,
                    fontSize: "11px",
                    letterSpacing: ".06em",
                    color: T.ink.faint,
                    display: "block",
                    marginTop: "2px",
                  }}
                >
                  {check.detail}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Legend */}
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".06em",
            color: T.ink.faint,
            margin: "14px 0 0",
            lineHeight: 1.6,
            borderTop: `1px solid ${T.border.line}`,
            paddingTop: "10px",
          }}
        >
          Score reflects one essential field group per step.{" "}
          <span style={{ color: T.accent.aurora, opacity: 0.7 }}>◈</span> marks
          on fields indicate they count toward this score.
          {doneCount === 7 && (
            <span
              style={{ color: T.accent.ok, display: "block", marginTop: "4px" }}
            >
              All steps complete — ready to submit.
            </span>
          )}
        </p>
      </div>

      {/* Editorial tip */}
      <div
        style={{
          border: "1px solid rgba(127,223,255,0.2)",
          borderRadius: "10px",
          padding: "12px",
          background: "rgba(127,223,255,0.04)",
        }}
      >
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "11px",
            letterSpacing: ".1em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            marginBottom: "10px",
            opacity: 0.8,
          }}
        >
          Editorial tip
        </div>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "13px",
            color: T.ink.dim,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Verified librarians submitting from a confirmed institutional address
          see a fast-track review (avg.{" "}
          <span style={{ color: T.ink.base }}>~6 hours</span> instead of 3
          days).
        </p>
      </div>
    </aside>
  )
}
