"use client"

import {
  AlertCircle,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  Building2,
  CheckCheck,
  CircleCheck,
  LockKeyhole,
  Megaphone,
  Package,
  Pencil,
  Rss,
  Settings2,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState, type ReactNode } from "react"

import {
  type InboxItem,
  useNotifications,
} from "@/components/notifications/NotificationProvider"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

const categories = {
  contributions: {
    label: "Contributions",
    tint: "bg-(--tint-public-bg) text-(--tint-public-fg)",
  },
  libraries: {
    label: "Libraries",
    tint: "bg-(--tint-academic-bg) text-(--tint-academic-fg)",
  },
  community: {
    label: "Community",
    tint: "bg-(--tint-special-bg) text-(--tint-special-fg)",
  },
  news: {
    label: "News & digests",
    tint: "bg-(--t-accent-chip) text-(--t-accent-primary)",
  },
} as const
const kinds = {
  submission_review: {
    category: "contributions",
    label: "Contribution reviews",
    icon: CircleCheck,
    action: "See review",
  },
  recognition: {
    category: "contributions",
    label: "Recognition",
    icon: Award,
    action: "See recognition",
  },
  library_update: {
    category: "libraries",
    label: "Library updates",
    icon: Building2,
    action: "View libraries",
  },
  staff_update: {
    category: "libraries",
    label: "Staff updates",
    icon: ShieldCheck,
    action: "View details",
  },
  feed_update: {
    category: "libraries",
    label: "Feed updates",
    icon: Rss,
    action: "View details",
  },
  billing_update: {
    category: "community",
    label: "Membership",
    icon: ShieldCheck,
    action: "Manage membership",
  },
  new_follower: {
    category: "community",
    label: "New followers",
    icon: UserPlus,
    action: "View profile",
  },
  drive_closed: {
    category: "community",
    label: "Drive closed",
    icon: Package,
    action: "See drive",
  },
  weekly_digest: {
    category: "news",
    label: "Weekly digest",
    icon: BookOpen,
    action: "View following list",
  },
  weekly_report: {
    category: "news",
    label: "Community report",
    icon: BookOpen,
    action: "See your submissions",
  },
  announcement: {
    category: "news",
    label: "Announcements",
    icon: Megaphone,
    action: "Read more",
  },
  newsletter_confirmation: {
    category: "news",
    label: "Newsletter",
    icon: BookOpen,
    action: "View details",
  },
} as const
function presentation(kind: string) {
  return (
    kinds[kind as keyof typeof kinds] ?? {
      category: "news",
      label: "Update",
      icon: Bell,
      action: "View update",
    }
  )
}
type Filter = "all" | "unread" | keyof typeof categories

function period(createdAt: string, now: Date) {
  const date = new Date(createdAt)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const week = new Date(today)
  week.setDate(week.getDate() - ((week.getDay() + 6) % 7))
  if (date >= today) return "today"
  if (date >= week) return "week"

  return "earlier"
}
function when(createdAt: string, now: Date) {
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return "Earlier"
  const hours = Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / 3600000)
  )
  if (!hours) return "Just now"
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return days === 1 ? "Yesterday" : `${days} days ago`

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== now.getFullYear() ? { year: "numeric" } : {}),
  })
}
function matches(item: InboxItem, filter: Filter) {
  return (
    filter === "all" ||
    (filter === "unread"
      ? !item.readAt
      : presentation(item.kind).category === filter)
  )
}

