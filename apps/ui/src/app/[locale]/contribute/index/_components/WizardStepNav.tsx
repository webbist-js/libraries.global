"use client"

import { Icon } from "@iconify/react"
import type React from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export const WIZARD_STEPS = [
  { n: 0, label: "Find existing", sub: "Add or improve" },
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
  /** Steps shown with a tick: visited in new mode, filled in on the record in improve mode. */
  completedSteps: number[]
  /** Improve mode: steps holding a changed field get a pencil marker. */
  changedSteps?: number[]
  onStepClick: (n: number) => void
  /** Where "Find existing" goes: the search page. Rendered as a completed link. */
  findHref: string
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

function StepLabel({
  label,
  sub,
  changed,
}: {
  label: string
  sub: string
  changed: boolean
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span
        className="flex items-center gap-2 whitespace-nowrap"
        style={{
          fontFamily: T.font.sans,
          fontSize: "17px",
          fontWeight: 600,
          color: T.ink.base,
          lineHeight: 1.25,
        }}
      >
        {label}
        {changed && (
          <Icon
            icon="mdi:pencil"
            width={14}
            aria-hidden="true"
            style={{ color: T.accent.primary }}
          />
        )}
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
        {sub}
      </span>
    </span>
  )
}

const itemClass =
  "flex w-full items-center gap-3.5 text-left no-underline transition-colors hover:bg-(--t-bg-surface)"

function itemStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: "12px 16px",
    borderRadius: "16px",
    cursor: "pointer",
    background: isActive ? T.bg.deep : "transparent",
    border: `1px solid ${isActive ? T.border.line : "transparent"}`,
  }
}

export function WizardStepNav({
  currentStep,
  completedSteps,
  changedSteps = [],
  onStepClick,
  findHref,
}: WizardStepNavProps) {
  return (
    <nav aria-label="Wizard steps">
      <ol className="-mx-4 my-0 flex list-none gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {WIZARD_STEPS.map((step) => {
          const isActive = step.n === currentStep
          const isCompleted = step.n === 0 || completedSteps.includes(step.n)
          const changed = changedSteps.includes(step.n)
          const status = isCompleted ? ", completed" : ""
          const changedText = changed ? ", has changes" : ""

          return (
            <li key={step.n} className="shrink-0 lg:shrink">
              {step.n === 0 ? (
                <Link
                  href={findHref}
                  aria-label={`${step.label}${status}. Choose a different library`}
                  className={itemClass}
                  style={itemStyle(false)}
                >
                  <StepCircle n={0} isActive={false} isCompleted />
                  <StepLabel
                    label={step.label}
                    sub={step.sub}
                    changed={false}
                  />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onStepClick(step.n)}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`Step ${step.n}: ${step.label}${status}${changedText}`}
                  className={itemClass}
                  style={itemStyle(isActive)}
                >
                  <StepCircle
                    n={step.n}
                    isActive={isActive}
                    isCompleted={isCompleted}
                  />
                  <StepLabel
                    label={step.label}
                    sub={step.sub}
                    changed={changed}
                  />
                </button>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
