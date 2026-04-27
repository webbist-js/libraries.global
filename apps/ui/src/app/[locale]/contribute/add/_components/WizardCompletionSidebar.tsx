"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

import type { FormData } from "./AddLibraryWizard"

const CHECKS = (formData: FormData) => [
  { label: "Name & type", done: !!formData.name && !!formData.libraryType },
  { label: "Coordinates", done: !!formData.lat && !!formData.lng },
  { label: "Operating status", done: !!formData.operationalStatus },
  { label: "At least one image", done: !!formData.imageNote },
  {
    label: "Catalogue or website URL",
    done: !!formData.catalogueUrl || !!formData.website,
  },
  { label: "Collection statistics", done: false },
  { label: "Source citation", done: !!formData.evidenceUrl },
]

interface WizardCompletionSidebarProps {
  score: number
  formData: FormData
}

export function WizardCompletionSidebar({
  score,
  formData,
}: WizardCompletionSidebarProps) {
  const checks = CHECKS(formData)

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
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: T.ink.faint,
            marginBottom: "8px",
          }}
        >
          Completeness
        </div>

        <div
          style={{
            fontFamily: T.font.serif,
            fontSize: "32px",
            color: T.ink.base,
            lineHeight: 1,
            marginBottom: "10px",
          }}
        >
          {score}{" "}
          <span style={{ fontSize: "16px", color: T.ink.dim }}>/ 100</span>
        </div>

        {/* Progress bar */}
        <div
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
              background: T.accent.aurora,
              borderRadius: "2px",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* Checklist */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {checks.map((check) => (
            <div
              key={check.label}
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              {check.done ? (
                <Icon
                  icon="mdi:check-circle"
                  style={{
                    color: T.accent.aurora,
                    fontSize: "14px",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <Icon
                  icon="mdi:circle-outline"
                  style={{
                    color: T.ink.faint,
                    fontSize: "14px",
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "9px",
                  letterSpacing: ".08em",
                  color: check.done ? T.ink.dim : T.ink.faint,
                }}
              >
                {check.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Editorial tip box */}
      <div
        style={{
          border: "1px solid rgba(127,223,255,0.2)",
          borderRadius: "8px",
          padding: "12px",
          background: "rgba(127,223,255,0.04)",
        }}
      >
        <div
          style={{
            fontFamily: T.font.mono,
            fontSize: "9px",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: T.accent.aurora,
            marginBottom: "8px",
            opacity: 0.8,
          }}
        >
          Editorial tip
        </div>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "11px",
            color: T.ink.dim,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Verified librarians submitting from a confirmed institutional address
          see a fast-track review (avg. ~6 hours instead of 3 days).
        </p>
      </div>
    </aside>
  )
}