function InboxEmptyState({
  icon: Icon,
  title,
  detail,
  children,
}: {
  readonly icon: LucideIcon
  readonly title: string
  readonly detail: string
  readonly children: ReactNode
}) {
  return (
    <div className="p-5 pt-0 sm:p-7 sm:pt-0">
      <div className="flex flex-col items-start gap-5 rounded-[18px] bg-(--t-bg-surface) p-5 sm:flex-row sm:gap-6 sm:p-8">
        <span
          aria-hidden="true"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-(--t-bg-deep) text-(--t-accent-primary)"
        >
          <Icon className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3
            className="m-0 text-[28px] leading-tight text-(--t-ink-base)"
            style={{ fontFamily: T.font.serif }}
          >
            {title}
          </h3>
          <p className="mt-3 mb-0 max-w-xl text-[15px] leading-relaxed text-(--t-ink-dim)">
            {detail}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotificationInbox() {
  const tUi = useUiTranslations("ui")

  const {
    items,
    unread,
    loading,
    error: loadError,
    refresh,
  } = useNotifications()
  const [filter, setFilter] = useState<Filter>("all")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const now = new Date()
  const filtered = items.filter((item) => matches(item, filter))
  async function read(documentId: string) {
    if (saving) return
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId }),
      })
      if (!res.ok) throw new Error("Failed")
      await refresh()
    } catch {
      setError("Could not mark notifications as read. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-label={tUi("your_notifications")}
      className="min-w-0 overflow-hidden rounded-[24px] border border-(--t-border-line) bg-(--t-bg-deep)"
    >
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2
                className="m-0 text-[28px] leading-tight text-(--t-ink-base)"
                style={{ fontFamily: T.font.serif }}
              >
                {tUi("notifications")}
              </h2>
              {!loading && !loadError && items.length > 0 ? (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${unread ? "bg-(--t-accent-chip) text-(--t-accent-primary)" : "bg-(--tint-public-bg) text-(--tint-public-fg)"}`}
                >
                  {unread ? (
                    `${unread} unread`
                  ) : (
                    <>
                      <CheckCheck aria-hidden className="size-3.5" />
                      All read
                    </>
                  )}
                </span>
              ) : null}
            </div>
            <p className="mt-2 mb-0 flex items-center gap-2 text-[13px] text-(--t-ink-dim)">
              <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
              Only you can see this tab
            </p>
          </div>
          <div
            className={`flex max-w-full flex-wrap gap-3 ${unread ? "w-full sm:w-auto" : ""}`}
          >
            {unread > 0 && (
              <Button
                variant="surface"
                size="pill"
                disabled={saving || loading}
                onClick={() => void read("all")}
              >
                <CheckCheck aria-hidden="true" />
                Mark all as read
              </Button>
            )}
            <Button
              asChild
              variant="surface"
              size="pill"
              className="size-[44px] p-0 sm:h-auto sm:w-auto sm:px-6 sm:py-3"
            >
              <Link href="/profile/settings#notifications">
                <Settings2 aria-hidden="true" />
                <span className="sr-only sm:not-sr-only">
                  {tUi("settings")}
                </span>
              </Link>
            </Button>
          </div>
        </div>
        {items.length > 0 && (
          <div
            role="group"
            aria-label={tUi("filter_notifications")}
            className="-mx-5 mt-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:thin] sm:-mx-7 sm:px-7"
          >
            {(["all", "unread", ...Object.keys(categories)] as Filter[]).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition-colors focus-visible:-outline-offset-4! motion-reduce:transition-none ${filter === key ? "border-(--t-ink-base) bg-(--t-ink-base) text-(--t-bg-deep)" : "border-(--t-border-line) bg-(--t-bg-deep) text-(--t-ink-dim) hover:border-(--t-border-hi) hover:bg-(--t-bg-surface) hover:text-(--t-ink-base)"}`}
                >
                  {key === "all"
                    ? "All"
                    : key === "unread"
                      ? "Unread"
                      : categories[key].label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none tabular-nums ${filter === key ? "bg-white/15 text-white" : "bg-(--t-bg-muted) text-(--t-ink-dim)"}`}
                  >
                    {items.filter((item) => matches(item, key)).length}
                  </span>
                </button>
              )
            )}
          </div>
        )}
      </div>
      {(error || loadError) && (
        <div
          role="alert"
          className="mx-5 mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-(--t-palette-coral-soft) p-4 text-[14px] leading-relaxed text-(--t-palette-coral-fg) sm:mx-7 sm:mb-7"
        >
          <p className="m-0 flex min-w-0 flex-1 items-start gap-2.5">
            <AlertCircle aria-hidden className="mt-0.5 size-5 shrink-0" />
            {error || "Could not load notifications. Please try again."}
          </p>
          {loadError && (
            <Button
              variant="surface"
              size="pill"
              onClick={() => void refresh()}
            >
              {tUi("try_again")}
            </Button>
          )}
        </div>
      )}
      {loading ? (
        <div role="status" className="px-5 pb-5 sm:px-7 sm:pb-7">
          <p className="mt-0 mb-4 text-[14px] text-(--t-ink-dim)">
            Loading your updates…
          </p>
          <div
            aria-hidden="true"
            className="divide-y divide-(--t-border-line) rounded-2xl bg-(--t-bg-surface) px-4 motion-safe:animate-pulse"
          >
            {["first", "second", "third"].map((key) => (
              <div key={key} className="flex items-center gap-4 py-5">
                <span className="size-10 shrink-0 rounded-full bg-(--t-bg-muted)" />
                <div className="flex w-full flex-col gap-2.5">
                  <span className="h-3 w-2/3 max-w-sm rounded-full bg-(--t-bg-muted)" />
                  <span className="h-3 w-1/2 max-w-xs rounded-full bg-(--t-bg-muted)" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !items.length && !loadError ? (
        <InboxEmptyState
          icon={Bell}
          title="No notifications yet"
          detail="Updates about the libraries you follow, your contributions and the community will appear here."
        >
          <Button asChild variant="primary" size="pill">
            <Link href="/libraries">
              <Building2 aria-hidden="true" />
              Follow libraries
            </Link>
          </Button>
          <Button asChild variant="surface" size="pill">
            <Link href="/contribute">
              <Pencil aria-hidden="true" />
              Make a contribution
            </Link>
          </Button>
        </InboxEmptyState>
      ) : items.length > 0 && !filtered.length ? (
        <div role="status">
          <InboxEmptyState
            icon={filter === "unread" ? CircleCheck : Bell}
            title={
              filter === "unread"
                ? "You’re all caught up"
                : "No updates in this category"
            }
            detail={
              filter === "unread"
                ? "You’ve read every update in your latest notifications."
                : "Other updates are waiting in your inbox."
            }
          >
            <Button
              variant="surface"
              size="pill"
              onClick={() => setFilter("all")}
            >
              Show all notifications
            </Button>
          </InboxEmptyState>
        </div>
      ) : (
        [
          { id: "today", label: "Today" },
          { id: "week", label: tUi("this_week") },
          { id: "earlier", label: "Earlier" },
        ].map((group) => {
          const rows = filtered.filter(
            (item) => period(item.createdAt, now) === group.id
          )
          if (!rows.length) return null

          return (
            <div key={group.id}>
              <h3 className="m-0 border-y border-(--t-border-line) bg-(--t-bg-surface) px-5 py-3 text-[12px] font-semibold text-(--t-ink-dim) sm:px-7">
                {group.label}
              </h3>
              <ul className="m-0 list-none p-0">
                {rows.map((item) => {
                  const meta = presentation(item.kind)
                  const Icon = meta.icon
                  const tint = categories[meta.category].tint

                  return (
                    <li
                      key={item.documentId}
                      className={`relative flex gap-3 border-b border-(--t-border-line) px-5 py-5 last:border-b-0 sm:gap-4 sm:px-7 ${!item.readAt ? "bg-(--t-accent-chip)/25" : ""}`}
                    >
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-full ${tint}`}
                      >
                        <Icon aria-hidden="true" className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1 pr-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                          <h4
                            className={`m-0 text-[15px] leading-snug [overflow-wrap:anywhere] ${!item.readAt ? "font-semibold" : "font-medium"}`}
                          >
                            {item.title}
                          </h4>
                          <time
                            dateTime={item.createdAt}
                            title={new Date(item.createdAt).toLocaleString()}
                            className="shrink-0 text-[12px] text-(--t-ink-low)"
                          >
                            {when(item.createdAt, now)}
                          </time>
                        </div>
                        <p className="mt-1.5 mb-0 text-[14px] leading-relaxed [overflow-wrap:anywhere] whitespace-pre-line text-(--t-ink-dim)">
                          {item.body}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tint}`}
                          >
                            {meta.label}
                          </span>
                          {item.href?.startsWith("/") &&
                            !item.href.startsWith("//") && (
                              <Link
                                href={item.href}
                                className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-(--t-accent-primary) underline decoration-transparent underline-offset-4 hover:decoration-current"
                                onClick={() => {
                                  if (!item.readAt) void read(item.documentId)
                                }}
                              >
                                {meta.action}
                                <ArrowRight aria-hidden className="size-3.5" />
                              </Link>
                            )}
                          {!item.readAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={saving}
                              onClick={() => void read(item.documentId)}
                              aria-label={`Mark as read: ${item.title}`}
                              className="min-h-[44px] rounded-full px-3 text-[13px] text-(--t-ink-dim)"
                            >
                              <CheckCheck aria-hidden className="size-4" />
                              Mark as read
                            </Button>
                          )}
                        </div>
                      </div>
                      {!item.readAt && (
                        <span className="absolute top-6 right-5 size-2.5 rounded-full bg-(--t-accent-primary) sm:right-7">
                          <span className="sr-only">Unread</span>
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })
      )}
      {items.length > 0 && (
        <p className="m-0 border-t border-(--t-border-line) px-5 py-4 text-[12px] leading-relaxed text-(--t-ink-dim) sm:px-7">
          Filters apply to the latest {items.length}{" "}
          {items.length === 1 ? "update" : "updates"} shown here. The unread
          total includes all retained notifications.
        </p>
      )}
    </section>
  )
}
