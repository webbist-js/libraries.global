"use client"
import { Icon } from "@iconify/react"
import {
  hasErrors,
  LIBRARY_NOTICE_LABELS,
  noticeEndDate,
  timetableHash,
  validateMobileTimetable,
  type LibraryNotice,
  type MobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"
import { useEffect, useState } from "react"

import { Badge, PublishBar, Sheet } from "@/components/ds"
import { LibraryNoticeForm } from "@/components/staff/LibraryNoticeForm"
import { noticeDates } from "@/components/staff/StaffNotices"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import { useStaffLibraryHref } from "@/lib/staff/use-library-href"

import { TimetableEditor } from "./TimetableEditor"

const OUTLINED =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-4 text-[14px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"

/**
 * The staff Timetable tab: the editor, the library's service notices (with
 * "Add a notice" in a sheet) and the publish bar, which collapses to a
 * quiet line while nothing is unpublished. Publishing sends the timetable
 * with the hash it started from, so a 409 means someone else published
 * first.
 */
export function StaffTimetableEditor({
  id,
  initial,
  locale,
  notices,
  timezone,
  today,
  stops,
}: {
  readonly id: string
  readonly initial: MobileTimetable | null
  readonly locale: string
  readonly notices: LibraryNotice[]
  readonly timezone: string
  readonly today: string
  readonly stops: { id: string; name: string }[]
}) {
  const staffHref = useStaffLibraryHref(id)
  const [value, setValue] = useState(initial),
    [saved, setSaved] = useState(initial),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [posting, setPosting] = useState(false),
    [stale, setStale] = useState(false),
    router = useRouter()
  const dirty = timetableHash(value) !== timetableHash(saved)
  // After a 409, "Reload the timetable" refreshes the route; the fresh
  // `initial` then replaces the editor's copy.
  useEffect(() => {
    if (!stale) return
    setValue(initial)
    setSaved(initial)
    setStale(false)
    setError("")
    setMessage("Reloaded the latest timetable. Make your changes again.")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial])
  async function publish() {
    if (!value || hasErrors(validateMobileTimetable(value))) {
      setError("Resolve the timetable errors before publishing.")

      return
    }
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/staff/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fields: { mobileTimetable: value },
          previous: { mobileTimetable: timetableHash(saved) },
          locale,
          note: "Updated the mobile timetable",
        }),
      })
      const result = await response.json()
      if (response.status === 409) setStale(true)
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "The timetable changed while you were editing. Reload it to see the latest version, then make your changes again."
            : (result.error?.message ?? "The timetable could not be published.")
        )
      setSaved(value)
      setMessage("Timetable published.")
      router.refresh()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The timetable could not be published."
      )
    } finally {
      setBusy(false)
    }
  }
  const current = notices.filter((n) => !n.endedAt && noticeEndDate(n) >= today)
  const noticesBlock = (
    <section
      className="rounded-[20px] border p-5 sm:p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby="service-notices-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="service-notices-heading"
            className="m-0 text-[20px]"
            style={{ fontFamily: T.font.serif, fontWeight: 500 }}
          >
            Service notices
          </h2>
          <p className="m-0 mt-0.5 text-[14px]" style={{ color: T.ink.dim }}>
            Notices publish separately from the timetable and cancel visits
            while they apply.
          </p>
        </div>
        <button
          type="button"
          className={OUTLINED}
          style={{ borderColor: T.border.hi, color: T.ink.base }}
          onClick={() => setPosting(true)}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:plus"
            width={16}
            style={{ color: T.accent.primary }}
          />
          Add a notice
        </button>
      </div>
      {current.length ? (
        <ul className="m-0 mt-4 flex list-none flex-col gap-2 p-0">
          {current.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-start gap-3 rounded-[14px] border px-4 py-3"
              style={{ borderColor: T.border.line }}
            >
              <Badge
                label={LIBRARY_NOTICE_LABELS[n.type]}
                color={n.type === "not_running" ? "warn" : "aurora"}
                icon={
                  n.type === "not_running"
                    ? "mdi:alert-outline"
                    : "mdi:information-outline"
                }
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px]">{n.message}</span>
                <span
                  className="block text-[13px]"
                  style={{ color: T.ink.dim }}
                >
                  {noticeDates(n)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-4 text-[14.5px]" style={{ color: T.ink.dim }}>
          No notices showing. The timetable runs as published.
        </p>
      )}
      <p className="m-0 mt-4 text-[14px]">
        <Link
          href={staffHref("/notices")}
          className="font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          Manage every notice
        </Link>
      </p>
    </section>
  )

  return (
    <>
      <TimetableEditor
        value={value}
        onChange={setValue}
        disabled={busy}
        notices={notices as TimetableNotice[]}
        timezone={timezone}
        noticesBlock={noticesBlock}
      />
      {error ? (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center gap-3 text-[14px]"
          style={{ color: T.accent.danger }}
        >
          <p className="m-0 flex items-start gap-2">
            <Icon
              aria-hidden="true"
              icon="mdi:alert-circle-outline"
              width={18}
              className="shrink-0"
            />
            {error}
          </p>
          {stale ? (
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              onClick={() => router.refresh()}
            >
              <Icon aria-hidden="true" icon="mdi:refresh" width={16} />
              Reload the timetable
            </button>
          ) : null}
        </div>
      ) : null}
      <PublishBar
        count={dirty ? 1 : 0}
        busy={busy}
        status={message || undefined}
        onDiscard={() => {
          setValue(saved)
          setError("")
          setMessage("")
        }}
        onPublish={() => {
          void publish()
        }}
        publishLabel="Publish timetable"
      />
      <Sheet
        open={posting}
        onClose={() => setPosting(false)}
        side="right"
        title="Post a notice"
      >
        <LibraryNoticeForm
          libraryDocumentId={id}
          mobile
          today={today}
          stops={stops}
          cycleWeeks={value?.cycle.weeks ?? 1}
          embedded
          onSaved={() => {
            setPosting(false)
            router.refresh()
          }}
        />
      </Sheet>
    </>
  )
}
