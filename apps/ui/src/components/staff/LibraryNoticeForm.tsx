"use client"

import { Icon } from "@iconify/react"
import {
  LIBRARY_NOTICE_LABELS,
  type LibraryNoticeType,
  type LibraryNotice,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useId, useRef, useState } from "react"

import { SelectField } from "@/components/ds/SelectField"
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
import { captureWorkspaceAction } from "@/lib/workspace-analytics"

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
 * Post, edit or reactivate a library notice. The drawer keeps actions below
 * its scrolling fields; embedded forms omit the surrounding card chrome.
 */
function noticeEndpoint(
  libraryId: string,
  noticeId: string | undefined,
  reactivate: boolean
) {
  const base = `/api/staff/${libraryId}/notices`
  if (!noticeId) return { url: base, method: "POST" }

  return {
    url: `${base}/${noticeId}${reactivate ? "/reactivate" : ""}`,
    method: reactivate ? "POST" : "PATCH",
  }
}

export function LibraryNoticeForm({
  libraryDocumentId,
  mobile,
  today,
  cycleWeeks = 1,
  stops = [],
  initial,
  onSaved,
  embedded = false,
  drawer = false,
  reactivate = false,
  onCancel,
  onBusyChange,
}: {
  libraryDocumentId: string
  mobile: boolean
  today: string
  cycleWeeks?: number
  stops?: Stop[]
  initial?: LibraryNotice
  onSaved?: (notice: LibraryNotice) => void
  embedded?: boolean
  drawer?: boolean
  reactivate?: boolean
  onCancel?: () => void
  onBusyChange?: (busy: boolean) => void
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
    [from, setFrom] = useState(reactivate ? today : (initial?.from ?? today)),
    [to, setTo] = useState(reactivate ? "" : (initial?.to ?? "")),
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
    onBusyChange?.(true)
    const measured = captureWorkspaceAction(
      {
        workspace_area: "staff",
        workspace_section: "notices",
        workspace_surface: embedded || drawer ? "drawer" : "page",
      },
      "save"
    )
    try {
      const endpoint = noticeEndpoint(
        libraryDocumentId,
        initial?.id,
        reactivate
      )
      const response = await fetch(endpoint.url, {
        method: endpoint.method,
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
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(
          result.error?.message ?? "The notice could not be posted."
        )
      setSent(true)
      measured("success")
      if (!initial) setMessage("")
      onSaved?.(result.notice)
    } catch (e) {
      measured("error")
      setError(e instanceof Error ? e.message : "Please try again.")
    } finally {
      setBusy(false)
      onBusyChange?.(false)
    }
  }
  const field = (name: string) => `${uid}-${name}`
  const messageMissing = !!error && !message.trim()

  return (
    <form
      id={embedded || drawer ? undefined : "post-notice"}
      onSubmit={submit}
      className={
        drawer
          ? "flex h-full min-h-0 flex-1 flex-col"
          : embedded
            ? "flex flex-col gap-5"
            : "flex min-w-0 flex-col gap-5 self-start rounded-[28px] border p-5 sm:p-8"
      }
      style={
        embedded || drawer
          ? undefined
          : { background: T.bg.deep, borderColor: T.border.line }
      }
      aria-label={
        embedded || drawer
          ? reactivate
            ? "Reactivate notice"
            : initial
              ? "Edit notice"
              : "Post a new notice"
          : undefined
      }
      aria-labelledby={embedded || drawer ? undefined : field("heading")}
    >
      <div
        className={
          drawer
            ? "flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6"
            : "contents"
        }
      >
        {drawer ? (
          <p className="m-0 text-base text-(--t-ink-dim)">
            {reactivate
              ? "Check the message and choose fresh dates before showing this notice again."
              : "Keep visitors up to date. Your notice appears on the library page for the dates you choose."}
          </p>
        ) : null}
        {embedded || drawer ? null : (
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
          <SelectField
            className="min-h-[54px] rounded-2xl px-4 text-base"
            id={field("type")}
            label={tUi("type")}
            disabled={busy}
            value={type}
            onValueChange={(value) => {
              const next = value as LibraryNoticeType
              setType(next)
              if (next !== "not_running" && scope === "term_time")
                setScope("service")
            }}
            options={options.map((key) => ({
              value: key,
              label: LIBRARY_NOTICE_LABELS[key],
            }))}
          />
        </div>
        {mobile && (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor={field("scope")} style={fieldLabelStyle}>
                Applies to
              </label>
              <SelectField
                className="min-h-[54px] rounded-2xl px-4 text-base"
                id={field("scope")}
                label="Applies to"
                disabled={busy}
                value={scope}
                onValueChange={(value) =>
                  setScope(value as LibraryNotice["scope"])
                }
                options={[
                  { value: "service", label: "Whole service" },
                  { value: "day", label: "One day’s route" },
                  { value: "stop", label: "One stop" },
                  ...(type === "not_running"
                    ? [{ value: "term_time", label: "Term-time stops" }]
                    : []),
                ]}
              />
            </div>
            {scope === "day" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={field("week")} style={fieldLabelStyle}>
                    Week
                  </label>
                  <SelectField
                    className="min-h-[54px] rounded-2xl px-4 text-base"
                    id={field("week")}
                    label="Week"
                    disabled={busy}
                    value={String(week)}
                    onValueChange={(value) => setWeek(Number(value))}
                    options={Array.from({ length: cycleWeeks }, (_, i) => ({
                      value: String(i + 1),
                      label: `Week ${i + 1}`,
                    }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={field("day")} style={fieldLabelStyle}>
                    Day
                  </label>
                  <SelectField
                    className="min-h-[54px] rounded-2xl px-4 text-base"
                    id={field("day")}
                    label="Day"
                    disabled={busy}
                    value={day}
                    onValueChange={(value) => setDay(value as typeof day)}
                    options={Object.entries(DAY_LABELS).map(
                      ([value, label]) => ({ value, label })
                    )}
                  />
                </div>
              </div>
            )}
            {scope === "stop" && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor={field("stop")} style={fieldLabelStyle}>
                  Stop
                </label>
                <SelectField
                  className="min-h-[54px] rounded-2xl px-4 text-base"
                  id={field("stop")}
                  label="Stop"
                  disabled={busy}
                  required
                  value={stopId}
                  onValueChange={setStopId}
                  options={stops.map((stop) => ({
                    value: stop.id,
                    label: stop.name,
                  }))}
                />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={field("reason")} style={fieldLabelStyle}>
                Reason
              </label>
              <SelectField
                className="min-h-[54px] rounded-2xl px-4 text-base"
                id={field("reason")}
                label="Reason"
                disabled={busy}
                value={reason}
                onValueChange={setReason}
                options={[
                  "holiday",
                  "school_holidays",
                  "maintenance",
                  "breakdown",
                  "weather",
                  "staffing",
                  "works",
                  "other",
                ].map((value) => ({
                  value,
                  label: value
                    .replaceAll("_", " ")
                    .replace(/^./, (c) => c.toUpperCase()),
                }))}
              />
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
              min={reactivate ? today : undefined}
              disabled={busy}
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
              disabled={busy}
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
            disabled={busy}
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
            Notice {reactivate ? "reactivated" : initial ? "updated" : "posted"}
            . It will show on your library’s page for the selected dates.
          </p>
        )}
      </div>
      <div
        className={
          drawer
            ? "flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-(--t-border-line) bg-(--t-bg-deep) px-5 py-4 sm:px-6"
            : "contents"
        }
      >
        {onCancel ? (
          <Button
            type="button"
            variant="surface"
            size="pill-lg"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="pill-lg"
          className={drawer ? "" : "w-full"}
          disabled={busy}
          type="submit"
        >
          {busy
            ? "Saving…"
            : reactivate
              ? "Reactivate notice"
              : initial
                ? "Save notice"
                : "Post notice"}
          <Icon icon="mdi:arrow-right" aria-hidden width={18} />
        </Button>
      </div>
    </form>
  )
}
