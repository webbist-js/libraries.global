import { ShieldCheck } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/styles"

export const EDITORIAL_ACTION_PILL =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"

export const EDITORIAL_DANGER_PILL =
  "border-(--t-palette-coral-fg) bg-(--t-palette-coral-fg) text-white hover:bg-(--t-palette-coral-fg) hover:brightness-110"

export const EDITORIAL_SUBTLE_PILL =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-full border border-(--t-border-line) bg-white px-4 py-2 text-sm font-semibold text-(--t-ink-base) no-underline hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"

export const EDITORIAL_SUBTLE_DANGER_PILL =
  "text-(--t-palette-coral-fg) hover:border-(--t-palette-coral-fg)"

/** Presentation only; each host keeps its existing authorization and actions. */
export function EditorialToolbar({
  label,
  ariaLabel = label,
  headingId,
  description,
  actions,
  children,
  className,
  variant = "dark",
  inlineDescription = false,
  showIcon = true,
}: {
  readonly label: string
  readonly ariaLabel?: string
  readonly headingId?: string
  readonly description?: ReactNode
  readonly actions?: ReactNode
  readonly children?: ReactNode
  readonly className?: string
  readonly variant?: "dark" | "subtle"
  readonly inlineDescription?: boolean
  readonly showIcon?: boolean
}) {
  return (
    <section
      aria-label={headingId ? undefined : ariaLabel}
      aria-labelledby={headingId}
      className={cn(
        variant === "subtle"
          ? "grid gap-4 rounded-[20px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 text-(--t-ink-base) md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
          : "grid gap-4 rounded-[20px] bg-[#19172c] px-5 py-4 text-white",
        className
      )}
    >
      <div
        className={
          variant === "subtle" && !inlineDescription
            ? "flex flex-col gap-1.5 text-sm leading-relaxed"
            : "flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm leading-relaxed"
        }
      >
        <h2
          id={headingId}
          className="type-small-heading m-0 inline-flex items-center gap-2"
        >
          {showIcon && (
            <ShieldCheck
              size={19}
              className={
                variant === "subtle"
                  ? "shrink-0 text-(--t-accent-primary)"
                  : "shrink-0 text-[#bdb6f0]"
              }
              aria-hidden
            />
          )}
          {label}
        </h2>
        {description && (
          <span
            className={
              variant === "subtle" ? "text-(--t-ink-dim)" : "text-[#d1cedd]"
            }
          >
            {description}
          </span>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
      {children ? (
        <div className={variant === "subtle" ? "md:col-span-2" : undefined}>
          {children}
        </div>
      ) : null}
    </section>
  )
}
