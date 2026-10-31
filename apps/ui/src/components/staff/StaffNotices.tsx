"use client"

import { Icon } from "@iconify/react"
import {
  LIBRARY_NOTICE_LABELS,
  noticeIsActive,
  noticeEndDate,
  type LibraryNotice,
} from "@repo/shared-data"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useRef, useState } from "react"

import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Badge } from "@/components/ds/Badge"
import { Drawer } from "@/components/ds/Drawer"
import { Sheet } from "@/components/ds/Sheet"
import { Button } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { routing, useRouter } from "@/lib/navigation"

import { LibraryNoticeForm } from "./LibraryNoticeForm"

export type StaffNoticesData = {
  data: LibraryNotice[]
  today: string
  timezone: string
  stops: { id: string; name: string }[]
  cycleWeeks: number
}

/** "19 Oct" from a calendar date, in the route's language. Notice dates
 * are calendar days in the library's zone, so they're formatted as UTC. */
const dayMonth = (date: string, locale: string, year = false) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(parsed)
}

/** "19–23 Oct", "19 Oct – 3 Nov" or "From 3 Nov" (open-ended). */
export function noticeDates(
  notice: Pick<LibraryNotice, "from" | "to">,
  locale: string = routing.defaultLocale,
  year = false
) {
  if (!notice.to) return `From ${dayMonth(notice.from, locale, year)}`
  if (notice.from === notice.to) return dayMonth(notice.from, locale, year)

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).formatRange(
    new Date(`${notice.from}T00:00:00Z`),
    new Date(`${notice.to}T00:00:00Z`)
  )
}

const NOTICE_STATE = {
  past: { text: "Past", icon: "mdi:history", className: "text-(--t-ink-dim)" },
  active: {
    text: "Showing now",
    icon: "mdi:check-circle-outline",
    className: "text-(--t-accent-ok)",
  },
  upcoming: {
    text: "Upcoming",
    icon: "mdi:clock-outline",
    className: "text-(--t-accent-primary)",
  },
} as const

