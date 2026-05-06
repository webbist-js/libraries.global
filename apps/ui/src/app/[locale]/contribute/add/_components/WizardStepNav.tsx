"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

const STEPS = [
  { n: 0, label: "Find existing", sub: "Search · Verify" },
  { n: 1, label: "Basics", sub: "Name · Type · Status" },
  { n: 2, label: "Location", sub: "Address · Coordinates" },
  { n: 3, label: "Visit", sub: "Hours · Admission" },
  { n: 4, label: "Collections", sub: "Stats · Classification" },
  { n: 5, label: "Building", sub: "Dates · Architect" },
  { n: 6, label: "Imagery", sub: "Photos · License" },
  { n: 7, label: "Sources & review", sub: "Evidence · Submit" },
]

interface WizardStepNavProps {
  currentStep: number
  completedSteps: number[]
  onStepClick: (n: number) => void
}

export function WizardStepNav({
  currentStep,
  completedSteps,
  onStepClick,
}: WizardStepNavProps) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {STEPS.map((step) => {
        const isActive = step.n === currentStep
        const isCompleted = completedSteps.includes(step.n)

        return (
          <button
            key={step.n}
            onClick={() => onStepClick(step.n)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "10px",
              padding: "10px 12px",
              borderRadius: "10px",
              cursor: "pointer",
              background: isActive ? "rgba(127,223,255,0.06)" : "transparent",
              border: "none",
              borderLeft: isActive
                ? `3px solid ${T.accent.aurora}`
                : "3px solid transparent",
              textAlign: "left",
              width: "100%",
              transition: "background 0.15s",
            }}
          >
            {/* Step indicator */}
            <div style={{ flexShrink: 0, marginTop: "1px" }}>
              {isCompleted ? (
                <Icon
                  icon="mdi:check-circle"
                  style={{ color: T.accent.aurora, fontSize: "16px" }}
                />
              ) : step.n === 0 ? (
                <Icon
                  icon="mdi:magnify"
                  style={{
                    color: isActive ? T.accent.aurora : T.ink.faint,
                    fontSize: "16px",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "16px",
                    height: "16px",
                    borderRadius: "50%",
                    border: `1px solid ${isActive ? T.accent.aurora : T.border.hi}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: T.font.mono,
                    fontSize: "10px",
                    color: isActive ? T.accent.aurora : T.ink.faint,
                  }}
                >
                  {step.n}
                </div>
              )}
            </div>

            {/* Step labels */}
            <div>
              <div
                style={{
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  color: isActive ? T.ink.base : T.ink.dim,
                  fontWeight: isActive ? 600 : 400,
                  lineHeight: 1.3,
                }}
              >
                {step.label}
              </div>
              <div
                style={{
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: ".1em",
                  textTransform: "uppercase",
                  color: T.ink.faint,
                  marginTop: "2px",
                }}
              >
                {step.sub}
              </div>
            </div>
          </button>
        )
      })}
    </nav>
  )
}
