import {
  addDays,
  describeRepeat,
  emptyTimetable,
  hasErrors,
  importTimetableSpreadsheet,
  newTimetableId,
  repeatOptions,
  validateMobileTimetable,
  weekdayOf,
  WEEKDAYS,
  type MobileStop,
  type MobileTimetable,
  type MobileVisit,
  type Weekday,
} from "@repo/shared-data"
import {
  Alert,
  Box,
  Button,
  Field,
  Flex,
  Typography,
} from "@strapi/design-system"
import { useField } from "@strapi/strapi/admin"
import { useMemo, useState } from "react"

type Props = {
  name: string
  value?: MobileTimetable | null
  disabled?: boolean
  required?: boolean
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: string
}
const style = {
  width: "100%",
  minHeight: 36,
  padding: 8,
  border: "1px solid #dcdce4",
  borderRadius: 4,
}
function monday() {
  const date = new Date().toISOString().slice(0, 10)

  return addDays(date, -WEEKDAYS.indexOf(weekdayOf(date)))
}

export default function MobileTimetableInput({
  name,
  value,
  disabled,
  required,
  label,
  hint,
  error,
}: Props) {
  const field = useField<MobileTimetable | null>(name),
    tt = field.value ?? value ?? emptyTimetable(monday())
  const [paste, setPaste] = useState("")
  const [week, setWeek] = useState(1)
  const issues = useMemo(() => validateMobileTimetable(tt), [tt])
  const change = (next: MobileTimetable) => field.onChange(name, next)
  const stop = (id: string, patch: Partial<MobileStop>) =>
    change({
      ...tt,
      stops: tt.stops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    })
  const visit = (id: string, patch: Partial<MobileVisit>) =>
    change({
      ...tt,
      visits: tt.visits.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    })
  const imported = useMemo(
    () => (paste ? importTimetableSpreadsheet(tt, paste) : null),
    [tt, paste]
  )

  return (
    <Field.Root name={name} required={required} error={error} hint={hint}>
      <Field.Label>{label ?? "Mobile timetable"}</Field.Label>
      <Box padding={4} background="neutral0" hasRadius borderColor="neutral200">
        <Flex gap={4} alignItems="end">
          <label>
            Cycle length
            <select
              disabled={disabled}
              style={style}
              value={tt.cycle.weeks}
              onChange={(e) => {
                const weeks = Number(e.target.value) as 1 | 2 | 3 | 4
                setWeek(1)
                change({ ...tt, cycle: { ...tt.cycle, weeks } })
              }}
            >
              {[1, 2, 3, 4].map((w) => (
                <option value={w} key={w}>
                  {w} weeks
                </option>
              ))}
            </select>
          </label>
          <label>
            Week 1 starts (Monday)
            <input
              type="date"
              style={style}
              value={tt.cycle.anchor}
              disabled={disabled}
              onChange={(e) => {
                if (e.target.value)
                  change({
                    ...tt,
                    cycle: { ...tt.cycle, anchor: e.target.value },
                  })
              }}
            />
          </label>
          <Typography>
            {tt.stops.length} stops · {tt.visits.length} visits
          </Typography>
        </Flex>
        <Box paddingTop={4}>
          <Typography variant="delta">Stops</Typography>
          <table style={{ width: "100%", marginTop: 12 }}>
            <thead>
              <tr>
                {["Name", "Where", "Latitude", "Longitude", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tt.stops.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      aria-label={`Name for ${s.name}`}
                      disabled={disabled}
                      style={style}
                      value={s.name}
                      maxLength={80}
                      onChange={(e) => stop(s.id, { name: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Where for ${s.name}`}
                      disabled={disabled}
                      style={style}
                      value={s.where}
                      maxLength={140}
                      onChange={(e) => stop(s.id, { where: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Latitude for ${s.name}`}
                      disabled={disabled}
                      style={style}
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      value={s.location?.lat ?? ""}
                      onChange={(e) =>
                        stop(s.id, {
                          location: e.target.value
                            ? {
                                lat: Number(e.target.value),
                                lng: s.location?.lng ?? 0,
                              }
                            : null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`Longitude for ${s.name}`}
                      disabled={disabled}
                      style={style}
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      value={s.location?.lng ?? ""}
                      onChange={(e) =>
                        stop(s.id, {
                          location: e.target.value
                            ? {
                                lat: s.location?.lat ?? 0,
                                lng: Number(e.target.value),
                              }
                            : null,
                        })
                      }
                    />
                  </td>
                  <td>
                    <Button
                      disabled={disabled}
                      variant="danger-light"
                      onClick={() => {
                        if (
                          window.confirm(`Remove ${s.name} and all its visits?`)
                        )
                          change({
                            ...tt,
                            stops: tt.stops.filter((stop) => stop.id !== s.id),
                            visits: tt.visits.filter((v) => v.stopId !== s.id),
                          })
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Button
            disabled={disabled || tt.stops.length >= 300}
            onClick={() =>
              change({
                ...tt,
                stops: [
                  ...tt.stops,
                  {
                    id: newTimetableId(),
                    name: "New stop",
                    where: "",
                    location: null,
                    areaDocumentId: null,
                  },
                ],
              })
            }
          >
            Add stop
          </Button>
        </Box>
        <Box paddingTop={4}>
          <Typography variant="delta">Visits</Typography>
          <Flex gap={2} paddingTop={2}>
            {Array.from({ length: tt.cycle.weeks }, (_, i) => i + 1).map(
              (w) => (
                <Button
                  key={w}
                  variant={week === w ? "default" : "secondary"}
                  onClick={() => setWeek(w)}
                >
                  Week {w}
                </Button>
              )
            )}
          </Flex>
          {WEEKDAYS.map((day) => {
            const visits = tt.visits
              .filter(
                (v) =>
                  v.day === day &&
                  (v.repeat.kind !== "cycle" || v.repeat.weeks.includes(week))
              )
              .sort((a, b) => a.arrive.localeCompare(b.arrive))

            return visits.length ? (
              <Box key={day} paddingTop={3}>
                <Typography fontWeight="bold">{day.toUpperCase()}</Typography>
                {visits.map((v) => {
                  const options = repeatOptions(tt.cycle, v.day),
                    selected =
                      options.find(
                        (o) =>
                          JSON.stringify(o.repeat) === JSON.stringify(v.repeat)
                      )?.value ??
                      (v.repeat.kind === "dates" ? "dates" : "custom")

                  return (
                    <fieldset
                      key={v.id}
                      disabled={disabled}
                      style={{
                        padding: 12,
                        marginTop: 8,
                        border: "1px solid #dcdce4",
                      }}
                    >
                      <legend>
                        {tt.stops.find((s) => s.id === v.stopId)?.name}
                      </legend>
                      <Flex gap={3} wrap="wrap">
                        <label>
                          Stop
                          <select
                            style={style}
                            value={v.stopId}
                            onChange={(e) =>
                              visit(v.id, { stopId: e.target.value })
                            }
                          >
                            {tt.stops.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Day
                          <select
                            style={style}
                            value={v.day}
                            onChange={(e) =>
                              visit(v.id, { day: e.target.value as Weekday })
                            }
                          >
                            {WEEKDAYS.map((d) => (
                              <option key={d} value={d}>
                                {d}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Arrival
                          <input
                            type="time"
                            step={300}
                            style={style}
                            value={v.arrive}
                            onChange={(e) =>
                              visit(v.id, { arrive: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Departure
                          <input
                            type="time"
                            step={300}
                            style={style}
                            value={v.depart}
                            onChange={(e) =>
                              visit(v.id, { depart: e.target.value })
                            }
                          />
                        </label>
                        <label>
                          Repeat
                          <select
                            style={style}
                            value={selected}
                            onChange={(e) => {
                              const r = options.find(
                                (o) => o.value === e.target.value
                              )
                              if (r) visit(v.id, { repeat: r.repeat })
                            }}
                          >
                            {selected === "custom" && (
                              <option value="custom">
                                {describeRepeat(v, tt.cycle)}
                              </option>
                            )}
                            {options.map((o) => (
                              <option value={o.value} key={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Term time only
                          <input
                            type="checkbox"
                            checked={v.termTimeOnly}
                            onChange={(e) =>
                              visit(v.id, { termTimeOnly: e.target.checked })
                            }
                          />
                        </label>
                        <label>
                          From
                          <input
                            type="date"
                            style={style}
                            value={v.validFrom ?? ""}
                            onChange={(e) =>
                              visit(v.id, { validFrom: e.target.value || null })
                            }
                          />
                        </label>
                        <label>
                          Until
                          <input
                            type="date"
                            style={style}
                            value={v.validTo ?? ""}
                            onChange={(e) =>
                              visit(v.id, { validTo: e.target.value || null })
                            }
                          />
                        </label>
                        <Button
                          variant="danger-light"
                          onClick={() =>
                            change({
                              ...tt,
                              visits: tt.visits.filter(
                                (existing) => existing.id !== v.id
                              ),
                            })
                          }
                        >
                          Remove visit
                        </Button>
                      </Flex>
                      {v.repeat.kind === "dates" && (
                        <label>
                          Specific dates (comma separated)
                          <input
                            style={style}
                            value={v.repeat.dates.join(", ")}
                            onChange={(e) =>
                              visit(v.id, {
                                repeat: {
                                  kind: "dates",
                                  dates: e.target.value
                                    .split(",")
                                    .map((d) => d.trim())
                                    .filter(Boolean),
                                },
                              })
                            }
                          />
                        </label>
                      )}
                    </fieldset>
                  )
                })}
              </Box>
            ) : null
          })}
          <Button
            disabled={disabled || !tt.stops.length || tt.visits.length >= 600}
            onClick={() =>
              change({
                ...tt,
                visits: [
                  ...tt.visits,
                  {
                    id: newTimetableId(),
                    stopId: tt.stops[0]!.id,
                    day: "mon",
                    arrive: "09:00",
                    depart: "09:30",
                    repeat: { kind: "cycle", weeks: [week] },
                    termTimeOnly: false,
                    validFrom: null,
                    validTo: null,
                  },
                ],
              })
            }
          >
            Add visit
          </Button>
        </Box>
        {issues.length > 0 && (
          <Box paddingTop={4}>
            <Alert
              closeLabel="Dismiss"
              variant={hasErrors(issues) ? "danger" : "warning"}
              title={
                hasErrors(issues)
                  ? "Resolve before saving"
                  : "Check the timetable"
              }
            >
              <ul>
                {issues.map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
            </Alert>
          </Box>
        )}
        <Box paddingTop={4}>
          <Typography variant="delta">Import CSV</Typography>
          <p>
            Paste Stop, Day, Arrival and Departure columns. Optional: Where,
            Weeks, Dates, Latitude, Longitude.
          </p>
          <textarea
            aria-label="CSV to import"
            style={style}
            rows={5}
            value={paste}
            disabled={disabled}
            onChange={(e) => setPaste(e.target.value)}
          />
          {imported && (
            <>
              <p>{imported.imported} visits to import</p>
              {imported.errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
              <Button
                disabled={
                  disabled ||
                  !imported.imported ||
                  imported.errors.length > 0 ||
                  hasErrors(validateMobileTimetable(imported.timetable))
                }
                onClick={() => {
                  change(imported.timetable)
                  setPaste("")
                }}
              >
                Import visits
              </Button>
            </>
          )}
        </Box>
      </Box>
      <Field.Hint />
      <Field.Error />
    </Field.Root>
  )
}
