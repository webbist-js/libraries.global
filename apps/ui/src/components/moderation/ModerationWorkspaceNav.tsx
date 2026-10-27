"use client"

import { LayoutGrid } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useRef } from "react"

import {
  REVIEW_ICONS,
  type WorkspaceView,
} from "@/components/moderation/workspace"
import { Link } from "@/lib/navigation"
import { cn } from "@/lib/styles"

/** The server supplies only categories the viewer's scopes cover. */
export function ModerationWorkspaceNav({
  active,
  views,
}: {
  active: WorkspaceView["id"] | "overview"
  views: readonly WorkspaceView[]
}) {
  const t = useTranslations("moderationWorkspace")
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const nav = navRef.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!nav || !current) return
    const left = current.offsetLeft
    const right = left + current.offsetWidth
    if (left < nav.scrollLeft) nav.scrollLeft = left
    else if (right > nav.scrollLeft + nav.clientWidth)
      nav.scrollLeft = right - nav.clientWidth + 12
  }, [active])
  const items =
    views.length === 1
      ? views
      : [
          {
            id: "overview" as const,
            href: "/contribute/moderation",
            pending: null,
          },
          ...views,
        ]

  return (
    <nav
      ref={navRef}
      aria-label={t("reviewQueues")}
      className="relative flex min-w-0 flex-nowrap gap-2 overflow-x-auto rounded-[24px] border border-(--t-border-line) bg-white p-3 [--spacing:0.25rem] [scrollbar-width:thin]"
    >
      {items.map((view) => {
        const selected = view.id === active
        const Icon = view.id === "overview" ? LayoutGrid : REVIEW_ICONS[view.id]

        return (
          <Link
            key={view.id}
            href={view.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-base font-semibold whitespace-nowrap no-underline",
              selected
                ? "border-(--t-ink-base) bg-(--t-ink-base) text-white"
                : "border-transparent text-(--t-ink-dim) hover:bg-(--t-bg-surface) hover:text-(--t-ink-base)"
            )}
          >
            <Icon size={16} aria-hidden />
            {t(view.id)}
            {view.pending !== null && view.pending > 0 && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs tabular-nums",
                  selected
                    ? "bg-white/15 text-white"
                    : "bg-(--t-bg-muted) text-(--t-ink-base)"
                )}
              >
                {view.pending}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
