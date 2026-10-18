import { LayoutGrid } from "lucide-react"
import { useTranslations } from "next-intl"

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
      aria-label={t("reviewQueues")}
      className="flex flex-wrap gap-2 rounded-[24px] border border-(--t-border-line) bg-white p-3"
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
              "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-[13px] font-semibold no-underline sm:gap-2 sm:px-4 sm:text-sm",
              selected
                ? "border-(--t-ink-base) bg-(--t-ink-base) text-white"
                : "border-transparent text-(--t-ink-dim) hover:bg-(--t-bg-surface) hover:text-(--t-ink-base)"
            )}
          >
            <Icon size={16} aria-hidden />
            {t(view.id)}
            {view.pending !== null && (
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
