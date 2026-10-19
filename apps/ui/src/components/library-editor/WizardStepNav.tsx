"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import type React from "react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

import type { StepProgress } from "./wizard.progress"
import { wizardSteps, wizardStepCopy } from "./wizard.steps"
import { RequiredTag } from "./WizardFields"

export { WIZARD_STEPS, wizardStepCopy } from "./wizard.steps"

interface WizardStepNavProps {
  staff?: boolean
  mobile?: boolean
  currentStep: number
  /** Each step's completeness: a tick once done, "required" until then. */
  progress: StepProgress[]
  /** Improve mode: steps holding a changed field get a pencil marker. */
  changedSteps?: number[]
  onStepClick?: (n: number) => void
  /** The search doorway shows the same rail before a record is chosen. */
  preview?: boolean
  /** Where "Find existing" goes: the search page. Rendered as a completed link. */
  findHref: string
}

function StepCircle({
  n,
  isActive,
  isDone,
}: {
  n: number
  isActive: boolean
  isDone: boolean
}) {
  let bg: string = T.bg.deep
  let fg: string = T.ink.dim
  let border = `1.5px solid ${T.border.hi}`
  if (isActive) {
    bg = T.accent.primary
    fg = "#fff"
    border = `1.5px solid ${T.accent.primary}`
  } else if (isDone) {
    bg = "var(--tint-public-bg)"
    fg = "var(--tint-public-fg)"
    border = "1.5px solid var(--tint-public-bg)"
  }

  const glyph: React.ReactNode = isDone ? (
    <Icon icon="mdi:check" aria-hidden="true" width={18} />
  ) : (
    n
  )

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
  required,
}: {
  label: string
  sub: string
  changed: boolean
  /** A required step not yet done. */
  required: boolean
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span
        className="flex flex-wrap items-baseline gap-x-2 gap-y-1"
        style={{
          fontFamily: T.font.sans,
          fontSize: "17px",
          fontWeight: 600,
          color: T.ink.base,
          lineHeight: 1.25,
        }}
      >
        {label}
        {required && (
          <span className="hidden lg:inline">
            <RequiredTag />
          </span>
        )}
        {changed && (
          <Icon
            icon="mdi:pencil"
            width={14}
            aria-hidden="true"
            style={{ color: T.accent.primary, alignSelf: "center" }}
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
    padding: "10px 16px",
    borderRadius: "16px",
    cursor: "pointer",
    background: isActive ? T.bg.deep : "transparent",
    border: `1px solid ${isActive ? T.border.line : "transparent"}`,
  }
}

const requiredSteps = (n: number) => `${n} required step${n === 1 ? "" : "s"}`

function stepStatusText(step: StepProgress | undefined): string {
  if (step?.done) return ", done"
  if (step?.required) return ", required"

  return ""
}

export function WizardStepNav({
  currentStep,
  progress,
  changedSteps = [],
  onStepClick,
  findHref,
  staff = false,
  mobile = false,
  preview = false,
}: WizardStepNavProps) {
  const tUi = useUiTranslations("ui")

  return (
    <nav
      aria-label={tUi("wizard_steps")}
      className={preview ? "hidden lg:block" : undefined}
    >
      <ol className="-mx-4 my-0 flex list-none gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {wizardSteps(mobile).map((step, position) => {
          if (step.n === 0) {
            if (staff) return null

            return (
              <li key={step.n} className="shrink-0 lg:shrink">
                <Link
                  href={findHref}
                  aria-current={preview ? "step" : undefined}
                  aria-label={
                    preview
                      ? step.label
                      : `${step.label}, done. Choose a different library`
                  }
                  className={itemClass}
                  style={itemStyle(preview)}
                >
                  {preview ? (
                    <span
                      aria-hidden
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-(--t-accent-primary) text-white"
                    >
                      <Icon icon="mdi:magnify" width={18} />
                    </span>
                  ) : (
                    <StepCircle n={0} isActive={false} isDone />
                  )}
                  <StepLabel
                    label={step.label}
                    sub={step.sub}
                    changed={false}
                    required={false}
                  />
                </Link>
              </li>
            )
          }

          const state = progress.find((p) => p.n === step.n)
          const isActive = step.n === currentStep
          const isDone = !!state?.done
          const changed = changedSteps.includes(step.n)
          const changedText = changed ? ", has changes" : ""
          const { label, sub } = wizardStepCopy(step.n, mobile, staff)

          return (
            <li key={step.n} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onStepClick?.(step.n)}
                disabled={preview}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${position}: ${label}${stepStatusText(state)}${changedText}`}
                className={itemClass}
                style={itemStyle(isActive)}
              >
                <StepCircle n={position} isActive={isActive} isDone={isDone} />
                <StepLabel
                  label={label}
                  sub={sub}
                  changed={changed}
                  required={!!state?.required && !isDone}
                />
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

/**
 * The rail's completeness summary above the steps: how many are done and,
 * when adding a library, how many required ones are left before sending.
 */
export function RecordProgress({
  progress,
  improving,
  changedCount,
}: {
  progress: StepProgress[]
  improving: boolean
  changedCount: number
}) {
  const tUi = useUiTranslations("ui")

  const total = progress.length
  const doneCount = progress.filter((s) => s.done).length
  const requiredLeft = progress.filter((s) => s.required && !s.done).length
  const pct = Math.round((doneCount / total) * 100)

  let helper: React.ReactNode = null
  if (requiredLeft > 0 && (!improving || changedCount > 0)) {
    helper = improving
      ? `${requiredSteps(requiredLeft)} still empty.`
      : `${requiredSteps(requiredLeft)} left before you send.`
  } else if (!improving) {
    helper = (
      <span
        className="inline-flex items-center gap-1.5"
        style={{ color: T.accent.ok, fontWeight: 600 }}
      >
        <Icon icon="mdi:check-circle-outline" width={16} aria-hidden="true" />
        {tUi("ready_to_send")}{" "}
      </span>
    )
  }

  return (
    <section aria-labelledby="record-progress-heading">
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id="record-progress-heading"
          style={{
            fontFamily: T.font.sans,
            fontSize: "15px",
            fontWeight: 600,
            color: T.ink.base,
            margin: 0,
          }}
        >
          {tUi("record_completeness")}{" "}
        </h3>
        <p
          aria-live="polite"
          aria-atomic="true"
          style={{
            margin: 0,
            whiteSpace: "nowrap",
            fontFamily: T.font.sans,
            fontSize: "14px",
            color: T.ink.dim,
          }}
        >
          <span
            style={{
              fontFamily: T.font.serif,
              fontSize: "22px",
              fontWeight: 500,
              color: T.ink.base,
              lineHeight: 1,
            }}
          >
            {doneCount}
          </span>{" "}
          of {total}
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={doneCount}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuetext={`${doneCount} of ${total} steps complete`}
        aria-label={tUi("record_completeness")}
        style={{
          height: "6px",
          marginTop: "8px",
          borderRadius: "999px",
          background: T.bg.muted,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: doneCount === total ? T.accent.ok : T.accent.primary,
            borderRadius: "999px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      {helper && (
        <p
          style={{
            fontFamily: T.font.sans,
            fontSize: "14px",
            color: T.ink.dim,
            margin: "8px 0 0",
            lineHeight: 1.5,
          }}
        >
          {helper}
        </p>
      )}
    </section>
  )
}
