"use client"

import { MessageSquare } from "lucide-react"
import { usePathname } from "next/navigation"

import { betaPath } from "@/lib/beta/scope"

export function BetaFeedback({
  label,
  inline = false,
}: {
  readonly label: string
  readonly inline?: boolean
}) {
  const pathname = betaPath(usePathname() ?? "/")

  if (["/map", "/map/"].includes(pathname)) return null

  return (
    <button
      data-feedback-trigger={inline ? undefined : ""}
      data-feedback-inline={inline ? "" : undefined}
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      className={
        inline
          ? "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-(--t-border-line) bg-(--t-bg-deep) px-3 text-sm font-semibold text-(--t-ink-base) hover:bg-(--t-bg-surface)"
          : "fixed top-1/2 left-0 z-40 inline-flex min-h-11 w-11 flex-col items-center gap-2 rounded-r-[20px] border border-l-0 border-(--t-border-line) bg-(--t-bg-deep) py-3 text-sm font-semibold text-(--t-ink-base) shadow-sm transition-colors hover:bg-(--t-bg-surface) focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--t-accent-primary)"
      }
    >
      <MessageSquare aria-hidden="true" size={16} />
      <span className={inline ? "hidden sm:inline" : "whitespace-nowrap"}>
        {label}
      </span>
    </button>
  )
}
