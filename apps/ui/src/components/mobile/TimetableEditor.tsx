"use client"

import { Icon } from "@iconify/react"
import {
  addDays,
  cycleWeekOf,
  dayRoute,
  describeRepeat,
  emptyTimetable,
  hasErrors,
  importTimetableSpreadsheet,
  LIBRARY_NOTICE_LABELS,
  localDateTime,
  matchTimetableColumns,
  spreadsheetRows,
  TIMETABLE_IMPORT_COLUMNS,
  MOBILE_TIMETABLE_LIMITS,
  newTimetableId,
  repeatOptions,
  toMinutes,
  validateMobileTimetable,
  weekdayOf,
  WEEKDAYS,
  type MobileStop,
  type MobileTimetable,
  type MobileVisit,
  type TimetableIssue,
  type TimetableNotice,
  type Weekday,
  type TimetableImportColumn,
} from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import {
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react"

import { EmptyState, Sheet, Switch } from "@/components/ds"
import { LocationLookup } from "@/components/library-editor/LocationLookup"
import { LocationPinMap } from "@/components/library-editor/LocationPinMap"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { Place } from "@/lib/geocode/place"
import { shortDate } from "@/lib/staff/format"

import { stopDistanceKm } from "./mobile-helpers"
import { MobileRouteMap } from "./MobileRouteMap"
import { areaAtStop } from "./stop-area"
import { useMobileClock } from "./useMobileClock"

const labels = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]
const field = {
  border: `1px solid ${T.border.hi}`,
  borderRadius: 8,
  padding: "7px 10px",
  background: T.bg.deep,
  color: T.ink.base,
  minHeight: 40,
  width: "100%",
  fontSize: 14,
}
const OUTLINED =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border bg-white px-3 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"
const PILL_ACTIVE =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold"
const ICON_BUTTON =
  "inline-flex size-7 items-center justify-center rounded-[8px] border bg-white transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-40"
const labelStyle = {
  fontSize: "var(--type-body-small-size)",
  fontWeight: 600,
  color: T.ink.base,
}
const EPOCH_MONDAY = "1970-01-05"

/** The Monday of the week holding `date`; the epoch Monday without one. */
function mondayOf(date: string | null | undefined) {
  try {
    if (!date) return EPOCH_MONDAY

    return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)))
  } catch {
    return EPOCH_MONDAY
  }
}

/** A chip on a stop row. Tone decides the tint; the text does the talking. */
function Chip({
  tone = "neutral",
  icon,
  children,
}: {
  tone?: "neutral" | "danger" | "warn" | "info"
  icon?: string
  children: ReactNode
}) {
  const tint =
    tone === "danger"
      ? { bg: TYPE_TINT.special.bg, fg: T.accent.danger }
      : tone === "warn"
        ? { bg: "#F5EEDC", fg: T.accent.warn }
        : tone === "info"
          ? { bg: T.accent.chip, fg: T.accent.primary }
          : { bg: T.bg.muted, fg: T.ink.dim }

  return (
    <span
      className="inline-flex min-w-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-xs leading-tight font-semibold"
      style={{ background: tint.bg, color: tint.fg }}
    >
      {icon ? <Icon aria-hidden="true" icon={icon} width={13} /> : null}
      {children}
    </span>
  )
}

