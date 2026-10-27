"use client"

import { Icon } from "@iconify/react"
import { useId, type ReactNode } from "react"

import { cn } from "@/lib/styles"

/** Bounded, keyboard-scrollable reference text shared by translation and review. */
export function ArticleReadingPane({
  heading,
  icon = "mdi:book-open-outline",
  children,
  lang,
  className,
}: {
  readonly heading: string
  readonly icon?: string
  readonly children: ReactNode
  readonly lang: string
  readonly className?: string
}) {
  const headingId = useId()

  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)",
        className
      )}
    >
      <div className="flex min-h-16 items-center gap-3 border-b border-(--t-border-line) bg-(--t-bg-surface) px-5 py-4">
        <Icon
          aria-hidden="true"
          icon={icon}
          width={20}
          className="shrink-0 text-(--t-ink-dim)"
        />
        <h2 id={headingId} className="type-small-heading m-0">
          {heading}
        </h2>
      </div>
      <div
        role="region"
        aria-labelledby={headingId}
        lang={lang}
        tabIndex={0}
        className="max-h-[min(65dvh,800px)] min-h-0 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--t-accent-primary)"
      >
        {children}
      </div>
    </div>
  )
}
