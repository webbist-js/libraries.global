"use client"

import type { ReactNode } from "react"

import { cn } from "@/lib/styles"

export function PlanToggle<Value extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  readonly label: string
  readonly value: Value
  readonly options: readonly {
    value: Value
    label: string
    badge?: ReactNode
  }[]
  readonly onChange: (value: Value) => void
  readonly className?: string
}) {
  return (
    <div
      aria-label={label}
      className={cn(
        "inline-flex max-w-full rounded-full border border-(--t-border-line) bg-white p-1",
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
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) motion-reduce:transition-none",
              selected
                ? "bg-(--t-ink-base) text-white"
                : "text-(--t-ink-base) hover:bg-(--t-bg-surface)"
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
            {option.label}
            {option.badge}
          </button>
        )
      })}
    </div>
  )
}
