"use client"
import { Icon } from "@iconify/react"
import {
  LIBRARY_NOTICE_LABELS,
  noticeIsActive,
  noticeEndDate,
  type LibraryNotice,
} from "@repo/shared-data"
import { useState } from "react"

import { Badge, Sheet } from "@/components/ds"
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
const dayMonth = (date: string, locale: string) => {
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return date

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(parsed)
}

/** "19–23 Oct", "19 Oct – 3 Nov" or "From 3 Nov" (open-ended). */
export function noticeDates(
  notice: Pick<LibraryNotice, "from" | "to">,
  locale: string = routing.defaultLocale
) {
  if (!notice.to) return `From ${dayMonth(notice.from, locale)}`
  if (notice.from === notice.to) return dayMonth(notice.from, locale)
  const sameMonth = notice.from.slice(0, 7) === notice.to.slice(0, 7)

  return sameMonth
    ? `${Number(notice.from.slice(8))}–${dayMonth(notice.to, locale)}`
    : `${dayMonth(notice.from, locale)} – ${dayMonth(notice.to, locale)}`
}

const OUTLINED =
  "inline-flex min-h-11 shrink-0 items-center rounded-full border bg-white px-4 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"
const PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-full bg-(--t-accent-primary) px-5 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"

/** One notice as a bordered row: tinted chip, message, dates, actions. */
function NoticeRow({
  notice,
  today,
  locale,
  busy,
  onEdit,
  onEnd,
}: {
  readonly notice: LibraryNotice
  readonly today: string
  readonly locale: string
  readonly busy: boolean
  readonly onEdit?: () => void
  readonly onEnd?: () => void
}) {
  const ended = !!notice.endedAt || noticeEndDate(notice) < today
  const closure = ["closure", "not_running"].includes(notice.type)
  const active = noticeIsActive(notice, today)

  return (
    <li
      className="flex flex-wrap items-start gap-3 rounded-[20px] border p-4"
      style={{
        borderColor: T.border.line,
        background: ended ? T.bg.surface : T.bg.deep,
      }}
    >
      <div className="shrink-0">
        <Badge
          label={LIBRARY_NOTICE_LABELS[notice.type]}
          color={ended ? "dim" : closure ? "warn" : "aurora"}
          icon={
            ended
              ? "mdi:check"
              : closure
                ? "mdi:alert-outline"
                : "mdi:information-outline"
          }
        />
      </div>
      <div className="min-w-0 flex-[1_1_220px]">
        <p className="m-0 text-[16px]" style={{ color: T.ink.base }}>
          {notice.message}
        </p>
        <p className="m-0 mt-1 text-[13.5px]" style={{ color: T.ink.dim }}>
          {noticeDates(notice, locale)}
          {!notice.to && !ended ? " · shown for 30 days" : ""}
          {ended
            ? notice.endedAt
              ? ` · ended ${dayMonth(notice.endedAt.slice(0, 10), locale)}`
              : " · finished"
            : active
              ? " · showing now"
              : " · upcoming"}
        </p>
      </div>
      {ended ? null : (
        <div className="flex shrink-0 gap-2">
          {onEdit ? (
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              onClick={onEdit}
            >
              Edit
            </button>
          ) : null}
          {onEnd ? (
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.accent.danger }}
              disabled={busy}
              onClick={onEnd}
            >
              {busy ? "Ending…" : "End now"}
            </button>
          ) : null}
        </div>
      )}
    </li>
  )
}

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
  const router = useRouter(),
    [error, setError] = useState<{ message: string; retry: string } | null>(
      null
    ),
    [busy, setBusy] = useState<string | null>(null),
    [ending, setEnding] = useState<LibraryNotice | null>(null),
    [announce, setAnnounce] = useState(""),
    [editing, setEditing] = useState<LibraryNotice | null>(null)
  async function end(noticeId: string) {
    setBusy(noticeId)
    setError(null)
    setAnnounce("")
    try {
      const r = await fetch(`/api/staff/${id}/notices/${noticeId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const data = await r.json().catch(() => ({}))
      if (!r.ok)
        throw new Error(
          r.status === 429
            ? "Too many changes in a short time. Wait a moment, then try again."
            : (data.error?.message ?? "The notice could not be ended.")
        )
      setEnding(null)
      setAnnounce("Notice ended. It no longer shows on the library page.")
      router.refresh()
    } catch (e) {
      setError({
        message: e instanceof Error ? e.message : "Please try again.",
        retry: noticeId,
      })
    } finally {
      setBusy(null)
    }
  }
  const current = initial.data.filter(
      (n) => !n.endedAt && noticeEndDate(n) >= initial.today
    ),
    ended = initial.data.filter(
      (n) => n.endedAt || noticeEndDate(n) < initial.today
    )
  const formProps = {
    libraryDocumentId: id,
    mobile,
    today: initial.today,
    stops: initial.stops,
    cycleWeeks: initial.cycleWeeks,
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
      <section
        className="min-w-0 rounded-[28px] border p-5 sm:p-8"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
        aria-labelledby="notices-heading"
      >
        <h2
          id="notices-heading"
          className="m-0 text-[32px] leading-[1.1] sm:text-[40px]"
          style={{ fontFamily: T.font.serif, fontWeight: 500 }}
        >
          Notices
        </h2>
        <p className="m-0 mt-4 text-[16px]" style={{ color: T.ink.dim }}>
          Shown at the top of your library page, and in search while they apply.
        </p>
        <p role="status" aria-live="polite" className="sr-only">
          {announce}
        </p>
        {error && !ending && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center gap-3 rounded-[16px] px-4 py-3 text-[14px]"
            style={{ background: T.bg.surface, color: T.ink.base }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:alert-circle-outline"
              width={18}
              className="shrink-0"
              style={{ color: T.accent.danger }}
            />
            <span className="min-w-0 flex-1">{error.message}</span>
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              disabled={busy !== null}
              onClick={() => void end(error.retry)}
            >
              Try again
            </button>
          </div>
        )}
        {current.length ? (
          <ul className="m-0 mt-5 flex list-none flex-col gap-3 p-0">
            {current.map((n) => (
              <NoticeRow
                key={n.id}
                notice={n}
                today={initial.today}
                locale={locale}
                busy={busy === n.id}
                onEdit={() => setEditing(n)}
                onEnd={() => {
                  setError(null)
                  setEnding(n)
                }}
              />
            ))}
          </ul>
        ) : (
          <div
            className="mt-5 flex items-start gap-3 rounded-[16px] px-4 py-4"
            style={{ background: T.bg.surface }}
          >
            <Icon
              aria-hidden="true"
              icon="mdi:bullhorn-outline"
              width={20}
              className="mt-0.5 shrink-0"
              style={{ color: T.ink.dim }}
            />
            <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
              <span className="font-semibold" style={{ color: T.ink.base }}>
                No notices showing.
              </span>{" "}
              Post one for a closure, changed hours
              {mobile ? ", a stop that moved" : ""} or anything visitors should
              know.
            </p>
          </div>
        )}
        {ended.length > 0 && (
          <section className="mt-8" aria-labelledby="past-notices-heading">
            <h3
              id="past-notices-heading"
              className="m-0 text-[17px] font-semibold"
              style={{ color: T.ink.base }}
            >
              Past notices from the last 30 days
            </h3>
            <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
              {ended.map((n) => (
                <NoticeRow
                  key={n.id}
                  notice={n}
                  today={initial.today}
                  locale={locale}
                  busy={false}
                />
              ))}
            </ul>
          </section>
        )}
      </section>
      <LibraryNoticeForm {...formProps} onSaved={() => router.refresh()} />
      <Sheet
        open={!!ending}
        onClose={() => busy === null && setEnding(null)}
        side="bottom"
        title="End this notice now?"
      >
        {ending ? (
          <>
            <p className="m-0 text-[15px]" style={{ color: T.ink.base }}>
              {ending.message}
            </p>
            <p className="m-0 mt-2 text-[14px]" style={{ color: T.ink.dim }}>
              {LIBRARY_NOTICE_LABELS[ending.type]} ·{" "}
              {noticeDates(ending, locale)}. It stops showing on the library
              page and in search straight away. This can’t be undone, but you
              can post a new notice.
            </p>
            {error && error.retry === ending.id ? (
              <p
                role="alert"
                className="m-0 mt-3 text-[14px]"
                style={{ color: T.accent.danger }}
              >
                {error.message}
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className={PRIMARY}
                disabled={busy !== null}
                onClick={() => void end(ending.id)}
              >
                {busy === ending.id ? "Ending…" : "End notice"}
              </button>
              <button
                type="button"
                className={OUTLINED}
                style={{ borderColor: T.border.hi, color: T.ink.base }}
                disabled={busy !== null}
                onClick={() => setEnding(null)}
              >
                Keep it
              </button>
            </div>
          </>
        ) : null}
      </Sheet>
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        side="right"
        title="Edit notice"
      >
        {editing && (
          <LibraryNoticeForm
            key={editing.id}
            {...formProps}
            initial={editing}
            embedded
            onSaved={() => {
              setEditing(null)
              router.refresh()
            }}
          />
        )}
      </Sheet>
    </div>
  )
}
