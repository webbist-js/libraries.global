"use client"

import { Icon } from "@iconify/react"
import type React from "react"

import { T } from "@/lib/design-tokens"

export const WIZARD_STEPS = [
  { n: 0, label: "Find existing", sub: "Avoid duplicates" },
  { n: 1, label: "Identity", sub: "Name · Type · Status" },
  { n: 2, label: "Location", sub: "Address · Coordinates" },
  { n: 3, label: "Visit", sub: "Links · Hours · Access" },
  { n: 4, label: "Collections", sub: "Holdings · Classification" },
  { n: 5, label: "History", sub: "Founding · Building" },
  { n: 6, label: "Photo", sub: "Image · Credit" },
  { n: 7, label: "Sources & send", sub: "Evidence · Review" },
] as const

interface WizardStepNavProps {
  currentStep: number
  completedSteps: number[]
  onStepClick: (n: number) => void
  /** Edit mode skips the duplicate check, so step 0 is hidden. */
  hideFindStep?: boolean
}

function StepCircle({
  n,
  isActive,
  isCompleted,
}: {
  n: number
  isActive: boolean
  isCompleted: boolean
}) {
  let bg: string = T.bg.deep
  let fg: string = T.ink.dim
  let border = `1.5px solid ${T.border.hi}`
  if (isActive) {
    bg = T.accent.primary
    fg = "#fff"
    border = `1.5px solid ${T.accent.primary}`
  } else if (isCompleted) {
    bg = "var(--tint-public-bg)"
    fg = "var(--tint-public-fg)"
    border = "1.5px solid var(--tint-public-bg)"
  }

  let glyph: React.ReactNode = n
  if (isCompleted && !isActive) {
    glyph = <Icon icon="mdi:check" aria-hidden="true" width={18} />
  } else if (n === 0) {
    glyph = <Icon icon="mdi:magnify" aria-hidden="true" width={18} />
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: bg,
        color: fg,
        border,
        fontFamily: T.font.sans,
        fontSize: "15px",
        fontWeight: 600,
        boxSizing: "border-box",
      }}
    >
      {glyph}
    </span>
  )
}

export function WizardStepNav({
  currentStep,
  completedSteps,
  onStepClick,
  hideFindStep,
}: WizardStepNavProps) {
  const steps = hideFindStep
    ? WIZARD_STEPS.filter((s) => s.n !== 0)
    : WIZARD_STEPS

  return (
    <nav aria-label="Wizard steps">
      <ol className="-mx-4 my-0 flex list-none gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {steps.map((step) => {
          const isActive = step.n === currentStep
          const isCompleted = completedSteps.includes(step.n)
          const status = isCompleted ? ", completed" : ""

          return (
            <li key={step.n} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onStepClick(step.n)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`${step.n === 0 ? "" : `Step ${step.n}: `}${step.label}${status}`}
                className="flex w-full items-center gap-3 text-left transition-colors hover:bg-(--t-bg-muted-2)"
                style={{
                  padding: "10px 14px 10px 11px",
                  borderRadius: "14px",
                  cursor: "pointer",
                  background: isActive ? T.accent.chip : "transparent",
                  border: "none",
                  borderLeft: `3px solid ${isActive ? T.accent.primary : "transparent"}`,
                }}
              >
                <StepCircle
                  n={step.n}
                  isActive={isActive}
                  isCompleted={isCompleted}
                />
                <span className="flex min-w-0 flex-col">
                  <span
                    className="whitespace-nowrap"
                    style={{
                      fontFamily: T.font.sans,
                      fontSize: "17px",
                      fontWeight: 600,
                      color: T.ink.base,
                      lineHeight: 1.25,
                    }}
                  >
                    {step.label}
                  </span>
                  <span
                    className="hidden lg:block"
                    style={{
                      fontFamily: T.font.sans,
                      fontSize: "15px",
                      color: T.ink.dim,
                      lineHeight: 1.35,
                      marginTop: "2px",
                    }}
                  >
                    {step.sub}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
