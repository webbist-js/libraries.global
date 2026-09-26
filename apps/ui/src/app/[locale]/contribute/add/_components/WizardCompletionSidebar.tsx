"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

import type { FormData } from "./wizard.types"

interface SectionCheck {
  key: string
  label: string
  required: boolean
  done: boolean
}

function hasOpeningHours(f: FormData): boolean {
  return !!f.openingTimes?.days?.some(
    (d) => d.enabled && d.timeframes.length > 0
  )
}

/** Record-completeness sections. The first seven mirror calcScore; Visiting is extra. */
export const SECTION_CHECKS = (f: FormData): SectionCheck[] => [
  {
    key: "identity",
    label: "Identity",
    required: true,
    done: !!f.name && !!f.libraryType && !!f.operationalStatus,
  },
  {
    key: "location",
    label: "Location",
    required: true,
    done: !!f.city && !!f.country,
  },
  {
    key: "contact",
    label: "Contact",
    required: false,
    done: !!(f.website || f.catalogueUrl),
  },
  {
    key: "visiting",
    label: "Visiting",
    required: false,
    done: hasOpeningHours(f) || !!f.admissionInfo || !!f.visitNotes,
  },
  {
    key: "collections",
    label: "Collections",
    required: false,
    done: !!f.collectionSize,
  },
  {
    key: "history",
    label: "History",
    required: false,
    done: !!f.foundedYear,
  },
  {
    key: "photo",
    label: "Photo",
    required: false,
    done: (f.uploadedImages?.length ?? 0) > 0,
  },
  {
    key: "sources",
    label: "Sources",
    required: true,
    done: !!f.evidenceUrl && !!f.editSummary,
  },
]

const TIPS: Record<number, { title: string; body: string }> = {
  0: {
    title: "Why search first?",
    body: "Duplicates split contributions across two records. If you find it, “Improve this record” keeps everything together.",
  },
  1: {
    title: "Use the library’s own name",
    body: "Enter the name as it appears on the building or the library’s website. Put abbreviations like “BL” in the short name.",
  },
  2: {
    title: "Coordinates matter",
    body: "Without coordinates the library can’t appear on the map. Right-click the entrance in any map app to copy them.",
  },
  3: {
    title: "Only add what you can check",
    body: "Leave hours blank rather than guess. “Hours not added yet” is more useful to visitors than a wrong schedule.",
  },
  4: {
    title: "Approximate is fine",
    body: "Round collection sizes are expected. Include the unit, e.g. “2.4 million volumes” or “170 million items”.",
  },
  5: {
    title: "Founding vs. opening",
    body: "The founding year is when the institution began. The opening year is when the current building opened.",
  },
  6: {
    title: "Credit the photographer",
    body: "Upload only images you took or that carry an open licence, and say which licence in the credit field.",
  },
  7: {
    title: "Editorial tip",
    body: "Verified librarians submitting from a confirmed institutional address see a fast-track review (avg. ~6 hours instead of 3 days).",
  },
}

interface WizardCompletionSidebarProps {
  formData: FormData
  step: number
}

export function WizardCompletionSidebar({
  formData,
  step,
}: WizardCompletionSidebarProps) {
  const checks = SECTION_CHECKS(formData)
  const total = checks.length
  const doneCount = checks.filter((c) => c.done).length
  const requiredLeft = checks.filter((c) => c.required && !c.done).length
  const pct = Math.round((doneCount / total) * 100)
  const isComplete = doneCount === total
  const tip = TIPS[step] ?? TIPS[1]!

  let helper = "Ready to send."
  if (requiredLeft > 0) {
    helper = `${requiredLeft} required section${requiredLeft === 1 ? "" : "s"} left before you send.`
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <section
        aria-labelledby="completeness-heading"
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          borderRadius: "24px",
          padding: "28px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: "12px",
            marginBottom: "14px",
          }}
        >
          <h2
            id="completeness-heading"
            style={{
              fontFamily: T.font.sans,
              fontSize: "17px",
              fontWeight: 700,
              color: T.ink.base,
              margin: 0,
            }}
          >
            Record completeness
          </h2>
          <p
            aria-live="polite"
            aria-atomic="true"
            style={{ margin: 0, whiteSpace: "nowrap" }}
          >
            <span
              style={{
                fontFamily: T.font.serif,
                fontSize: "32px",
                fontWeight: 500,
                color: T.ink.base,
                lineHeight: 1,
              }}
            >
              {doneCount}
            </span>
            <span
              style={{
                fontFamily: T.font.sans,
                fontSize: "15px",
                color: T.ink.dim,
              }}
            >
              {" "}
              of {total}
            </span>
          </p>
        </div>

        <div
          role="progressbar"
          aria-valuenow={doneCount}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuetext={`${doneCount} of ${total} sections complete`}
          aria-label="Record completeness"
          style={{
            height: "8px",
            borderRadius: "999px",
            background: T.bg.muted,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: isComplete ? T.accent.ok : T.accent.primary,
              borderRadius: "999px",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: requiredLeft === 0 ? T.accent.ok : T.ink.dim,
            fontWeight: requiredLeft === 0 ? 600 : 400,
            margin: "14px 0 8px",
            lineHeight: 1.5,
          }}
        >
          {helper}
        </p>

        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {checks.map((check, i) => (
            <li
              key={check.key}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "14px",
                padding: "14px 0",
                borderTop: i === 0 ? "none" : `1px solid ${T.border.divider}`,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                  background: check.done ? "var(--tint-public-bg)" : T.bg.deep,
                  border: check.done
                    ? "1.5px solid var(--tint-public-bg)"
                    : `1.5px solid ${T.border.hi}`,
                  color: "var(--tint-public-fg)",
                }}
              >
                {check.done && <Icon icon="mdi:check" width={16} />}
              </span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: T.ink.base,
                    lineHeight: 1.3,
                  }}
                >
                  {check.label}
                  {check.required && (
                    <span
                      style={{
                        color: "var(--tint-special-fg)",
                        fontWeight: 500,
                      }}
                    >
                      {" "}
                      · required
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "14px",
                    color: T.ink.dim,
                    marginTop: "2px",
                  }}
                >
                  {check.done ? "Done" : "Not started"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <aside
        aria-label="Tip"
        style={{
          background: "var(--tint-national-bg)",
          borderRadius: "20px",
          padding: "22px 24px",
        }}
      >
        <p
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontFamily: T.font.sans,
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--tint-national-fg)",
            margin: "0 0 8px",
          }}
        >
          <Icon icon="mdi:lightbulb-on-outline" width={20} aria-hidden="true" />
          {tip.title}
        </p>
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            color: T.ink.base,
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          {tip.body}
        </p>
      </aside>
    </div>
  )
}
