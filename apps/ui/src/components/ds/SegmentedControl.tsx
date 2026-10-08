"use client"
import { useId } from "react"

import { T } from "@/lib/design-tokens"

/**
 * One choice from a few, as a row of segments on a tinted track: the
 * chosen segment is a white pill (its state is the raised segment, never
 * colour alone). Radios underneath, so arrow keys move between them. An
 * option's `sub` is a small line under its label ("4 stops").
 */
export function SegmentedControl<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  readonly label: string
  readonly options: readonly { value: V; label: string; sub?: string }[]
  readonly value: V
  readonly onChange: (value: V) => void
  readonly size?: "sm" | "md"
}) {
  const name = useId()

  return (
    <fieldset
      className="m-0 rounded-full border-0 p-1"
      style={{ background: T.bg.muted2 }}
    >
      <legend className="sr-only">{label}</legend>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const active = value === option.value

          return (
            <label
              key={option.value}
              className="inline-flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-full px-4 text-[14px] font-semibold has-focus-visible:outline-[3px] has-focus-visible:outline-offset-2 has-focus-visible:outline-(--t-accent-primary) has-focus-visible:outline-solid"
              style={{
                background: active ? T.bg.deep : undefined,
                color: active ? T.accent.primary : T.ink.dim,
              }}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={active}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
              {option.sub ? (
                <span
                  className="text-[12px] leading-tight font-normal"
                  style={{ color: active ? T.accent.primary : T.ink.dim }}
                >
                  {option.sub}
                </span>
              ) : null}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
