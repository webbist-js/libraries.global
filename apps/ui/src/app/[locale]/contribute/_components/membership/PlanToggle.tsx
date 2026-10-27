"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/styles"

export function PlanToggle<Value extends string>({
  label,
  value,
  options,
  onChange,
  className,
  variant = "segmented",
}: {
  readonly label: string
  readonly value: Value
  readonly options: readonly {
    value: Value
    label: string
    badge?: ReactNode
    description?: string
  }[]
  readonly onChange: (value: Value) => void
  readonly className?: string
  readonly variant?: "segmented" | "cards"
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        variant === "cards"
          ? "grid gap-2 sm:grid-cols-2"
          : "inline-flex max-w-full rounded-full border border-(--t-border-line) bg-white p-1",
        className
      )}
      role="radiogroup"
    >
      {options.map((option, index) => {
        const selected = value === option.value

        return (
          <button
            key={option.value}
            aria-checked={selected}
            className={cn(
              "min-h-11 gap-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) motion-reduce:transition-none",
              variant === "cards"
                ? `flex items-start rounded-[16px] border p-3 text-left text-(--t-ink-base) ${selected ? "border-(--t-accent-primary) bg-(--t-bg-selected)" : "border-(--t-border-hi) bg-white hover:border-(--t-accent-primary)"}`
                : `inline-flex items-center justify-center rounded-full px-4 ${selected ? "bg-(--t-ink-base) text-white" : "text-(--t-ink-base) hover:bg-(--t-bg-surface)"}`
            )}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => {
              let nextIndex: number
              switch (event.key) {
                case "ArrowRight":
                case "ArrowDown":
                  nextIndex = (index + 1) % options.length
                  break
                case "ArrowLeft":
                case "ArrowUp":
                  nextIndex = (index - 1 + options.length) % options.length
                  break
                case "Home":
                  nextIndex = 0
                  break
                case "End":
                  nextIndex = options.length - 1
                  break

                default:
                  return
              }

              event.preventDefault()
              onChange(options[nextIndex]!.value)
              event.currentTarget.parentElement
                ?.querySelectorAll<HTMLButtonElement>("button")
                [nextIndex]?.focus()
            }}
            role="radio"
            tabIndex={selected ? 0 : -1}
            type="button"
          >
            {variant === "cards" ? (
              <>
                <span
                  aria-hidden
                  className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border ${selected ? "border-(--t-accent-primary) bg-(--t-accent-primary)" : "border-(--t-border-hi) bg-white"}`}
                >
                  {selected ? (
                    <span className="size-1.5 rounded-full bg-white" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 leading-snug">
                    {option.label}
                    {option.badge}
                  </span>
                  {option.description ? (
                    <span className="mt-1 block text-xs leading-relaxed font-normal text-(--t-ink-dim)">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </>
            ) : (
              <>
                {option.label}
                {option.badge}
              </>
            )}
          </button>
        )
      })}
    </div>
  )
}
