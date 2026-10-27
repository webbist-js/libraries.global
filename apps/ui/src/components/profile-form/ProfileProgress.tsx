import { Icon } from "@iconify/react"
import type React from "react"

import { T } from "@/lib/design-tokens"

export type SetupStep = {
  /** The section's id, so the row links to it. */
  id: string
  label: string
  required: boolean
  done: boolean
  /** What's there, or what's still missing. */
  detail: string
}

/** A plain link in the card's second list, e.g. another settings section. */
export type ProgressLink = { id: string; label: string; icon: string }

/**
 * The profile side card on onboarding and settings: how much of the profile
 * is filled in, a link to each section, and the page's actions underneath.
 * Mirrors the Index editor's record-completeness card.
 */
export function ProfileProgress({
  title,
  steps,
  links,
  children,
}: {
  readonly title: string
  readonly steps: readonly SetupStep[]
  /** More sections to jump to, listed after the steps (settings). */
  readonly links?: readonly ProgressLink[]
  /** The actions, under a hairline rule. */
  readonly children: React.ReactNode
}) {
  const total = steps.length
  const doneCount = steps.filter((s) => s.done).length
  const requiredLeft = steps.filter((s) => s.required && !s.done).length
  const pct = Math.round((doneCount / total) * 100)

  const helper =
    requiredLeft > 0
      ? `${requiredLeft} required ${requiredLeft === 1 ? "section" : "sections"} left.`
      : doneCount === total
        ? "Everything’s filled in."
        : "Required sections done. The rest can wait."

  return (
    <section
      aria-labelledby="profile-progress-title"
      className="rounded-[24px] p-6 sm:p-7"
      style={{ background: T.bg.deep, border: `1px solid ${T.border.line}` }}
    >
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <h2
          id="profile-progress-title"
          className="type-panel-title m-0"
          style={{ color: T.ink.base }}
        >
          {title}
        </h2>
        <p aria-hidden="true" className="m-0 whitespace-nowrap">
          <span
            style={{
              fontFamily: T.font.sans,
              fontSize: 32,
              fontWeight: 500,
              lineHeight: 1,
              color: T.ink.base,
            }}
          >
            {doneCount}
          </span>
          <span className="text-base" style={{ color: T.ink.dim }}>
            {" "}
            of {total}
          </span>
        </p>
      </div>

      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={doneCount}
        aria-valuetext={`${doneCount} of ${total} sections done`}
        className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: T.bg.muted }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${pct}%`,
            background: requiredLeft === 0 ? T.accent.ok : T.accent.primary,
          }}
        />
      </div>

      <p
        aria-live="polite"
        className="mt-3.5 mb-1 text-base leading-[1.6]"
        style={{
          color: requiredLeft === 0 ? T.accent.ok : T.ink.dim,
          fontWeight: requiredLeft === 0 ? 600 : 400,
        }}
      >
        {helper}
      </p>

      <ol className="m-0 list-none p-0">
        {steps.map((step, i) => (
          <li
            key={step.id}
            style={
              i > 0 ? { borderTop: `1px solid ${T.border.divider}` } : undefined
            }
          >
            <a
              href={`#${step.id}`}
              className="group flex items-center gap-3.5 py-3 no-underline"
            >
              <span
                aria-hidden="true"
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: step.done ? "var(--tint-public-bg)" : T.bg.deep,
                  border: `1.5px solid ${step.done ? "var(--tint-public-bg)" : T.border.hi}`,
                  color: "var(--tint-public-fg)",
                }}
              >
                {step.done ? <Icon icon="mdi:check" width={16} /> : null}
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className="text-base leading-[1.3] font-semibold group-hover:underline"
                  style={{ color: T.ink.base }}
                >
                  {step.label}
                  {step.required ? (
                    <span
                      className="font-medium"
                      style={{ color: "var(--tint-special-fg)" }}
                    >
                      {" "}
                      · required
                    </span>
                  ) : null}
                </span>
                <span
                  className="mt-0.5 truncate text-sm"
                  style={{ color: T.ink.dim }}
                >
                  <span className="sr-only">
                    {step.done ? "Done: " : "To do: "}
                  </span>
                  {step.detail}
                </span>
              </span>
            </a>
          </li>
        ))}
      </ol>

      {links?.length ? (
        <ul
          className="m-0 mt-3 list-none divide-y divide-(--t-border-line) border-t p-0"
          style={{ borderColor: T.border.divider }}
        >
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={`#${link.id}`}
                className="group flex min-h-12 items-center gap-3.5 py-3 text-base font-semibold underline underline-offset-4"
                style={{ color: T.accent.primary }}
              >
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center"
                  style={{ color: T.ink.dim }}
                >
                  <Icon icon={link.icon} width={18} />
                </span>
                <span className="group-hover:underline">{link.label}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        className="mt-3 flex flex-col gap-3 border-t pt-5"
        style={{ borderColor: T.border.divider }}
      >
        {children}
      </div>
    </section>
  )
}
