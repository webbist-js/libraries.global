"use client"

import { Icon } from "@iconify/react"
import type { ReactNode, Ref } from "react"

import { T } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

/**
 * The site-wide search input pattern: white pill, 1px `border.hi` border,
 * leading magnifier, placeholder carries the descriptive copy and the label
 * is screen-reader-only. Dropdowns/results are the caller's concern —
 * position them absolutely below (`top-[calc(100%+8px)]`).
 */
export function SearchField({
  id,
  placeholder,
  label,
  size = "md",
  className,
  trailing,
  loading = false,
  onClear,
  inputRef,
  inputProps,
}: {
  readonly id: string
  readonly placeholder: string
  /** Screen-reader label; defaults to the placeholder text. */
  readonly label?: string
  readonly size?: "md" | "sm"
  /** Extra classes for the pill container (flex sizing etc.). */
  readonly className?: string
  /** Rendered after the input (buttons, spinners). */
  readonly trailing?: ReactNode
  readonly loading?: boolean
  /** Renders a clear (×) button when the input has a value. */
  readonly onClear?: () => void
  readonly inputRef?: Ref<HTMLInputElement>
  readonly inputProps?: React.InputHTMLAttributes<HTMLInputElement>
}) {
  const hasValue = String(inputProps?.value ?? "").length > 0

  return (
    <div
      className={cn(
        "flex items-center rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) transition-colors focus-within:border-(--t-accent-primary)",
        size === "md" ? "gap-2.5 px-4 py-3" : "gap-2 px-3 py-2",
        className
      )}
    >
      <Icon
        aria-hidden="true"
        icon="mdi:magnify"
        width={size === "md" ? 19 : 16}
        height={size === "md" ? 19 : 16}
        className="shrink-0"
        style={{ color: loading ? T.accent.primary : T.ink.dim }}
      />
      <label className="sr-only" htmlFor={id}>
        {label ?? placeholder}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="search"
        placeholder={placeholder}
        className={cn(
          "min-w-0 flex-1 border-0 bg-transparent outline-none placeholder:text-(--t-ink-faint) [&::-webkit-search-cancel-button]:hidden",
          size === "md" ? "text-[16px]" : "text-[14px]"
        )}
        style={{ color: T.ink.base, fontFamily: T.font.sans }}
        {...inputProps}
      />
      {onClear && hasValue ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={onClear}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-0 text-[15px] leading-none"
          style={{ background: T.bg.muted, color: T.ink.dim }}
        >
          ×
        </button>
      ) : null}
      {trailing}
    </div>
  )
}
