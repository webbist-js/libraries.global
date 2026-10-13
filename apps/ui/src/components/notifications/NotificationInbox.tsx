"use client"

import {
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
} from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useState } from "react"

import {
  type InboxItem,
  useNotifications,
} from "@/components/notifications/NotificationProvider"
import { Button } from "@/components/ui/button"
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
  if (date >= today) return "Today"
  if (date >= week) return "This week"

  return "Earlier"
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
      <div className="border-b border-(--t-divider) p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="m-0 flex items-center gap-3 font-serif text-3xl sm:text-4xl">
              <Bell
                aria-hidden="true"
                className="size-6 text-(--t-accent-primary)"
              />
              {tUi("notifications")}{" "}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-sm text-(--t-ink-dim)">
              <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
              Only you can see this tab<span aria-hidden="true">·</span>
              {loading
                ? tUi("loading")
                : unread
                  ? `${unread} unread`
                  : "All read"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {unread > 0 && (
              <Button
                variant="outline"
                className="rounded-full"
                disabled={saving || loading}
                onClick={() => void read("all")}
              >
                <CheckCheck aria-hidden="true" />
                Mark all as read
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-full">
              <Link href="/profile/settings#notifications">
                <Settings2 aria-hidden="true" />
                {tUi("settings")}{" "}
              </Link>
            </Button>
          </div>
        </div>
        {items.length > 0 && (
          <div
            aria-label={tUi("filter_notifications")}
            className="mt-5 flex flex-wrap gap-2"
          >
            {(["all", "unread", ...Object.keys(categories)] as Filter[]).map(
              (key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--t-accent-primary) ${filter === key ? "border-(--t-ink-base) bg-(--t-ink-base) text-(--t-bg-deep)" : "border-(--t-border-line) text-(--t-ink-base) hover:bg-(--t-bg-elevated)"}`}
                >
                  {key === "all"
                    ? "All"
                    : key === "unread"
                      ? "Unread"
                      : categories[key].label}
                  <span className="opacity-75">
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
          className="flex flex-wrap items-center gap-3 border-b border-(--t-divider) px-5 py-4 text-sm sm:px-7"
        >
          {error || "Could not load notifications. Please try again."}
          {loadError && (
            <Button variant="outline" size="sm" onClick={() => void refresh()}>
              {tUi("try_again")}{" "}
            </Button>
          )}
        </div>
      )}
      {loading ? (
        <div
          role="status"
          className="px-7 py-16 text-center text-(--t-ink-dim)"
        >
          Loading your updates…
        </div>
      ) : !items.length && !loadError ? (
        <div className="px-5 py-16 text-center sm:py-20">
          <div className="mx-auto mb-6 flex size-20 items-center justify-center rounded-full bg-(--t-accent-chip) text-(--t-accent-primary)">
            <Bell aria-hidden="true" className="size-8" />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl">
            No notifications yet
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-(--t-ink-dim)">
            When a library you follow changes, a contribution is reviewed or
            someone follows you, you’ll see it here.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/libraries">
                <Building2 aria-hidden="true" />
                Follow libraries
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="rounded-full"
            >
              <Link href="/contribute">
                <Pencil aria-hidden="true" />
                Make a contribution
              </Link>
            </Button>
          </div>
        </div>
      ) : items.length > 0 && !filtered.length ? (
        <div role="status" className="px-5 py-16 text-center">
          <CircleCheck
            aria-hidden="true"
            className="mx-auto mb-4 size-9 text-(--t-accent-primary)"
          />
          <h2 className="font-serif text-2xl">
            {filter === "unread"
              ? "You’re all caught up"
              : "No updates in this category"}
          </h2>
          <p className="mt-3 text-(--t-ink-dim)">
            {filter === "unread"
              ? "You’ve read every update in your latest notifications."
              : "Other updates are waiting in your inbox."}
          </p>
          <Button
            variant="outline"
            className="mt-6 rounded-full"
            onClick={() => setFilter("all")}
          >
            Show all notifications
          </Button>
        </div>
      ) : (
        ["Today", tUi("this_week"), "Earlier"].map((group) => {
          const rows = filtered.filter(
            (item) => period(item.createdAt, now) === group
          )
          if (!rows.length) return null

          return (
            <div key={group}>
              <h2 className="border-b border-(--t-divider) bg-(--t-bg-elevated) px-5 py-2.5 text-xs font-semibold tracking-wider text-(--t-ink-dim) uppercase sm:px-7">
                {group}
              </h2>
              <ul className="m-0 list-none p-0">
                {rows.map((item) => {
                  const meta = presentation(item.kind)
                  const Icon = meta.icon
                  const tint = categories[meta.category].tint

                  return (
                    <li
                      key={item.documentId}
                      className={`relative flex gap-3 border-b border-(--t-divider) px-5 py-5 last:border-b-0 sm:gap-4 sm:px-7 ${!item.readAt ? "bg-(--t-accent-chip)/30" : ""}`}
                    >
                      <div
                        className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tint}`}
                      >
                        <Icon aria-hidden="true" className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1 pr-4">
                        <h3
                          className={`text-base leading-snug ${!item.readAt ? "font-semibold" : "font-medium"}`}
                        >
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-(--t-ink-dim)">
                          {item.body}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                          <span
                            className={`rounded-full px-2.5 py-1 font-medium ${tint}`}
                          >
                            {meta.label}
                          </span>
                          <time
                            dateTime={item.createdAt}
                            title={new Date(item.createdAt).toLocaleString()}
                            className="text-(--t-ink-dim)"
                          >
                            {when(item.createdAt, now)}
                          </time>
                          {item.href?.startsWith("/") &&
                            !item.href.startsWith("//") && (
                              <Link
                                href={item.href}
                                className="font-semibold text-(--t-accent-primary) underline underline-offset-4"
                                onClick={() => {
                                  if (!item.readAt) void read(item.documentId)
                                }}
                              >
                                {meta.action}
                              </Link>
                            )}
                          {!item.readAt && (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={saving}
                              onClick={() => void read(item.documentId)}
                              aria-label={`Mark as read: ${item.title}`}
                              className="h-7 rounded-full text-xs text-(--t-ink-dim)"
                            >
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
        <p className="border-t border-(--t-divider) px-5 py-4 text-xs text-(--t-ink-dim) sm:px-7">
          Showing your latest {items.length === 50 ? "50 " : ""}notifications.
          Filter counts cover this list; unread totals include all retained
          updates.
        </p>
      )}
    </section>
  )
}