function TimetableAlert({
  tone,
  icon = "mdi:alert-outline",
  children,
}: {
  tone: "warn" | "info" | "danger"
  icon?: string
  children: ReactNode
}) {
  const tint =
    tone === "danger"
      ? { bg: TYPE_TINT.special.bg, border: T.edge.danger, fg: T.accent.danger }
      : tone === "warn"
        ? { bg: "#F5EEDC", border: T.edge.warn, fg: T.accent.warn }
        : { bg: T.accent.chip, border: T.edge.info, fg: T.accent.primary }

  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className="flex items-start gap-2 rounded-[10px] border px-3 py-2 text-sm leading-relaxed"
      style={{ background: tint.bg, borderColor: tint.border }}
    >
      <Icon
        aria-hidden="true"
        icon={icon}
        width={16}
        className="mt-0.5 shrink-0"
        style={{ color: tint.fg }}
      />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/**
 * One editor shared by the Index record wizard and the staff Timetable
 * tab: a cycle bar, week pills, day tabs, the day's stops in route order
 * with inline editing, the route map, the next four weeks and (when
 * given) the service notices block. The timetable itself is the value;
 * every change goes through `onChange`.
 */
export function TimetableEditor({
  value,
  onChange,
  disabled = false,
  notices = [],
  timezone = "UTC",
  noticesBlock,
}: {
  readonly value: MobileTimetable | null
  readonly onChange: (value: MobileTimetable) => void
  readonly disabled?: boolean
  /** Service notices, for the calendar and the banners. */
  readonly notices?: TimetableNotice[]
  readonly timezone?: string
  /** The staff Timetable tab's "Service notices" list and form. */
  readonly noticesBlock?: ReactNode
}) {
  const tUi = useUiTranslations("ui")

  // "Today" follows the library's clock, never the browser's UTC date, and
  // only once the clock has ticked: the first render (and the server's)
  // anchors on the timetable's own cycle start, so both sides agree.
  const now = useMobileClock()
  const today = useMemo(
    () => (now ? localDateTime(now, timezone).date : null),
    [now, timezone]
  )
  const monday = mondayOf(today ?? value?.cycle.anchor)
  const tt = value ?? emptyTimetable(monday)
  const latest = useRef({ tt, onChange })
  useEffect(() => {
    latest.current = { tt, onChange }
  }, [tt, onChange])
  const write = (next: MobileTimetable) => {
    latest.current.tt = next
    latest.current.onChange(next)
  }
  const listId = useId()
  const [areaNames, setAreaNames] = useState<Record<string, string>>({})
  const [findingPins, setFindingPins] = useState(false)
  const [columnMapping, setColumnMapping] = useState<
    Partial<Record<TimetableImportColumn, number>>
  >({})
  const [day, setDay] = useState<Weekday>("mon"),
    [week, setWeek] = useState(1),
    [weekends, setWeekends] = useState(false),
    [allStops, setAllStops] = useState(false),
    [editingStop, setEditingStop] = useState<string | null>(null),
    [removing, setRemoving] = useState<MobileStop | null>(null),
    [adding, setAdding] = useState(false),
    [paste, setPaste] = useState(false),
    [spreadsheet, setSpreadsheet] = useState("")
  const [stopName, setStopName] = useState("")
  const importHeaders = useMemo(() => {
    try {
      return spreadsheetRows(spreadsheet)[0] ?? []
    } catch {
      return []
    }
  }, [spreadsheet])
  const matchedColumns = {
    ...matchTimetableColumns(importHeaders),
    ...columnMapping,
  }
  const issues = useMemo(() => validateMobileTimetable(tt), [tt])
  const imported = useMemo(
    () =>
      spreadsheet
        ? importTimetableSpreadsheet(tt, spreadsheet, columnMapping)
        : null,
    [tt, spreadsheet, columnMapping]
  )
  const updateVisit = (id: string, patch: Partial<MobileVisit>) =>
    onChange({
      ...tt,
      visits: tt.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    })
  const removeVisit = (id: string) =>
    onChange({ ...tt, visits: tt.visits.filter((v) => v.id !== id) })
  const updateStop = (id: string, patch: Partial<MobileStop>) => {
    const current = latest.current.tt
    write({
      ...current,
      stops: current.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  }
  /** Asks first, in a sheet; `confirmRemoveStop` does the removal. */
  const removeStop = (s: MobileStop) => setRemoving(s)
  const confirmRemoveStop = () => {
    const s = removing
    if (!s) return
    onChange({
      ...tt,
      stops: tt.stops.filter((stop) => stop.id !== s.id),
      visits: tt.visits.filter((v) => v.stopId !== s.id),
    })
    setEditingStop(null)
    setRemoving(null)
  }
  const pinStop = (id: string, lat: number, lng: number, place?: Place) => {
    updateStop(id, { location: { lat, lng }, areaDocumentId: null })
    void (async () => {
      const area = await areaAtStop(lat, lng, place)
      const current = latest.current.tt.stops.find((s) => s.id === id)
      if (current?.location?.lat !== lat || current.location.lng !== lng) return
      updateStop(id, { areaDocumentId: area?.documentId ?? null })
      if (area)
        setAreaNames((names) => ({ ...names, [area.documentId]: area.name }))
    })()
  }
  const addVisit = (existing?: MobileStop, onDay: Weekday = day) => {
    if (
      disabled ||
      tt.visits.length >= MOBILE_TIMETABLE_LIMITS.visits ||
      (!existing && !stopName.trim())
    )
      return
    const stop = existing ??
      tt.stops.find(
        (s) => s.name.toLowerCase() === stopName.trim().toLowerCase()
      ) ?? {
        id: newTimetableId(),
        name: stopName.trim(),
        where: "",
        location: null,
        areaDocumentId: null,
      }
    const visits = tt.visits
      .filter((v) => v.day === onDay)
      .sort((a, b) => a.depart.localeCompare(b.depart))
    const arrive = visits.at(-1)?.depart ?? "09:00"
    const hour = Number(arrive.slice(0, 2)),
      minute = Number(arrive.slice(3))
    const end = Math.min(hour * 60 + minute + 30, 1435)
    const depart = `${Math.floor(end / 60)
      .toString()
      .padStart(2, "0")}:${(end % 60).toString().padStart(2, "0")}`
    onChange({
      ...tt,
      stops: tt.stops.some((s) => s.id === stop.id)
        ? tt.stops
        : [...tt.stops, stop],
      visits: [
        ...tt.visits,
        {
          id: newTimetableId(),
          stopId: stop.id,
          day: onDay,
          arrive,
          depart,
          repeat: { kind: "cycle", weeks: [week] },
          termTimeOnly: false,
          validFrom: null,
          validTo: null,
        },
      ],
    })
    setStopName("")
    setAdding(false)
    setEditingStop(stop.id)
  }
  const anyWeekend = tt.visits.some((v) => WEEKDAYS.indexOf(v.day) >= 5)
  const shownDays = WEEKDAYS.filter(
    (d) =>
      weekends || WEEKDAYS.indexOf(d) < 5 || tt.visits.some((v) => v.day === d)
  )
  const inWeek = (v: MobileVisit, w = week) =>
    v.repeat.kind !== "cycle" || v.repeat.weeks.includes(w)
  const visits = tt.visits
    .filter((v) => v.day === day && inWeek(v))
    .sort((a, b) => a.arrive.localeCompare(b.arrive))
  /** The first date in the next four weeks that is this day of this week. */
  const dateFor = (d: Weekday, w: number): string => {
    for (let i = 0; i < 28; i += 1) {
      const date = addDays(monday, i)
      if (weekdayOf(date) === d && cycleWeekOf(tt, date) === w) return date
    }

    return addDays(monday, WEEKDAYS.indexOf(d))
  }
  const selectedDate = dateFor(day, week)
  const grid = Array.from({ length: 4 }, (_, row) =>
    (weekends || anyWeekend ? WEEKDAYS : WEEKDAYS.slice(0, 5)).map((d) => {
      const date = addDays(monday, row * 7 + WEEKDAYS.indexOf(d))
      const all = dayRoute(tt, notices, date)
      const active = all.filter((o) => !o.cancelledBy)

      return {
        date,
        day: d,
        week: cycleWeekOf(tt, date),
        stops: active.length,
        notRunning: all.length > 0 && active.length === 0,
      }
    })
  )
  const stopOf = (id: string) => tt.stops.find((s) => s.id === id)
  const issuesFor = (visitId: string, code: TimetableIssue["code"]) =>
    issues.some((i) => i.code === code && i.visitIds.includes(visitId))
  const errors = issues.filter((i) => i.level === "error"),
    warnings = issues.filter((i) => i.level === "warning")
  const bannerWarnings = warnings.filter(
    (issue) => allStops || issue.code !== "travel_time"
  )
  const noticeFrom = today ?? monday
  const activeNotices = notices.filter(
    (n) =>
      !n.endedAt &&
      n.from <= addDays(noticeFrom, 28) &&
      (n.to ?? n.from) >= noticeFrom
  )
  const dayLabel = `${labels[WEEKDAYS.indexOf(day)]}, Week ${week}`

  return (
    <div className="space-y-4" style={{ color: T.ink.base }}>
      {/* Cycle bar */}
      <div
        className="flex flex-wrap items-end gap-3 rounded-[16px] border p-4"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
      >
        <label className="flex flex-col gap-1.5" style={labelStyle}>
          Timetable repeats every
          <select
            aria-label={tUi("cycle_length")}
            disabled={disabled}
            value={tt.cycle.weeks}
            style={{ ...field, width: "auto", minWidth: 140, fontWeight: 400 }}
            onChange={(e) => {
              const weeks = Number(e.target.value) as 1 | 2 | 3 | 4
              setWeek(1)
              onChange({
                ...tt,
                cycle: { ...tt.cycle, weeks },
                visits: tt.visits.map((v) =>
                  v.repeat.kind === "cycle"
                    ? {
                        ...v,
                        repeat: {
                          kind: "cycle",
                          weeks: v.repeat.weeks.filter((w) => w <= weeks).length
                            ? v.repeat.weeks.filter((w) => w <= weeks)
                            : [1],
                        },
                      }
                    : v
                ),
              })
            }}
          >
            {[1, 2, 3, 4].map((w) => (
              <option key={w} value={w}>
                {w === 1 ? "Week" : `${w} weeks`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5" style={labelStyle}>
          {tUi("week_1_starts")}
          <input
            aria-label={tUi("week_1_starts")}
            type="date"
            value={tt.cycle.anchor}
            disabled={disabled}
            style={{ ...field, width: "auto", fontWeight: 400 }}
            onChange={(e) => {
              if (e.target.value)
                onChange({
                  ...tt,
                  cycle: { ...tt.cycle, anchor: e.target.value },
                })
            }}
          />
        </label>
        <p
          className="m-0 min-h-10 min-w-32 flex-1 self-end py-2 text-sm"
          style={{ color: T.ink.dim }}
        >
          {tt.stops.length} {tt.stops.length === 1 ? "stop" : "stops"} ·{" "}
          {tt.visits.length} {tt.visits.length === 1 ? "visit" : "visits"} per
          cycle
          {tt.stops.some((s) => s.areaDocumentId) ? (
            <>
              {" "}
              · Areas:{" "}
              {[
                ...new Set(
                  tt.stops
                    .map((s) => s.areaDocumentId)
                    .filter((id): id is string => typeof id === "string")
                ),
              ]
                .map((id) => areaNames[id] ?? "mapped area")
                .join(", ")}
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2 self-end">
          {tt.stops.some((s) => !s.location) && (
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi }}
              disabled={disabled}
              onClick={() => setFindingPins(true)}
            >
              <Icon
                aria-hidden="true"
                icon="mdi:map-marker-plus-outline"
                width={16}
              />
              Find pins
            </button>
          )}
          <button
            type="button"
            className={OUTLINED}
            style={{ borderColor: T.border.hi }}
            disabled={disabled}
            onClick={() => setPaste(true)}
          >
            <Icon aria-hidden="true" icon="mdi:table-arrow-down" width={16} />
            {tUi("paste_from_a_spreadsheet")}
          </button>
        </div>
      </div>

      {/* Week pills */}
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={tUi("cycle_weeks")}
      >
        {Array.from({ length: tt.cycle.weeks }, (_, i) => i + 1).map((w) => {
          const active = week === w && !allStops

          return (
            <button
              key={w}
              type="button"
              className={active ? PILL_ACTIVE : OUTLINED}
              style={
                active
                  ? { background: T.ink.base, color: T.bg.deep }
                  : { borderColor: T.border.hi }
              }
              aria-pressed={active}
              onClick={() => {
                setWeek(w)
                setAllStops(false)
              }}
            >
              Week {w}
            </button>
          )
        })}
        <button
          type="button"
          className={allStops ? PILL_ACTIVE : OUTLINED}
          style={
            allStops
              ? { background: T.ink.base, color: T.bg.deep }
              : { borderColor: T.border.hi }
          }
          aria-pressed={allStops}
          onClick={() => setAllStops(true)}
        >
          All stops
        </button>
      </div>

      {/* Day tabs span both the stop list and the map. */}
      {!allStops ? (
        <div className="space-y-1.5">
          <fieldset
            className="m-0 min-w-0 rounded-[12px] border-0 p-1"
            style={{ background: T.bg.muted2 }}
          >
            <legend className="sr-only">Weekday</legend>
            <div className="flex">
              {shownDays.map((d) => {
                const count = tt.visits.filter(
                  (v) => v.day === d && inWeek(v)
                ).length
                const active = day === d

                return (
                  <label
                    key={d}
                    className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-center justify-center rounded-[8px] px-1 text-sm font-semibold has-focus-visible:outline-[3px] has-focus-visible:outline-offset-2 has-focus-visible:outline-(--t-accent-primary) has-focus-visible:outline-solid"
                    style={{ background: active ? T.bg.deep : undefined }}
                  >
                    <input
                      type="radio"
                      name={`${listId}-weekday`}
                      value={d}
                      checked={active}
                      onChange={() => setDay(d)}
                      className="sr-only"
                    />
                    {labels[WEEKDAYS.indexOf(d)]!.slice(0, 3)}
                    <span
                      className="text-xs leading-tight font-normal"
                      style={{ color: T.ink.dim }}
                    >
                      {count} {count === 1 ? "stop" : "stops"}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="flex justify-end">
            <button
              type="button"
              className="inline-flex min-h-6 items-center text-xs font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
              onClick={() => setWeekends(!weekends)}
            >
              {weekends ? "Hide weekends" : "Show weekends"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Banners */}
      {activeNotices.length || errors.length || bannerWarnings.length ? (
        <div className="space-y-2">
          {activeNotices.map((n) => (
            <TimetableAlert
              key={n.id}
              tone={n.type === "not_running" ? "warn" : "info"}
              icon={
                n.type === "not_running"
                  ? "mdi:alert-outline"
                  : "mdi:map-marker-outline"
              }
            >
              <p className="m-0">
                <strong>{LIBRARY_NOTICE_LABELS[n.type]}.</strong> {n.message}
                <span className="text-xs" style={{ color: T.ink.dim }}>
                  {" "}
                  · {shortDate(n.from)}
                  {n.to ? ` – ${shortDate(n.to)}` : ""}
                </span>
              </p>
            </TimetableAlert>
          ))}
          {errors.map((issue, i) => (
            <TimetableAlert key={`${issue.code}-${i}`} tone="danger">
              {issue.message}
            </TimetableAlert>
          ))}
          {bannerWarnings.map((issue, i) => (
            <TimetableAlert key={`${issue.code}-${i}`} tone="warn">
              {issue.message}
            </TimetableAlert>
          ))}
        </div>
      ) : null}

      {allStops ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {tt.stops.map((s) => {
            const count = tt.visits.filter((v) => v.stopId === s.id).length

            return (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-[14px] border px-4 py-3"
                style={{ borderColor: T.border.line, background: T.bg.deep }}
              >
                <strong className="grow text-base">{s.name}</strong>
                {count === 0 ? (
                  <Chip tone="warn" icon="mdi:alert-outline">
                    No visits
                  </Chip>
                ) : (
                  <Chip>
                    {count} {count === 1 ? "visit" : "visits"}
                  </Chip>
                )}
                {!s.location && (
                  <Chip tone="warn" icon="mdi:map-marker-off-outline">
                    No pin yet
                  </Chip>
                )}
                <button
                  type="button"
                  className={OUTLINED}
                  style={{ borderColor: T.border.hi }}
                  onClick={() => {
                    const first = tt.visits.find((v) => v.stopId === s.id)
                    if (first) {
                      setDay(first.day)
                      if (first.repeat.kind === "cycle")
                        setWeek(first.repeat.weeks[0] ?? 1)
                    }
                    setAllStops(false)
                    setEditingStop(s.id)
                  }}
                >
                  Edit stop
                </button>
                <button
                  type="button"
                  className={OUTLINED}
                  style={{ borderColor: T.border.hi, color: T.accent.danger }}
                  disabled={disabled}
                  onClick={() => removeStop(s)}
                >
                  Delete everywhere
                </button>
              </li>
            )
          })}
          {!tt.stops.length && (
            <li className="text-base" style={{ color: T.ink.dim }}>
              No stops yet. Choose a week and a day to add the first one.
            </li>
          )}
        </ul>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="type-small-heading m-0">{dayLabel}</h2>
              <span className="text-xs" style={{ color: T.ink.dim }}>
                In route order
              </span>
            </div>

            {/* The day's stops */}
            <ol className="m-0 flex list-none flex-col p-0">
              {visits.map((v, index) => {
                const stop = stopOf(v.stopId),
                  previous = visits[index - 1]
                const prevStop = previous ? stopOf(previous.stopId) : null
                const minutes = previous
                  ? toMinutes(v.arrive) - toMinutes(previous.depart)
                  : null
                const km =
                  prevStop?.location && stop?.location
                    ? stopDistanceKm(prevStop.location, stop.location)
                    : null
                const travelWarning = issues.find(
                  (issue) =>
                    issue.code === "travel_time" &&
                    issue.visitIds[0] === previous?.id &&
                    issue.visitIds[1] === v.id
                )
                const overlaps = issuesFor(v.id, "overlap")
                const open = editingStop === v.stopId
                const stopVisits = tt.visits.filter(
                  (x) => x.stopId === v.stopId
                )

                return (
                  <li key={v.id} className="flex flex-col">
                    {previous ? (
                      <div
                        className="ml-4 flex min-h-9 flex-wrap items-center gap-x-2 gap-y-1 border-l border-dashed py-1 pl-2 text-xs"
                        style={{
                          borderColor: T.map.route,
                          color: T.ink.dim,
                        }}
                      >
                        {minutes !== null && minutes >= 0
                          ? `${minutes} min`
                          : "Overlapping times"}
                        {km !== null ? ` · ${km.toFixed(1)} km` : ""}
                        {travelWarning && (
                          <Chip tone="warn" icon="mdi:alert-outline">
                            {travelWarning.message}
                          </Chip>
                        )}
                      </div>
                    ) : null}
                    <div
                      className="overflow-hidden rounded-[12px] border"
                      style={{
                        borderColor: overlaps
                          ? T.accent.danger
                          : open
                            ? T.accent.primary
                            : T.border.line,
                        background: T.bg.deep,
                      }}
                    >
                      <div className="flex items-start gap-2.5 p-3">
                        <span
                          aria-hidden="true"
                          className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-[7px] border text-xs font-bold tabular-nums"
                          style={{
                            borderColor: overlaps
                              ? T.accent.danger
                              : T.map.stopRing,
                            background: open
                              ? overlaps
                                ? T.accent.danger
                                : T.map.stopRing
                              : T.bg.deep,
                            color: open
                              ? T.bg.deep
                              : overlaps
                                ? T.accent.danger
                                : T.map.stopRing,
                          }}
                        >
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          aria-expanded={open}
                          onClick={() => setEditingStop(open ? null : v.stopId)}
                        >
                          <span className="flex flex-wrap items-baseline gap-x-2">
                            <span className="text-sm font-semibold">
                              {stop?.name ?? "Unknown stop"}
                            </span>
                            <span
                              className="text-xs font-semibold tabular-nums"
                              style={{ color: T.ink.dim }}
                            >
                              {v.arrive}–{v.depart}
                            </span>
                          </span>
                          {stop?.where ? (
                            <span
                              className="mt-0.5 block text-xs leading-tight"
                              style={{ color: T.ink.dim }}
                            >
                              {stop.where}
                            </span>
                          ) : null}
                          <span className="mt-1 flex flex-wrap gap-1">
                            <Chip>
                              {describeRepeat(
                                { ...v, termTimeOnly: false },
                                tt.cycle
                              )}
                            </Chip>
                            {v.termTimeOnly && (
                              <Chip tone="info" icon="mdi:school-outline">
                                {tUi("term_time_only")}
                              </Chip>
                            )}
                            {overlaps && (
                              <Chip
                                tone="danger"
                                icon="mdi:alert-circle-outline"
                              >
                                Overlaps
                              </Chip>
                            )}
                            {!stop?.location && (
                              <Chip
                                tone="warn"
                                icon="mdi:map-marker-off-outline"
                              >
                                No pin yet
                              </Chip>
                            )}
                          </span>
                        </button>
                        <span className="flex shrink-0 flex-col gap-1">
                          <button
                            type="button"
                            className={ICON_BUTTON}
                            style={{ borderColor: T.border.line }}
                            disabled
                            aria-label={tUi(
                              "move_up_order_follows_arrival_time"
                            )}
                            title={tUi("order_follows_arrival_time")}
                          >
                            <Icon
                              aria-hidden="true"
                              icon="mdi:chevron-up"
                              width={18}
                            />
                          </button>
                          <button
                            type="button"
                            className={ICON_BUTTON}
                            style={{ borderColor: T.border.line }}
                            disabled
                            aria-label={tUi(
                              "move_down_order_follows_arrival_time"
                            )}
                            title={tUi("order_follows_arrival_time")}
                          >
                            <Icon
                              aria-hidden="true"
                              icon="mdi:chevron-down"
                              width={18}
                            />
                          </button>
                        </span>
                      </div>

                      {open && stop ? (
                        <fieldset
                          disabled={disabled}
                          className="m-0 flex min-w-0 flex-col gap-3 border-0 p-3 pt-1"
                          style={{
                            borderColor: T.border.divider,
                            background: T.bg.deep,
                          }}
                        >
                          <legend className="sr-only">
                            {tUi("edit")} {stop.name}
                          </legend>
                          <div className="grid grid-cols-2 gap-2">
                            <label
                              className="flex flex-col gap-1.5"
                              style={labelStyle}
                            >
                              Stop name
                              <input
                                style={{ ...field, fontWeight: 400 }}
                                maxLength={80}
                                value={stop.name}
                                onChange={(e) =>
                                  updateStop(stop.id, { name: e.target.value })
                                }
                              />
                            </label>
                            <label
                              className="flex flex-col gap-1.5"
                              style={labelStyle}
                            >
                              Where exactly
                              <input
                                style={{ ...field, fontWeight: 400 }}
                                maxLength={140}
                                placeholder="Outside the village hall"
                                value={stop.where}
                                onChange={(e) =>
                                  updateStop(stop.id, { where: e.target.value })
                                }
                              />
                            </label>
                          </div>
                          <p
                            className="m-0 text-sm"
                            style={{ color: T.ink.dim }}
                          >
                            {stop.areaDocumentId
                              ? `Area: ${areaNames[stop.areaDocumentId] ?? "mapped area"} · from the pin`
                              : stop.location
                                ? "Finding the area…"
                                : "Area: set once the stop has a pin"}
                            {stop.location ? (
                              <>
                                {" "}
                                <span style={{ fontFamily: T.font.mono }}>
                                  {stop.location.lat.toFixed(5)},{" "}
                                  {stop.location.lng.toFixed(5)}
                                </span>
                              </>
                            ) : null}
                          </p>
                          <details className="group">
                            <summary
                              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold"
                              style={{ color: T.accent.primary }}
                            >
                              <Icon
                                aria-hidden="true"
                                icon="mdi:map-marker-outline"
                                width={16}
                              />
                              {stop.location ? "Move the pin" : "Place the pin"}
                            </summary>
                            <div className="mt-3 flex flex-col gap-3">
                              <LocationLookup
                                initialQuery={[stop.name, stop.where]
                                  .filter(Boolean)
                                  .join(", ")}
                                onPick={(place) =>
                                  pinStop(stop.id, place.lat, place.lng, place)
                                }
                                onLocate={(lat, lng) =>
                                  pinStop(stop.id, lat, lng)
                                }
                              />
                              <LocationPinMap
                                lat={String(stop.location?.lat ?? "")}
                                lng={String(stop.location?.lng ?? "")}
                                precise
                                onMove={(lat, lng) =>
                                  pinStop(stop.id, lat, lng)
                                }
                              />
                              <div className="grid grid-cols-2 gap-3">
                                <label
                                  className="flex flex-col gap-1.5"
                                  style={labelStyle}
                                >
                                  {tUi("latitude")}{" "}
                                  <input
                                    style={{
                                      ...field,
                                      fontFamily: T.font.mono,
                                      fontWeight: 400,
                                    }}
                                    type="number"
                                    min={-90}
                                    max={90}
                                    step="any"
                                    value={stop.location?.lat ?? ""}
                                    onChange={(e) =>
                                      e.target.value
                                        ? pinStop(
                                            stop.id,
                                            Number(e.target.value),
                                            stop.location?.lng ?? 0
                                          )
                                        : updateStop(stop.id, {
                                            location: null,
                                            areaDocumentId: null,
                                          })
                                    }
                                  />
                                </label>
                                <label
                                  className="flex flex-col gap-1.5"
                                  style={labelStyle}
                                >
                                  {tUi("longitude")}{" "}
                                  <input
                                    style={{
                                      ...field,
                                      fontFamily: T.font.mono,
                                      fontWeight: 400,
                                    }}
                                    type="number"
                                    min={-180}
                                    max={180}
                                    step="any"
                                    value={stop.location?.lng ?? ""}
                                    onChange={(e) =>
                                      e.target.value
                                        ? pinStop(
                                            stop.id,
                                            stop.location?.lat ?? 0,
                                            Number(e.target.value)
                                          )
                                        : updateStop(stop.id, {
                                            location: null,
                                            areaDocumentId: null,
                                          })
                                    }
                                  />
                                </label>
                              </div>
                              {stop.location ? (
                                <button
                                  type="button"
                                  className={`${OUTLINED} self-start`}
                                  style={{ borderColor: T.border.hi }}
                                  onClick={() =>
                                    updateStop(stop.id, {
                                      location: null,
                                      areaDocumentId: null,
                                    })
                                  }
                                >
                                  Remove pin
                                </button>
                              ) : null}
                            </div>
                          </details>

                          <div>
                            <p className="m-0 mb-2" style={labelStyle}>
                              Visits to this stop
                            </p>
                            <ul
                              className="m-0 flex list-none flex-col gap-2 p-0"
                              aria-label={`Visits to ${stop.name}`}
                            >
                              {stopVisits.map((sv) => {
                                const svOptions = repeatOptions(
                                  tt.cycle,
                                  sv.day
                                )
                                const svSelected =
                                  svOptions.find(
                                    (o) =>
                                      JSON.stringify(o.repeat) ===
                                      JSON.stringify(sv.repeat)
                                  )?.value ??
                                  (sv.repeat.kind === "dates"
                                    ? "dates"
                                    : "custom")
                                const visitName = `${labels[WEEKDAYS.indexOf(sv.day)]} ${sv.arrive}`
                                // Term dates show behind the toggle, and
                                // whenever a date is already set.
                                const termDates =
                                  sv.termTimeOnly ||
                                  !!sv.validFrom ||
                                  !!sv.validTo

                                return (
                                  <li
                                    key={sv.id}
                                    className="rounded-[10px] border p-2.5"
                                    style={{
                                      borderColor: T.edge.info,
                                      background: T.bg.deep,
                                    }}
                                  >
                                    <div className="grid grid-cols-3 gap-2">
                                      <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">
                                        Day
                                        <select
                                          aria-label={`Day of the ${visitName} visit`}
                                          style={{
                                            ...field,
                                            minWidth: 0,
                                            fontWeight: 400,
                                          }}
                                          value={sv.day}
                                          onChange={(e) =>
                                            updateVisit(sv.id, {
                                              day: e.target.value as Weekday,
                                            })
                                          }
                                        >
                                          {WEEKDAYS.map((d) => (
                                            <option key={d} value={d}>
                                              {labels[WEEKDAYS.indexOf(d)]}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">
                                        Arrives
                                        <input
                                          aria-label={`Arrives, ${visitName} visit`}
                                          type="time"
                                          step={300}
                                          value={sv.arrive}
                                          style={{
                                            ...field,
                                            minWidth: 0,
                                            fontWeight: 400,
                                          }}
                                          onChange={(e) =>
                                            updateVisit(sv.id, {
                                              arrive: e.target.value,
                                            })
                                          }
                                        />
                                      </label>
                                      <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold">
                                        Leaves
                                        <input
                                          aria-label={`Leaves, ${visitName} visit`}
                                          type="time"
                                          step={300}
                                          value={sv.depart}
                                          style={{
                                            ...field,
                                            minWidth: 0,
                                            fontWeight: 400,
                                          }}
                                          onChange={(e) =>
                                            updateVisit(sv.id, {
                                              depart: e.target.value,
                                            })
                                          }
                                        />
                                      </label>
                                      <label className="col-span-3 flex min-w-0 flex-col gap-1 text-xs font-semibold sm:col-span-2">
                                        Repeats
                                        <select
                                          aria-label={`Repeats, ${visitName} visit`}
                                          value={svSelected}
                                          style={{
                                            ...field,
                                            minWidth: 0,
                                            fontWeight: 400,
                                          }}
                                          onChange={(e) => {
                                            const option = svOptions.find(
                                              (o) => o.value === e.target.value
                                            )
                                            if (option)
                                              updateVisit(sv.id, {
                                                repeat: option.repeat,
                                              })
                                          }}
                                        >
                                          {svSelected === "custom" && (
                                            <option value="custom">
                                              {describeRepeat(sv, tt.cycle)}
                                            </option>
                                          )}
                                          {svOptions.map((o) => (
                                            <option
                                              key={o.value}
                                              value={o.value}
                                            >
                                              {o.label}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <div className="flex items-end justify-end">
                                        <button
                                          type="button"
                                          className={ICON_BUTTON}
                                          style={{
                                            borderColor: T.border.line,
                                            color: T.accent.danger,
                                          }}
                                          aria-label={`Remove the ${visitName} visit`}
                                          onClick={() => removeVisit(sv.id)}
                                        >
                                          <Icon
                                            aria-hidden="true"
                                            icon="mdi:close"
                                            width={16}
                                          />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <Switch
                                        inline
                                        controlFirst
                                        checked={sv.termTimeOnly}
                                        onChange={(termTimeOnly) =>
                                          updateVisit(sv.id, { termTimeOnly })
                                        }
                                        label={tUi("term_time_only")}
                                        disabled={disabled}
                                      />
                                    </div>
                                    {termDates ? (
                                      <div
                                        className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm"
                                        style={{ color: T.ink.dim }}
                                      >
                                        <label className="inline-flex items-center gap-2">
                                          Runs from
                                          <input
                                            aria-label={`Runs from, ${visitName} visit`}
                                            type="date"
                                            style={{
                                              ...field,
                                              width: "auto",
                                              padding: "6px 10px",
                                            }}
                                            value={sv.validFrom ?? ""}
                                            onChange={(e) =>
                                              updateVisit(sv.id, {
                                                validFrom:
                                                  e.target.value || null,
                                              })
                                            }
                                          />
                                        </label>
                                        <label className="inline-flex items-center gap-2">
                                          until
                                          <input
                                            aria-label={`Runs until, ${visitName} visit`}
                                            type="date"
                                            style={{
                                              ...field,
                                              width: "auto",
                                              padding: "6px 10px",
                                            }}
                                            value={sv.validTo ?? ""}
                                            onChange={(e) =>
                                              updateVisit(sv.id, {
                                                validTo: e.target.value || null,
                                              })
                                            }
                                          />
                                        </label>
                                        <span>
                                          Leave blank for the whole year.
                                        </span>
                                      </div>
                                    ) : null}
                                    {sv.repeat.kind === "dates" && (
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                        {sv.repeat.dates.map((date) => (
                                          <button
                                            key={date}
                                            type="button"
                                            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border bg-white px-3 text-sm font-semibold hover:bg-(--t-bg-surface)"
                                            style={{
                                              borderColor: T.border.hi,
                                            }}
                                            aria-label={`Remove date ${date}`}
                                            onClick={() => {
                                              if (sv.repeat.kind === "dates")
                                                updateVisit(sv.id, {
                                                  repeat: {
                                                    kind: "dates",
                                                    dates:
                                                      sv.repeat.dates.filter(
                                                        (d) => d !== date
                                                      ),
                                                  },
                                                })
                                            }}
                                          >
                                            {shortDate(date)}
                                            <Icon
                                              aria-hidden="true"
                                              icon="mdi:close"
                                              width={12}
                                            />
                                          </button>
                                        ))}
                                        <input
                                          aria-label={tUi("add_date")}
                                          type="date"
                                          style={{
                                            ...field,
                                            width: "auto",
                                            padding: "6px 10px",
                                          }}
                                          disabled={
                                            sv.repeat.dates.length >= 52
                                          }
                                          value=""
                                          onChange={(e) => {
                                            if (
                                              e.target.value &&
                                              sv.repeat.kind === "dates"
                                            )
                                              updateVisit(sv.id, {
                                                repeat: {
                                                  kind: "dates",
                                                  dates: [
                                                    ...new Set([
                                                      ...sv.repeat.dates,
                                                      e.target.value,
                                                    ]),
                                                  ].sort(),
                                                },
                                              })
                                          }}
                                        />
                                      </div>
                                    )}
                                  </li>
                                )
                              })}
                            </ul>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={OUTLINED}
                              style={{ borderColor: T.border.hi }}
                              disabled={
                                tt.visits.length >=
                                MOBILE_TIMETABLE_LIMITS.visits
                              }
                              onClick={() => addVisit(stop)}
                            >
                              <Icon
                                aria-hidden="true"
                                icon="mdi:plus"
                                width={16}
                              />
                              Add another visit
                            </button>
                            <button
                              type="button"
                              className="ml-auto inline-flex min-h-10 items-center text-xs font-semibold underline underline-offset-[3px]"
                              style={{
                                color: T.accent.danger,
                              }}
                              onClick={() => removeStop(stop)}
                            >
                              Remove this stop
                            </button>
                          </div>
                        </fieldset>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ol>
            {!visits.length && (
              <p className="m-0 text-base" style={{ color: T.ink.dim }}>
                No stops on {dayLabel} yet.
              </p>
            )}

            {/* Add a stop */}
            {adding ? (
              <div
                className="flex flex-wrap items-end gap-3 rounded-[16px] border p-4"
                style={{ borderColor: T.accent.primary, background: T.bg.deep }}
              >
                <label
                  className="flex min-w-60 grow flex-col gap-1.5"
                  style={labelStyle}
                >
                  Stop name
                  <input
                    list={listId}
                    style={{ ...field, fontWeight: 400 }}
                    value={stopName}
                    maxLength={80}
                    disabled={disabled}
                    autoFocus
                    placeholder="Village hall, Ford Cross"
                    onChange={(e) => setStopName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addVisit()
                      }
                    }}
                  />
                  <datalist id={listId}>
                    {tt.stops.map((s) => (
                      <option key={s.id} value={s.name} />
                    ))}
                  </datalist>
                </label>
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-(--t-accent-primary) px-5 text-sm font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={
                    disabled ||
                    !stopName.trim() ||
                    (tt.stops.length >= MOBILE_TIMETABLE_LIMITS.stops &&
                      !tt.stops.some(
                        (s) =>
                          s.name.toLowerCase() === stopName.trim().toLowerCase()
                      ))
                  }
                  onClick={() => addVisit()}
                >
                  Add to {dayLabel}
                </button>
                <button
                  type="button"
                  className={OUTLINED}
                  style={{ borderColor: T.border.hi }}
                  onClick={() => {
                    setAdding(false)
                    setStopName("")
                  }}
                >
                  {tUi("cancel")}{" "}
                </button>
                {tt.stops.some(
                  (s) => s.name.toLowerCase() === stopName.trim().toLowerCase()
                ) && (
                  <p
                    className="m-0 w-full text-sm"
                    style={{ color: T.ink.dim }}
                  >
                    {stopName.trim()} is already a stop. This adds a visit
                    there.
                  </p>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-[12px] border border-dashed text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50"
                style={{ borderColor: T.border.hi, color: T.accent.primary }}
                disabled={disabled}
                onClick={() => setAdding(true)}
              >
                <Icon aria-hidden="true" icon="mdi:plus" width={18} />
                Add a stop to {dayLabel}
              </button>
            )}
          </div>

          {/* Map */}
          <div className="min-w-0 lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:self-start lg:overflow-y-auto lg:overscroll-contain">
            {tt.stops.some((s) => s.location) ? (
              <>
                <MobileRouteMap
                  tt={tt}
                  notices={notices}
                  timezone={timezone}
                  date={selectedDate}
                  selectedStop={editingStop}
                  onStop={(id) => setEditingStop(id)}
                  caption={`${dayLabel} · ${visits.length} ${visits.length === 1 ? "stop" : "stops"} in stop order. Lines join the stops; they are not road directions.`}
                  compact
                />
                <ul
                  className="m-0 mt-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm"
                  style={{ color: T.ink.dim }}
                  aria-label={tUi("map_legend")}
                >
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block size-3 rounded-full border-2"
                      style={{
                        borderColor: T.map.stopRing,
                        background: T.bg.deep,
                      }}
                    />
                    Stop
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block size-3 rounded-full"
                      style={{ background: T.accent.primary }}
                    />
                    Selected stop
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="inline-block h-0.5 w-5"
                      style={{ background: T.map.route }}
                    />
                    Route, in stop order
                  </li>
                </ul>
              </>
            ) : (
              <div
                className="rounded-[20px] border"
                style={{ borderColor: T.border.line, background: T.bg.deep }}
              >
                <EmptyState
                  compact
                  icon="mdi:map-outline"
                  lead={tUi("no_route_map_yet")}
                  detail="The map appears once a stop has a pin. Open a stop and place its pin."
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* The next four weeks */}
      <section
        className="rounded-[16px] border p-4"
        style={{ background: T.bg.deep, borderColor: T.border.line }}
        aria-labelledby="timetable-weeks-heading"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="timetable-weeks-heading" className="type-small-heading m-0">
            The next four weeks
          </h2>
          <span className="text-xs" style={{ color: T.ink.dim }}>
            Select a day to edit it
          </span>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full table-fixed border-separate border-spacing-1 text-center text-xs">
            <caption className="sr-only">
              Stops per day for the next four weeks, starting{" "}
              {shortDate(monday)}
            </caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="w-16 text-left font-semibold"
                  style={{ color: T.ink.dim }}
                >
                  Week of
                </th>
                {(weekends || anyWeekend ? WEEKDAYS : WEEKDAYS.slice(0, 5)).map(
                  (d) => (
                    <th
                      key={d}
                      scope="col"
                      className="font-semibold"
                      style={{ color: T.ink.dim }}
                    >
                      {labels[WEEKDAYS.indexOf(d)]!.slice(0, 3)}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, i) => (
                <tr key={i}>
                  <th
                    scope="row"
                    className="text-left font-semibold whitespace-nowrap"
                    style={{ color: T.ink.base }}
                  >
                    {shortDate(addDays(monday, i * 7)).slice(4)}
                    <span
                      className="block text-xs font-normal"
                      style={{ color: T.ink.dim }}
                    >
                      Week {row[0]?.week ?? 1}
                    </span>
                  </th>
                  {row.map((cell) => {
                    const selected = cell.date === selectedDate

                    return (
                      <td key={cell.date} className="p-0">
                        <button
                          type="button"
                          className="flex min-h-13 w-full flex-col items-center justify-center rounded-[10px] border px-1 py-1.5 font-semibold transition-colors hover:bg-(--t-bg-surface)"
                          style={{
                            background: cell.notRunning
                              ? "#F5EEDC"
                              : selected
                                ? T.accent.chip
                                : T.bg.surface,
                            borderColor: selected
                              ? T.accent.primary
                              : cell.notRunning
                                ? T.edge.warn
                                : T.border.line,
                            color: cell.notRunning
                              ? T.accent.warn
                              : selected
                                ? T.accent.primary
                                : cell.stops
                                  ? T.ink.base
                                  : T.ink.dim,
                          }}
                          aria-pressed={selected}
                          aria-label={`${labels[WEEKDAYS.indexOf(cell.day)]} ${shortDate(cell.date)}, Week ${cell.week}: ${cell.notRunning ? "not running" : `${cell.stops} stops`}`}
                          onClick={() => {
                            setDay(cell.day)
                            setWeek(cell.week)
                            setAllStops(false)
                          }}
                        >
                          <span className="text-sm tabular-nums">
                            {Number(cell.date.slice(-2))}
                          </span>
                          <span className="text-xs font-normal">
                            {cell.notRunning
                              ? "Not running"
                              : cell.stops
                                ? `${cell.stops} ${cell.stops === 1 ? "stop" : "stops"}`
                                : "—"}
                          </span>
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul
          className="m-0 mt-2 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs"
          style={{ color: T.ink.dim }}
          aria-label={tUi("calendar_legend")}
        >
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-sm border"
              style={{ borderColor: T.edge.warn, background: "#F5EEDC" }}
            />
            Not running (notice)
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block size-3 rounded-sm border"
              style={{
                borderColor: T.accent.primary,
                background: T.accent.chip,
              }}
            />
            Selected day
          </li>
        </ul>
      </section>

      {noticesBlock}

      <Sheet
        open={removing !== null}
        onClose={() => setRemoving(null)}
        side="bottom"
        title={tUi("remove_this_stop")}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              className={OUTLINED}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
              onClick={() => setRemoving(null)}
            >
              Keep the stop
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold text-white transition-colors"
              style={{ background: T.accent.danger }}
              onClick={confirmRemoveStop}
            >
              <Icon aria-hidden="true" icon="mdi:delete-outline" width={16} />
              {tUi("remove")} {removing?.name ?? "the stop"}
            </button>
          </div>
        }
      >
        <p className="m-0 text-base">
          {removing?.name ?? "This stop"} and every visit there (
          {tt.visits.filter((v) => v.stopId === removing?.id).length} in the
          cycle) come off the timetable. Nothing changes for the public until
          you publish.
        </p>
      </Sheet>

      <Sheet
        open={paste}
        onClose={() => setPaste(false)}
        side="right"
        title={tUi("paste_from_a_spreadsheet")}
        footer={
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-full bg-(--t-accent-primary) px-5 text-sm font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              disabled ||
              !imported?.imported ||
              imported.errors.length > 0 ||
              hasErrors(validateMobileTimetable(imported.timetable))
            }
            onClick={() => {
              if (imported) {
                write(imported.timetable)
                setSpreadsheet("")
                setColumnMapping({})
                setPaste(false)
                if (imported.timetable.stops.some((s) => !s.location))
                  setFindingPins(true)
              }
            }}
          >
            Import {imported?.imported ?? 0} visits
          </button>
        }
      >
        <p>
          Include Stop, Day, Arrival and Departure headings. Optional columns:
          Where, Weeks, Dates, Latitude and Longitude.
        </p>
        <textarea
          aria-label={tUi("spreadsheet_rows")}
          rows={10}
          style={field}
          value={spreadsheet}
          onChange={(e) => {
            setSpreadsheet(e.target.value)
            setColumnMapping({})
          }}
        />
        {importHeaders.length > 0 && (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {TIMETABLE_IMPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex flex-col gap-1.5"
                style={labelStyle}
              >
                {
                  {
                    name: "Stop",
                    where: "Where",
                    day: "Day",
                    arrive: "Arrival",
                    depart: "Departure",
                    weeks: "Weeks",
                    dates: "Dates",
                    frequency: "How often",
                    lat: tUi("latitude"),
                    lng: tUi("longitude"),
                  }[column]
                }
                <select
                  style={{ ...field, fontWeight: 400 }}
                  value={matchedColumns[column]}
                  onChange={(e) =>
                    setColumnMapping((current) => ({
                      ...current,
                      [column]: Number(e.target.value),
                    }))
                  }
                >
                  <option value={-1}>Not included</option>
                  {importHeaders.map((header, i) => (
                    <option key={i} value={i}>
                      {header || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        {imported && (
          <>
            <p>
              {imported.imported} visits,{" "}
              {imported.timetable.stops.length - tt.stops.length} new stops.
              Unpinned stops can be placed after import.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="text-left">
                  Import preview · first 12 visits
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Stop</th>
                    <th scope="col">Day</th>
                    <th scope="col">Time</th>
                    <th scope="col">Repeats</th>
                  </tr>
                </thead>
                <tbody>
                  {imported.timetable.visits
                    .slice(tt.visits.length, tt.visits.length + 12)
                    .map((visit) => (
                      <tr key={visit.id}>
                        <th scope="row" className="font-normal">
                          {
                            imported.timetable.stops.find(
                              (stop) => stop.id === visit.stopId
                            )?.name
                          }
                        </th>
                        <td>{labels[WEEKDAYS.indexOf(visit.day)]}</td>
                        <td>
                          {visit.arrive}–{visit.depart}
                        </td>
                        <td>{describeRepeat(visit, tt.cycle)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {[
              ...imported.errors,
              ...validateMobileTimetable(imported.timetable)
                .filter((i) => i.level === "error")
                .map((i) => i.message),
            ].map((error, i) => (
              <p key={i} role="alert" style={{ color: T.accent.danger }}>
                {error}
              </p>
            ))}
          </>
        )}
      </Sheet>
      <Sheet
        open={findingPins}
        onClose={() => setFindingPins(false)}
        side="right"
        title={tUi("find_stop_pins")}
        size="md"
      >
        <p>
          Choose a stop and search for its village or landmark. Check the result
          before placing its pin.
        </p>
        <div className="mt-3 space-y-2">
          {tt.stops
            .filter((s) => !s.location)
            .map((s) => (
              <button
                type="button"
                key={s.id}
                disabled={disabled}
                className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors hover:bg-(--t-bg-surface)"
                style={{ borderColor: T.border.line, color: T.ink.base }}
                onClick={() => {
                  setFindingPins(false)
                  const first = tt.visits.find((v) => v.stopId === s.id)
                  if (first) {
                    setDay(first.day)
                    if (first.repeat.kind === "cycle")
                      setWeek(first.repeat.weeks[0] ?? 1)
                  }
                  setAllStops(false)
                  setEditingStop(s.id)
                }}
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="block font-semibold">{s.name}</span>
                  {s.where ? (
                    <span
                      className="mt-1 block text-sm"
                      style={{ color: T.ink.dim }}
                    >
                      {s.where}
                    </span>
                  ) : null}
                </span>
                <Icon
                  aria-hidden="true"
                  className="shrink-0"
                  icon="mdi:arrow-right"
                  width={20}
                  style={{ color: T.accent.primary }}
                />
              </button>
            ))}
          {tt.stops.every((s) => s.location) && <p>Every stop has a pin.</p>}
        </div>
      </Sheet>
    </div>
  )
}
