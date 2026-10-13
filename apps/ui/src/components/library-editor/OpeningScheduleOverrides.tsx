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
import type * as React from "react"

const control: React.CSSProperties = {
  minHeight: 44,
  border: "1px solid #c9c7ce",
  borderRadius: 8,
  padding: "6px 10px",
  color: "#211e2e",
  background: "#fff",
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
  return (
    <div style={row}>
      <label>
        Access mode{" "}
        <select
          style={control}
          value={frame.staffing}
          onChange={(event) =>
            onChange({
              ...frame,
              staffing: event.target.value as OpeningTimesStaffing,
            })
          }
        >
          {OPENING_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {OPENING_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>
      <label style={row}>
        <input
          type="checkbox"
          checked={frame.overnight === true}
          onChange={(event) =>
            onChange({ ...frame, overnight: event.target.checked })
          }
        />{" "}
        Ends the next day
      </label>
      <label>
        Access or booking note{" "}
        <input
          style={control}
          maxLength={1000}
          value={frame.note ?? ""}
          onChange={(event) => onChange({ ...frame, note: event.target.value })}
          placeholder="e.g. library card required"
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
  return (
    <div>
      {value.length === 0 ? <p>Closed on this date.</p> : null}
      {value.map((frame, n) => (
        <fieldset
          key={frame.id}
          style={{
            border: "1px solid #ddd",
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
              From{" "}
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
              Until{" "}
              <input
                style={control}
                aria-label="End time; 24:00 is midnight"
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
              Remove block
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
        Add opening block
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
  const errors = validateOpeningSchedule(value)

  return (
    <fieldset disabled={disabled} style={{ border: 0, padding: 16, margin: 0 }}>
      {errors.length ? (
        <div role="alert">
          <strong>Check the opening schedule</strong>
          <ul>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <details>
        <summary style={{ minHeight: 44, cursor: "pointer", fontWeight: 600 }}>
          Exceptions and seasonal hours
        </summary>
        <p>
          A dated exception replaces that day. Seasonal hours replace the
          regular week within the selected dates. Closure and changed-hours
          notices take precedence.
        </p>
        <h3>Dated exceptions</h3>
        {(value.exceptions ?? []).map((exception, n) => (
          <fieldset key={n} style={{ margin: "12px 0", borderRadius: 8 }}>
            <legend>Exception {n + 1}</legend>
            <div style={row}>
              <label>
                Date{" "}
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
                Remove exception
              </button>
            </div>
            <Blocks
              label={exception.date || "Exception"}
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
          Add an exception
        </button>
        <h3>Seasonal hours</h3>
        {(value.seasons ?? []).map((season, n) => (
          <fieldset
            key={season.id}
            style={{ margin: "12px 0", borderRadius: 8 }}
          >
            <legend>{season.name || `Season ${n + 1}`}</legend>
            <div style={row}>
              {(["name", "from", "to"] as const).map((key) => (
                <label key={key}>
                  {key === "name" ? "Name" : key === "from" ? "Starts" : "Ends"}{" "}
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
                Remove season
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
                  Open on {day.day}
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
          Add a season from this week
        </button>
      </details>
    </fieldset>
  )
}
