import { T } from "@/lib/design-tokens"

import { humanise, type RecordReview, renderValue } from "./submissionMeta"

/** Keys in `fields` that describe the submission, not library fields. */
const META_KEYS = new Set([
  "kind",
  "previous",
  "category",
  "libraryName",
  "suggestedOptions",
])

const RELATIONS = new Set(["accessibility", "amenities", "services"])

const DAY_SHORT: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
}

type Day = {
  day?: string
  enabled?: boolean
  timeframes?: { startTime?: string; endTime?: string; staffing?: string }[]
}

/** One line per day, e.g. "Mon 09:00–13:00, 14:00–17:00 (volunteer)". */
export function hoursLines(v: unknown): string[] | null {
  const days = (v as { days?: Day[] } | null)?.days
  if (!Array.isArray(days)) return null

  return days.map((d) => {
    const label = DAY_SHORT[d.day ?? ""] ?? d.day ?? "?"
    const frames = d.enabled ? (d.timeframes ?? []) : []
    if (frames.length === 0) return `${label} closed`

    return `${label} ${frames
      .map(
        (t) =>
          `${t.startTime}–${t.endTime}${t.staffing && t.staffing !== "staffed" ? ` (${t.staffing.replace("_", " ")})` : ""}`
      )
      .join(", ")}`
  })
}

const isReview = (v: unknown): v is RecordReview =>
  !!v &&
  typeof v === "object" &&
  typeof (v as RecordReview).current === "object" &&
  (v as RecordReview).current !== null

function Lines({
  lines,
  color,
  strike,
}: {
  lines: string[]
  color: string
  strike?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => (
        <span
          key={i}
          style={{
            color,
            wordBreak: "break-word",
            textDecoration: strike ? "line-through" : "none",
          }}
        >
          {line}
        </span>
      ))}
    </div>
  )
}

const cell = "px-4 py-3 align-top text-left text-[14px]"

/**
 * A record edit (a claimant's `library_edit` or a `correction` with
 * `fields.kind: "record"`) as Field / Current / Proposed. Current comes from
 * the library itself (`review.current`, loaded by Strapi), never from the
 * contributor; only without it does the table fall back to the
 * contributor's `previous` copy, and says so.
 */
export function RecordChangesTable({
  submissionType,
  fields: rawFields,
  review: rawReview,
}: {
  readonly submissionType: string
  readonly fields: unknown
  readonly review: unknown
}) {
  const fields = (
    rawFields && typeof rawFields === "object" ? rawFields : {}
  ) as Record<string, unknown>
  const review = isReview(rawReview) ? rawReview : null
  const current = review?.current
  const previous = (fields.previous ?? {}) as Record<string, unknown>
  const names = review?.names ?? {}
  const nameOf = (id: unknown) =>
    typeof id === "string" ? (names[id] ?? `Unknown option (${id})`) : "?"
  const changes = Object.entries(fields).filter(([k]) => !META_KEYS.has(k))
  const suggested = Object.entries(
    (fields.suggestedOptions ?? {}) as Record<string, unknown>
  ).filter(([, v]) => Array.isArray(v) && v.length > 0) as [string, string[]][]

  if (changes.length === 0 && suggested.length === 0)
    return (
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        No field changes in this submission.
      </p>
    )

  const before = (key: string): string[] => {
    const source = current ?? previous
    if (!(key in source)) return ["—"]
    const v = source[key]
    if (RELATIONS.has(key))
      return Array.isArray(v) && v.length
        ? [v.map(nameOf).join(", ")]
        : ["None"]

    return hoursLines(v) ?? [renderValue(v).text]
  }

  const after = (key: string, v: unknown): string[] => {
    if (RELATIONS.has(key)) {
      if (Array.isArray(v))
        return [v.length ? v.map(nameOf).join(", ") : "None"]
      const { connect, disconnect } = (v ?? {}) as Record<string, unknown>

      return [
        ...(Array.isArray(connect)
          ? connect.map((id) => `+ Add ${nameOf(id)}`)
          : []),
        ...(Array.isArray(disconnect)
          ? disconnect.map((id) => `− Remove ${nameOf(id)}`)
          : []),
      ]
    }

    return hoursLines(v) ?? [renderValue(v).text]
  }

  const count = changes.length + suggested.length
  const from =
    submissionType === "correction"
      ? "from a contributor without a claim"
      : "from a claimant"

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-[14px] px-4 py-3 text-[14px] leading-[1.55]"
        style={{
          background: T.bg.surface,
          border: `1px solid ${T.border.line}`,
          color: T.ink.dim,
        }}
      >
        <p className="m-0 font-semibold" style={{ color: T.ink.base }}>
          {`${count} change${count === 1 ? "" : "s"} · ${from}${typeof fields.category === "string" ? ` · ${fields.category}` : ""}`}
        </p>
        <p className="m-0 mt-1">
          Approving writes the proposed values to the library record and
          publishes it. Fields not listed here are left as they are.
          {suggested.length > 0
            ? " A suggested name that matches an existing option is linked. A new one goes to the editorial board’s monthly review."
            : ""}
          {current ? "" : " The current values shown are the contributor’s."}
        </p>
      </div>
      <div
        className="overflow-x-auto rounded-[14px]"
        style={{ border: `1px solid ${T.border.line}`, background: T.bg.deep }}
      >
        <table className="w-full border-collapse">
          <caption className="sr-only">Proposed changes to the record</caption>
          <thead>
            <tr style={{ background: T.bg.surface }}>
              {["Field", "Current", "Proposed"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className={`${cell} font-semibold`}
                  style={{ color: T.ink.dim }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {changes.map(([key, value]) => {
              const was = before(key)

              return (
                <tr
                  key={key}
                  style={{ borderTop: `1px solid ${T.border.divider}` }}
                >
                  <th
                    scope="row"
                    className={`${cell} font-semibold`}
                    style={{ color: T.ink.base }}
                  >
                    {humanise(key)}
                  </th>
                  <td className={cell}>
                    <Lines
                      lines={was}
                      color={T.ink.dim}
                      strike={!RELATIONS.has(key) && was[0] !== "—"}
                    />
                  </td>
                  <td className={cell}>
                    <Lines lines={after(key, value)} color={T.accent.ok} />
                  </td>
                </tr>
              )
            })}
            {suggested.map(([key, list]) => (
              <tr
                key={`new-${key}`}
                style={{ borderTop: `1px solid ${T.border.divider}` }}
              >
                <th
                  scope="row"
                  className={`${cell} font-semibold`}
                  style={{ color: T.ink.base }}
                >
                  {`New ${humanise(key).toLowerCase()} option`}
                </th>
                <td className={cell} style={{ color: T.ink.dim }}>
                  Not in the list yet
                </td>
                <td className={cell}>
                  <Lines lines={list} color={T.accent.ok} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
