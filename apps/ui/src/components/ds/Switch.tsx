"use client"
import { useId } from "react"

import { T } from "@/lib/design-tokens"

/**
 * A labelled on/off toggle: a real checkbox with `role="switch"`, drawn as
 * a track and thumb. The whole row is the label, and the control itself
 * has a 44 px hit area. `inline` packs the label and track side by side
 * for a toggle inside a row of controls (a visit's "Term time only").
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  inline = false,
  controlFirst = false,
  className,
}: {
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  readonly label: string
  readonly description?: string
  readonly disabled?: boolean
  readonly id?: string
  /** Label and track side by side, without the row's full width. */
  readonly inline?: boolean
  readonly controlFirst?: boolean
  readonly className?: string
}) {
  const generated = useId()
  const inputId = id ?? generated

  return (
    <label
      className={[
        "cursor-pointer items-center has-disabled:cursor-not-allowed has-disabled:opacity-60",
        inline
          ? "inline-flex min-h-11 gap-2.5 text-sm"
          : "flex min-h-11 justify-between gap-4 py-2",
        className,
      ].join(" ")}
      htmlFor={inputId}
    >
      <span className="min-w-0">
        {label}
        {description ? (
          <small className="block text-sm" style={{ color: T.ink.dim }}>
            {description}
          </small>
        ) : null}
      </span>
      <span
        className={[
          "relative inline-flex h-11 w-12 shrink-0 items-center justify-center",
          controlFirst ? "order-first" : "",
        ].join(" ")}
      >
        <input
          id={inputId}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          role="switch"
          type="checkbox"
          className="peer absolute inset-0 m-0 size-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed"
        />
        <span
          aria-hidden="true"
          className="relative block h-7 w-12 rounded-full transition-colors peer-focus-visible:outline-[3px] peer-focus-visible:outline-offset-2 peer-focus-visible:outline-(--t-accent-primary) peer-focus-visible:outline-solid motion-reduce:transition-none"
          style={{ background: checked ? T.accent.primary : T.border.hi }}
        >
          <span
            className="absolute top-0.5 left-0.5 size-6 rounded-full transition-transform motion-reduce:transition-none"
            style={{
              background: T.bg.deep,
              transform: checked ? "translateX(20px)" : "translateX(0)",
            }}
          />
        </span>
      </span>
    </label>
  )
}
