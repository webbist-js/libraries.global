"use client"
import {
  OPENING_MODES,
  OPENING_MODE_LABELS,
  validateOpeningSchedule,
  normalizeOpeningSchedule,
  type OpeningTimesValue,
  type OpeningTimeframe,
  type OpeningTimesStaffing,
} from "@repo/shared-data"
import { useTranslations } from "next-intl"
import type * as React from "react"

import { SelectField } from "@/components/ds/SelectField"

const control: React.CSSProperties = {
  minHeight: 44,
  border: "1px solid var(--t-control-border)",
  borderRadius: 8,
  padding: "6px 10px",
  color: "var(--t-ink-base)",
  background: "var(--t-bg-deep)",
  maxWidth: "100%",
}
const row: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  margin: "8px 0",
}
const fresh = (): OpeningTimeframe => ({
  id: globalThis.crypto.randomUUID(),
  startTime: "09:00",
  endTime: "17:00",
  staffing: "open",
})

export function OpeningBlockDetails({
  frame,
  onChange,
}: {
  frame: OpeningTimeframe
  onChange: (frame: OpeningTimeframe) => void
}) {
  const tStatic = useTranslations("staticUi")

  return (
    <div style={row}>
      <label>
        {tStatic("libraryEditor.access_mode")}{" "}
        <SelectField
          style={control}
          value={String(frame.staffing ?? "")}
          onValueChange={(selectedValue) =>
            onChange({
              ...frame,
              staffing: selectedValue as OpeningTimesStaffing,
            })
          }
          options={OPENING_MODES.map((mode) => ({
            value: String(mode),
            label: String(OPENING_MODE_LABELS[mode]),
          }))}
        />
      </label>
      <label style={row}>
        <input
          type="checkbox"
          checked={frame.overnight === true}
          onChange={(event) =>
            onChange({ ...frame, overnight: event.target.checked })
          }
        />{" "}
        {tStatic("libraryEditor.ends_the_next_day")}
      </label>
      <label>
        {tStatic("libraryEditor.access_or_booking_note")}{" "}
        <input
          style={control}
          maxLength={1000}
          value={frame.note ?? ""}
          onChange={(event) => onChange({ ...frame, note: event.target.value })}
          placeholder={tStatic("libraryEditor.e_g_library_card_required")}
        />
      </label>
    </div>
  )
}
function Blocks({
  value,
  onChange,
  label,
}: {
  value: OpeningTimeframe[]
  onChange: (value: OpeningTimeframe[]) => void
  label: string
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  return (
    <div>
      {value.length === 0 ? (
        <p>{tStatic("libraryEditor.closed_on_this_date")}</p>
      ) : null}
      {value.map((frame, n) => (
        <fieldset
          key={frame.id}
          style={{
            border: "1px solid var(--t-border-line)",
            borderRadius: 8,
            padding: 12,
            margin: "8px 0",
          }}
        >
          <legend>
            {label} · block {n + 1}
          </legend>
          <div style={row}>
            <label>
              {tExisting("staticUi.staff.from")}{" "}
              <input
                style={control}
                type="time"
                value={frame.startTime}
                onChange={(e) =>
                  onChange(
                    value.map((f, i) =>
                      i === n ? { ...f, startTime: e.target.value } : f
                    )
                  )
                }
              />
            </label>
            <label>
              {tExisting("staticUi.staff.until")}{" "}
              <input
                style={control}
                aria-label={tStatic("libraryEditor.end_time_24_00_is_midnight")}
                value={frame.endTime}
                placeholder="17:00"
                pattern="[0-9]{2}:[0-9]{2}"
                onChange={(e) =>
                  onChange(
                    value.map((f, i) =>
                      i === n ? { ...f, endTime: e.target.value } : f
                    )
                  )
                }
              />
            </label>
            <button
              type="button"
              style={control}
              onClick={() => onChange(value.filter((_, i) => i !== n))}
            >
              {tStatic("libraryEditor.remove_block")}
            </button>
          </div>
          <OpeningBlockDetails
            frame={frame}
            onChange={(next) =>
              onChange(value.map((f, i) => (i === n ? next : f)))
            }
          />
        </fieldset>
      ))}
      <button
        type="button"
        style={control}
        disabled={value.length >= 10}
        onClick={() => onChange([...value, fresh()])}
      >
        {tStatic("libraryEditor.add_opening_block")}
      </button>
    </div>
  )
}

/** Dated schedules replace the entire day/week; errors preserve the draft for correction. */
export function OpeningScheduleOverrides({
  value,
  onChange,
  disabled = false,
}: {
  value: OpeningTimesValue
  onChange: (value: OpeningTimesValue) => void
  disabled?: boolean
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  const errors = validateOpeningSchedule(value)

  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 16, margin: 0 }}>
      {errors.length ? (
        <div role="alert">
          <strong>{tStatic("libraryEditor.check_the_opening_schedule")}</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details>
        <summary style={{ minHeight: 44, cursor: "pointer", fontWeight: 600 }}>
          {tStatic("libraryEditor.exceptions_and_seasonal_hours")}
        </summary>
        <p>
          {tStatic(
            "libraryEditor.a_dated_exception_replaces_that_day_seasonal_hours_replace_the_regular_week_within_the_selected_date"
          )}
        </p>
        <h3 className="type-h3">{tStatic("libraryEditor.dated_exceptions")}</h3>
        {(value.exceptions ?? []).map((exception, n) => (
          <fieldset key={n} style={{ margin: "12px 0", borderRadius: 8 }}>
            <legend>
              {tStatic("libraryEditor.exception")} {n + 1}
            </legend>
            <div style={row}>
              <label>
                {tStatic("common.date")}{" "}
                <input
                  style={control}
                  type="date"
                  value={exception.date}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      exceptions: value.exceptions!.map((r, i) =>
                        i === n ? { ...r, date: e.target.value } : r
                      ),
                    })
                  }
                />
              </label>
              <button
                style={control}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    exceptions: value.exceptions!.filter((_, i) => i !== n),
                  })
                }
              >
                {tStatic("libraryEditor.remove_exception")}
              </button>
            </div>
            <Blocks
              label={exception.date || tStatic("libraryEditor.exception")}
              value={exception.timeframes}
              onChange={(timeframes) =>
                onChange({
                  ...value,
                  exceptions: value.exceptions!.map((r, i) =>
                    i === n ? { ...r, timeframes } : r
                  ),
                })
              }
            />
          </fieldset>
        ))}
        <button
          type="button"
          style={control}
          onClick={() =>
            onChange({
              ...value,
              version: 2,
              exceptions: [
                ...(value.exceptions ?? []),
                { date: "", timeframes: [] },
              ],
            })
          }
        >
          {tStatic("libraryEditor.add_an_exception")}
        </button>
        <h3 className="type-h3">{tStatic("libraryEditor.seasonal_hours")}</h3>
        {(value.seasons ?? []).map((season, n) => (
          <fieldset
            key={season.id}
            style={{ margin: "12px 0", borderRadius: 8 }}
          >
            <legend>{season.name || `Season ${n + 1}`}</legend>
            <div style={row}>
              {(["name", "from", "to"] as const).map((key) => (
                <label key={key}>
                  {key === "name"
                    ? tExisting("ui.name")
                    : key === "from"
                      ? tExisting("articleContext.starts")
                      : tExisting("ui.ends")}{" "}
                  <input
                    style={control}
                    type={key === "name" ? "text" : "date"}
                    value={season[key]}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        seasons: value.seasons!.map((r, i) =>
                          i === n ? { ...r, [key]: e.target.value } : r
                        ),
                      })
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                style={control}
                onClick={() =>
                  onChange({
                    ...value,
                    seasons: value.seasons!.filter((_, i) => i !== n),
                  })
                }
              >
                {tStatic("libraryEditor.remove_season")}
              </button>
            </div>
            {season.days.map((day) => (
              <details key={day.day}>
                <summary style={{ minHeight: 44 }}>
                  {day.day}:{" "}
                  {day.enabled
                    ? day.timeframes
                        .map((f) => `${f.startTime}–${f.endTime}`)
                        .join(", ") || "hours needed"
                    : "closed"}
                </summary>
                <label style={row}>
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={(e) =>
                      onChange({
                        ...value,
                        seasons: value.seasons!.map((r, i) =>
                          i === n
                            ? {
                                ...r,
                                days: r.days.map((d) =>
                                  d.day === day.day
                                    ? { ...d, enabled: e.target.checked }
                                    : d
                                ),
                              }
                            : r
                        ),
                      })
                    }
                  />{" "}
                  {tStatic("libraryEditor.open_on")} {day.day}
                </label>
                {day.enabled ? (
                  <Blocks
                    label={day.day}
                    value={day.timeframes}
                    onChange={(timeframes) =>
                      onChange({
                        ...value,
                        seasons: value.seasons!.map((r, i) =>
                          i === n
                            ? {
                                ...r,
                                days: r.days.map((d) =>
                                  d.day === day.day ? { ...d, timeframes } : d
                                ),
                              }
                            : r
                        ),
                      })
                    }
                  />
                ) : null}
              </details>
            ))}
          </fieldset>
        ))}
        <button
          type="button"
          style={control}
          onClick={() =>
            onChange({
              ...value,
              version: 2,
              seasons: [
                ...(value.seasons ?? []),
                {
                  id: globalThis.crypto.randomUUID(),
                  name: "",
                  from: "",
                  to: "",
                  days: normalizeOpeningSchedule(value).days.map((d) => ({
                    ...d,
                    timeframes: d.timeframes.map((f) => ({
                      ...f,
                      id: globalThis.crypto.randomUUID(),
                    })),
                  })),
                },
              ],
            })
          }
        >
          {tStatic("libraryEditor.add_a_season_from_this_week")}
        </button>
      </details>
    </fieldset>
  )
}
