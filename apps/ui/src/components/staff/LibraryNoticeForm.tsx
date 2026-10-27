"use client"

import { Icon } from "@iconify/react"
import {
  LIBRARY_NOTICE_LABELS,
  type LibraryNoticeType,
  type LibraryNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useRef, useState } from "react"

import {
  OpeningTimesEditor,
  emptyOpeningTimes,
  type OpeningTimesData,
} from "@/components/library-editor/OpeningTimesEditor"
import {
  fieldHintStyle,
  fieldInputStyle,
  fieldLabelStyle,
} from "@/components/library-editor/wizard.constants"
import { Button } from "@/components/ui/button"
import { T, TYPE_TINT } from "@/lib/design-tokens"

type Stop = { id: string; name: string }
const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
}

const noticeInputStyle = {
  ...fieldInputStyle,
  minWidth: 0,
  minHeight: "54px",
  padding: "12px 16px",
  background: T.bg.deep,
  borderRadius: "16px",
  fontSize: "var(--type-body-size)",
}

function RequiredTag() {
  const tUi = useUiTranslations("ui")

  return (
    <span
      className="text-sm font-medium"
      style={{ color: TYPE_TINT.special.fg }}
    >
      {tUi("required_d0a363")}{" "}
    </span>
  )
}

/**
 * Post or edit a library notice. Posts publish at once. As a card on the
 * Notices tab; `embedded` drops the card chrome for a Sheet or the
 * Timetable tab.
 */