/** A shared paper row keeps dates, publication state and actions together. */
function NoticeRow({
  notice,
  today,
  locale,
  busy,
  onEdit,
  onEnd,
  onReactivate,
}: {
  readonly notice: LibraryNotice
  readonly today: string
  readonly locale: string
  readonly busy: boolean
  readonly onEdit: () => void
  readonly onEnd: () => void
  readonly onReactivate: () => void
}) {
  const ended = !!notice.endedAt || noticeEndDate(notice) < today
  const active = noticeIsActive(notice, today)
  const closure = ["closure", "not_running"].includes(notice.type)
  const state = ended
    ? NOTICE_STATE.past
    : active
      ? NOTICE_STATE.active
      : NOTICE_STATE.upcoming

  return (
    <li className="flex flex-wrap items-center justify-between gap-5 border-t border-(--t-border-line) py-5 first:border-0 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-[1_1_360px]">
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Badge
            label={LIBRARY_NOTICE_LABELS[notice.type]}
            color={ended ? "dim" : closure ? "warn" : "aurora"}
            icon={closure ? "mdi:alert-outline" : "mdi:bullhorn-outline"}
          />
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-medium ${state.className}`}
          >
            <Icon aria-hidden icon={state.icon} width={16} />
            {state.text}
          </span>
        </div>
        <p className="m-0 text-base leading-relaxed text-(--t-ink-base)">
          {notice.message}
        </p>
        <p className="m-0 mt-2 flex items-center gap-1.5 text-sm text-(--t-ink-dim)">
          <Icon
            aria-hidden
            icon="mdi:calendar-blank-outline"
            width={16}
            className="shrink-0"
          />
          {noticeDates(
            notice,
            locale,
            notice.from.slice(0, 4) !== today.slice(0, 4)
          )}
          {notice.endedAt
            ? ` · ended ${dayMonth(notice.endedAt.slice(0, 10), locale, notice.endedAt.slice(0, 4) !== today.slice(0, 4))}`
            : !notice.to && !ended
              ? " · up to 30 days"
              : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {ended ? (
          <Button
            type="button"
            variant="surface"
            size="pill"
            disabled={busy}
            onClick={onReactivate}
          >
            <Icon aria-hidden icon="mdi:refresh" width={17} />
            Reactivate
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={busy}
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="surface"
              size="pill"
              disabled={busy}
              onClick={onEnd}
            >
              End now
            </Button>
          </>
        )}
      </div>
    </li>
  )
}

type NoticeEditor =
  | { mode: "new" }
  | { mode: "edit" | "reactivate"; notice: LibraryNotice }

export function StaffNotices({
  id,
  mobile,
  initial,
  locale = routing.defaultLocale,
}: {
  id: string
  mobile: boolean
  initial: StaffNoticesData
  /** The route locale, for dates. */
  locale?: string
}) {
  const tUi = useUiTranslations("ui")
  const router = useRouter()
  const queryClient = useQueryClient()
  const titleId = useId()
  const editorBusy = useRef(false)
  const postButton = useRef<HTMLButtonElement>(null)
  const [opener, setOpener] = useState<HTMLElement | null>(null)
  const [source, setSource] = useState(initial)
  const [notices, setNotices] = useState(initial.data)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [ending, setEnding] = useState<LibraryNotice | null>(null)
  const [announce, setAnnounce] = useState("")
  const [editor, setEditor] = useState<NoticeEditor | null>(null)
  // Mutations update the list immediately; a refreshed server snapshot wins.
  if (source !== initial) {
    setSource(initial)
    setNotices(initial.data)
  }
  const updateNotice = (notice: LibraryNotice) => {
    setNotices((current) => [
      notice,
      ...current.filter((item) => item.id !== notice.id),
    ])
    queryClient.invalidateQueries({
      predicate: (query) =>
        query.queryKey[0] === "staff-contribute-overview" &&
        query.queryKey[2] === id,
    })
    router.refresh()
  }
  const openEditor = (next: NoticeEditor) => {
    setOpener(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    )
    setEditor(next)
  }
  const closeEditor = () => {
    if (!editorBusy.current) setEditor(null)
  }
  async function end(noticeId: string) {
    setBusy(true)
    setError("")
    setAnnounce("")
    try {
      const response = await fetch(`/api/staff/${id}/notices/${noticeId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Too many changes in a short time. Wait a moment, then try again."
            : (data.error?.message ?? "The notice could not be ended.")
        )
      updateNotice(data.notice)
      setEnding(null)
      setAnnounce("Notice ended. You can reactivate it from Past notices.")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.")
    } finally {
      setBusy(false)
    }
  }
  const current = notices
    .filter(
      (notice) => !notice.endedAt && noticeEndDate(notice) >= initial.today
    )
    .sort((a, b) => a.from.localeCompare(b.from))
  const past = notices
    .filter((notice) => notice.endedAt || noticeEndDate(notice) < initial.today)
    .sort((a, b) =>
      (b.endedAt?.slice(0, 10) ?? noticeEndDate(b)).localeCompare(
        a.endedAt?.slice(0, 10) ?? noticeEndDate(a)
      )
    )
  const editorTitle =
    editor?.mode === "reactivate"
      ? "Reactivate notice"
      : editor?.mode === "edit"
        ? tUi("edit_notice")
        : "Post a new notice"
  const renderRow = (notice: LibraryNotice) => (
    <NoticeRow
      key={notice.id}
      notice={notice}
      today={initial.today}
      locale={locale}
      busy={busy}
      onEdit={() => openEditor({ mode: "edit", notice })}
      onReactivate={() => openEditor({ mode: "reactivate", notice })}
      onEnd={() => {
        setError("")
        setEnding(notice)
      }}
    />
  )

  return (
    <div data-staff-notices="" className="flex min-w-0 flex-col gap-6">
      <WorkspacePageHeader
        title={tUi("notices")}
        lead="Publish updates for visitors, or reactivate a past notice."
        actions={
          <Button
            ref={postButton}
            type="button"
            variant="primary"
            size="pill-lg"
            onClick={() => openEditor({ mode: "new" })}
          >
            <Icon aria-hidden icon="mdi:plus" width={20} />
            Post a new notice
          </Button>
        }
      />
      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
      <section
        className="rounded-[28px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-8"
        aria-labelledby="current-notices-heading"
      >
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 id="current-notices-heading" className="type-h2 m-0">
            Current & upcoming
          </h2>
          <Badge label={String(current.length)} color="aurora" />
        </div>
        {current.length ? (
          <ul className="m-0 list-none p-0">{current.map(renderRow)}</ul>
        ) : (
          <div className="flex items-start gap-3 rounded-[16px] bg-(--t-bg-surface) p-4 text-(--t-ink-dim)">
            <Icon
              aria-hidden
              icon="mdi:bullhorn-outline"
              width={22}
              className="shrink-0"
            />
            <p className="m-0 text-base">
              No current notices. Post an update for a closure, changed hours
              {mobile ? ", a stop that moved" : ""} or anything visitors should
              know.
            </p>
          </div>
        )}
      </section>
      <section
        className="rounded-[28px] border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-8"
        aria-labelledby="past-notices-heading"
      >
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 id="past-notices-heading" className="type-h2 m-0">
            Past notices
          </h2>
          <Badge label={String(past.length)} color="dim" />
        </div>
        <p className="m-0 mb-6 text-sm text-(--t-ink-dim)">
          Reactivate a notice to review its message and choose new dates.
        </p>
        {past.length ? (
          <ul className="m-0 list-none p-0">{past.map(renderRow)}</ul>
        ) : (
          <p className="m-0 text-base text-(--t-ink-dim)">
            Ended and expired notices will stay here for reuse.
          </p>
        )}
      </section>
      <Sheet
        open={!!ending}
        onClose={() => !busy && setEnding(null)}
        side="bottom"
        title={tUi("end_this_notice_now")}
      >
        {ending ? (
          <>
            <p className="m-0 text-base text-(--t-ink-base)">
              {ending.message}
            </p>
            <p className="m-0 mt-2 text-sm text-(--t-ink-dim)">
              It stops showing on the library page and in search straight away.
              You can reactivate it later from Past notices.
            </p>
            {error ? (
              <p
                role="alert"
                className="m-0 mt-3 text-sm text-(--t-accent-danger)"
              >
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <Button
                type="button"
                variant="primary"
                size="pill"
                disabled={busy}
                onClick={() => void end(ending.id)}
              >
                {busy ? "Ending…" : "End notice"}
              </Button>
              <Button
                type="button"
                variant="surface"
                size="pill"
                disabled={busy}
                onClick={() => setEnding(null)}
              >
                Keep it
              </Button>
            </div>
          </>
        ) : null}
      </Sheet>
      <Drawer
        open={!!editor}
        onClose={closeEditor}
        side="left"
        size="lg"
        edgeAligned
        titleId={titleId}
        title={editorTitle}
        subtitle={`Dates use ${initial.timezone.replaceAll("_", " ")}`}
        icon={{
          name:
            editor?.mode === "reactivate"
              ? "mdi:refresh"
              : "mdi:bullhorn-outline",
          bg: T.accent.chip,
          fg: T.accent.primary,
        }}
        returnFocusTo={opener}
        onAfterClose={() => {
          if (opener && !opener.isConnected) postButton.current?.focus()
        }}
        initialFocus={(panel) =>
          panel.querySelector<HTMLElement>("[role=combobox]")
        }
      >
        {editor ? (
          <LibraryNoticeForm
            key={
              editor.mode === "new"
                ? "new"
                : `${editor.mode}:${editor.notice.id}`
            }
            libraryDocumentId={id}
            mobile={mobile}
            today={initial.today}
            stops={initial.stops}
            cycleWeeks={initial.cycleWeeks}
            initial={editor.mode === "new" ? undefined : editor.notice}
            reactivate={editor.mode === "reactivate"}
            drawer
            onCancel={closeEditor}
            onBusyChange={(value) => {
              editorBusy.current = value
            }}
            onSaved={(notice) => {
              updateNotice(notice)
              setAnnounce(
                editor.mode === "reactivate"
                  ? "Notice reactivated for the selected dates."
                  : editor.mode === "edit"
                    ? "Notice updated."
                    : "Notice posted for the selected dates."
              )
              setEditor(null)
            }}
          />
        ) : null}
      </Drawer>
    </div>
  )
}
