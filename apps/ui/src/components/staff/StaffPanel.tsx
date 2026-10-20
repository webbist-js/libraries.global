import type { ReactNode } from "react"

import { cn } from "@/lib/styles"

/** The white, softly bordered panel shared by staff and Team workspaces. */
export function StaffPanel({
  title,
  id,
  aside,
  children,
  className,
  compact = false,
  footer,
}: {
  readonly title?: ReactNode
  readonly id?: string
  readonly aside?: ReactNode
  readonly children: ReactNode
  readonly className?: string
  readonly compact?: boolean
  readonly footer?: ReactNode
}) {
  return (
    <section
      aria-labelledby={id && title ? `${id}-title` : undefined}
      id={id}
      className={cn(
        "min-w-0 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-base)",
        compact ? "p-5 sm:p-6" : "p-5 sm:p-7",
        className
      )}
    >
      {title ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
          <h2
            id={id ? `${id}-title` : undefined}
            className={cn(
              "m-0 min-w-0 font-serif font-medium text-balance text-(--t-ink-base)",
              compact
                ? "text-[24px] leading-tight"
                : "text-[clamp(26px,2.8vw,34px)] leading-[1.15]"
            )}
          >
            {title}
          </h2>
          {aside}
        </div>
      ) : null}
      {children}
      {footer ? (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-(--t-border-line) pt-5">
          {footer}
        </div>
      ) : null}
    </section>
  )
}

export const STAFF_FIELD =
  "min-h-11 w-full min-w-0 rounded-[14px] border border-(--t-border-line) bg-(--t-bg-surface) px-3.5 py-2.5 text-[16px] leading-normal font-normal text-(--t-ink-base) shadow-none outline-none focus-visible:border-(--t-accent-primary) focus-visible:ring-2 focus-visible:ring-(--t-accent-primary)/30 disabled:cursor-not-allowed disabled:opacity-60 md:text-[15px]"
export const STAFF_LINK =
  "font-semibold text-(--t-accent-primary) underline underline-offset-4 hover:text-(--t-accent-primary-hover)"