export function LibraryNoticeForm({
  libraryDocumentId,
  mobile,
  today,
  cycleWeeks = 1,
  stops = [],
  initial,
  onSaved,
  embedded = false,
}: {
  libraryDocumentId: string
  mobile: boolean
  today: string
  cycleWeeks?: number
  stops?: Stop[]
  initial?: LibraryNotice
  onSaved?: () => void
  embedded?: boolean
}) {
  const tUi = useUiTranslations("ui")

  const uid = useId()
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [type, setType] = useState<LibraryNoticeType>(
      initial?.type ?? (mobile ? "not_running" : "closure")
    ),
    [scope, setScope] = useState(
      initial?.scope ?? (mobile ? "service" : "library")
    ),
    [week, setWeek] = useState(initial?.scopeWeek ?? 1),
    [day, setDay] = useState(initial?.scopeDay ?? "mon"),
    [stopId, setStopId] = useState(initial?.stopId ?? stops[0]?.id ?? ""),
    [reason, setReason] = useState(initial?.reason ?? "other"),
    [from, setFrom] = useState(initial?.from ?? today),
    [to, setTo] = useState(initial?.to ?? ""),
    [message, setMessage] = useState(initial?.message ?? ""),
    [hours, setHours] = useState<OpeningTimesData>(
      (initial?.hours as OpeningTimesData) ?? emptyOpeningTimes()
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [sent, setSent] = useState(false)
  const options: LibraryNoticeType[] = mobile
    ? ["not_running", "times_changed", "stop_moved", "extra_visit"]
    : ["closure", "changed_hours", "service"]
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setSent(false)
    if (!message.trim()) {
      setError("Write the message people will see.")
      messageRef.current?.focus()

      return
    }
    setBusy(true)
    try {
      const response = await fetch(
        `/api/staff/${libraryDocumentId}/notices${initial ? `/${initial.id}` : ""}`,
        {
          method: initial ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            scope,
            scopeWeek: scope === "day" ? week : null,
            scopeDay: scope === "day" ? day : null,
            stopId: scope === "stop" ? stopId : null,
            from,
            to: to || null,
            message: message.trim(),
            reason: mobile ? reason : null,
            hours: type === "changed_hours" ? hours : null,
          }),
        }
      )
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "The notice could not be posted."
        )
      setSent(true)
      if (!initial) setMessage("")
      onSaved?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.")
    } finally {
      setBusy(false)
    }
  }
  const field = (name: string) => `${uid}-${name}`
  const messageMissing = !!error && !message.trim()

  return (
    <form
      id={embedded ? undefined : "post-notice"}
      onSubmit={submit}
      className={
        embedded
          ? "flex flex-col gap-5"
          : "flex min-w-0 flex-col gap-5 self-start rounded-[28px] border p-5 sm:p-8"
      }
      style={
        embedded
          ? undefined
          : { background: T.bg.deep, borderColor: T.border.line }
      }
      aria-labelledby={embedded ? undefined : field("heading")}
    >
      {embedded ? null : (
        <div>
          <h2 id={field("heading")} className="type-h2 m-0">
            {initial ? tUi("edit_notice") : tUi("post_a_notice")}
          </h2>
          <p className="m-0 mt-1 text-sm" style={{ color: T.ink.dim }}>
            Publishes straight away. Dates use the library’s timezone.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={field("type")} style={fieldLabelStyle}>
          {tUi("type")}
        </label>
        <select
          id={field("type")}
          style={noticeInputStyle}
          value={type}
          onChange={(e) => {
            const next = e.target.value as LibraryNoticeType
            setType(next)
            if (next !== "not_running" && scope === "term_time")
              setScope("service")
          }}
        >
          {options.map((key) => (
            <option key={key} value={key}>
              {LIBRARY_NOTICE_LABELS[key]}
            </option>
          ))}
        </select>
      </div>
      {mobile && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={field("scope")} style={fieldLabelStyle}>
              Applies to
            </label>
            <select
              id={field("scope")}
              style={noticeInputStyle}
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as LibraryNotice["scope"])
              }
            >
              <option value="service">Whole service</option>
              <option value="day">One day’s route</option>
              <option value="stop">One stop</option>
              {type === "not_running" && (
                <option value="term_time">Term-time stops</option>
              )}
            </select>
          </div>
          {scope === "day" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={field("week")} style={fieldLabelStyle}>
                  Week
                </label>
                <select
                  id={field("week")}
                  style={noticeInputStyle}
                  value={week}
                  onChange={(e) => setWeek(Number(e.target.value))}
                >
                  {Array.from({ length: cycleWeeks }, (_, i) => (
                    <option key={i} value={i + 1}>
                      Week {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor={field("day")} style={fieldLabelStyle}>
                  Day
                </label>
                <select
                  id={field("day")}
                  style={noticeInputStyle}
                  value={day}
                  onChange={(e) => setDay(e.target.value as typeof day)}
                >
                  {Object.entries(DAY_LABELS).map(([d, label]) => (
                    <option key={d} value={d}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          {scope === "stop" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={field("stop")} style={fieldLabelStyle}>
                Stop
              </label>
              <select
                id={field("stop")}
                style={noticeInputStyle}
                required
                value={stopId}
                onChange={(e) => setStopId(e.target.value)}
              >
                {stops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={field("reason")} style={fieldLabelStyle}>
              Reason
            </label>
            <select
              id={field("reason")}
              style={noticeInputStyle}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              {[
                "holiday",
                "school_holidays",
                "maintenance",
                "breakdown",
                "weather",
                "staffing",
                "works",
                "other",
              ].map((r) => (
                <option key={r} value={r}>
                  {r.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field("from")} style={fieldLabelStyle}>
            From
          </label>
          <input
            id={field("from")}
            type="date"
            style={noticeInputStyle}
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={field("to")} style={fieldLabelStyle}>
            Until{" "}
            <span style={{ color: T.ink.dim, fontWeight: 400 }}>
              {tUi("optional")}{" "}
            </span>
          </label>
          <input
            id={field("to")}
            type="date"
            style={noticeInputStyle}
            min={from}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      <p style={fieldHintStyle}>
        An open-ended notice stays visible for 30 days.
      </p>
      {type === "changed_hours" && (
        <OpeningTimesEditor value={hours} onChange={setHours} />
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={field("message")} style={fieldLabelStyle}>
          Message
          <RequiredTag />
        </label>
        <textarea
          ref={messageRef}
          id={field("message")}
          style={{
            ...noticeInputStyle,
            minHeight: "120px",
            resize: "vertical",
            ...(messageMissing ? { borderColor: T.accent.danger } : {}),
          }}
          required
          maxLength={280}
          placeholder="What changes, for which dates, and when it’s back to normal."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={messageMissing || undefined}
          aria-describedby={
            error
              ? `${field("error")} ${field("message-help")}`
              : field("message-help")
          }
        />
        <p id={field("message-help")} style={fieldHintStyle}>
          {message.length} of 280 characters. This is the message people will
          see.
        </p>
      </div>
      {error && (
        <p
          id={field("error")}
          role="alert"
          className="m-0 flex items-start gap-2 text-sm"
          style={{ color: T.accent.danger }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:alert-circle-outline"
            width={18}
            className="shrink-0"
          />
          {error}
        </p>
      )}
      {sent && (
        <p
          role="status"
          className="m-0 flex items-start gap-2 text-sm"
          style={{ color: T.accent.ok }}
        >
          <Icon
            aria-hidden="true"
            icon="mdi:check-circle-outline"
            width={18}
            className="shrink-0"
          />
          Notice {initial ? "updated" : "posted"}. It is visible on your
          library’s page.
        </p>
      )}
      <Button
        variant="primary"
        size="pill-lg"
        className="w-full"
        disabled={busy}
        type="submit"
      >
        {busy ? "Posting…" : initial ? "Save notice" : "Post notice"}
      </Button>
    </form>
  )
}
