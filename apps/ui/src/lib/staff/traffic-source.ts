/**
 * Per-library traffic from GA4: the report shapes, the Data API requests
 * that scope a report to one library's public page, and the summary built
 * from the responses. Pure, so it's testable without Google; the network
 * side lives in `ga4-data-api.ts` and `traffic-report.ts`.
 */
import type { Ga4Report } from "./ga4-data-api"

export type TrafficRange = 7 | 30 | 90

export type TrafficKpiKey = "views" | "visitors" | "directions" | "catalogue"

export interface TrafficSummary {
  range: TrafficRange
  kpis: {
    key: TrafficKpiKey
    label: string
    value: number
    previous: number
    /** Change against the previous period in percent; null when it had none. */
    changePct: number | null
  }[]
  /** One point per complete day, oldest first, zeros included. */
  viewsPerDay: { date: string; value: number }[]
  /** Share of page views by channel, in percent, largest first. */
  referrers: { label: string; pct: number }[]
  /** The GA property's time zone, which defines the days. */
  timeZone: string
  /** The last complete day the report covers (yesterday, property time). */
  through: string
  /**
   * Google withheld or folded some rows (thresholding, sampling or the
   * "(other)" row), so figures may undercount.
   */
  incomplete: boolean
}

export type TrafficReport =
  | { status: "ready"; summary: TrafficSummary }
  /** No property or credential configured. */
  | { status: "unconfigured" }
  /** The library's public address couldn't be resolved. */
  | { status: "no-page" }
  | { status: "unavailable"; reason: "quota" | "error" }

export const TRAFFIC_RANGES: readonly TrafficRange[] = [7, 30, 90]

export function parseTrafficRange(value: unknown): TrafficRange {
  const n = Number(Array.isArray(value) ? value[0] : value)

  return (TRAFFIC_RANGES as readonly number[]).includes(n)
    ? (n as TrafficRange)
    : 30
}

/** The production hostname every collection tag requires. */
export const TRAFFIC_HOSTNAME = "libraries.global"

/**
 * Every address the library's page is served at: the unprefixed default
 * locale (`as-needed`) plus each locale prefix, including the default's,
 * which redirects but may still be recorded.
 */
export function libraryPagePaths(
  segments: readonly (string | null | undefined)[],
  locales: readonly string[]
): string[] | null {
  if (segments.length !== 4 || !segments.every(Boolean)) return null
  const path = `/${segments.join("/")}`

  return [path, ...locales.map((locale) => `/${locale}${path}`)]
}

const CURRENT = "current"
const PREVIOUS = "previous"

/** Complete property-time days: yesterday back `range` days, and the period before. */
function dateRanges(range: TrafficRange) {
  return [
    { name: CURRENT, startDate: `${range}daysAgo`, endDate: "yesterday" },
    {
      name: PREVIOUS,
      startDate: `${range * 2}daysAgo`,
      endDate: `${range + 1}daysAgo`,
    },
  ]
}

const pageFilter = (paths: readonly string[]) => [
  {
    filter: {
      fieldName: "hostName",
      stringFilter: { matchType: "EXACT", value: TRAFFIC_HOSTNAME },
    },
  },
  {
    filter: {
      fieldName: "pagePath",
      inListFilter: { values: [...paths], caseSensitive: true },
    },
  },
]

const ACTIONS = ["directions", "catalogue"] as const

/**
 * Four reports in one batch, every one filtered to the library's exact
 * paths on the production host (never the shared route pattern):
 * 0 totals for both periods, 1 views per day, 2 views by channel,
 * 3 directions and catalogue clicks for both periods. Visitors are the
 * period's unique `totalUsers`, never a sum of days or locales.
 */
export function trafficRequests(
  paths: readonly string[],
  range: TrafficRange
): Record<string, unknown>[] {
  const ranges = dateRanges(range)
  const [current] = ranges
  const scoped = { andGroup: { expressions: pageFilter(paths) } }

  return [
    {
      dateRanges: ranges,
      metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
      dimensionFilter: scoped,
    },
    {
      dateRanges: [current],
      dimensions: [{ name: "date" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: scoped,
      limit: 100,
    },
    {
      dateRanges: [current],
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "screenPageViews" }],
      dimensionFilter: scoped,
      orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      limit: 25,
    },
    {
      dateRanges: ranges,
      dimensions: [{ name: "customEvent:action_type" }],
      metrics: [{ name: "eventCount" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            ...pageFilter(paths),
            {
              filter: {
                fieldName: "eventName",
                stringFilter: { matchType: "EXACT", value: "library_action" },
              },
            },
            {
              filter: {
                fieldName: "customEvent:action_type",
                inListFilter: { values: [...ACTIONS] },
              },
            },
          ],
        },
      },
      limit: 10,
    },
  ]
}

type Row = NonNullable<Ga4Report["rows"]>[number]

const num = (value: string | undefined) => {
  const n = Number(value)

  return Number.isFinite(n) ? n : 0
}

/** Each row's dimension values by header name, and metric values by name. */
function readRows(report: Ga4Report | undefined) {
  const dims = (report?.dimensionHeaders ?? []).map((h) => h.name)
  const metrics = (report?.metricHeaders ?? []).map((h) => h.name)

  return (report?.rows ?? []).map((row: Row) => ({
    dim: (name: string) => {
      const i = dims.indexOf(name)

      return i === -1 ? undefined : row.dimensionValues?.[i]?.value
    },
    metric: (name: string) => {
      const i = metrics.indexOf(name)

      return i === -1 ? 0 : num(row.metricValues?.[i]?.value)
    },
  }))
}

/**
 * The period a two-range row belongs to. GA adds a `dateRange` dimension
 * holding the range's name; a report without one has only the current range.
 */
const periodOf = (row: ReturnType<typeof readRows>[number]) =>
  row.dim("dateRange") ?? CURRENT

const action = (type: string) => (row: ReturnType<typeof readRows>[number]) =>
  row.dim("customEvent:action_type") === type

const changePct = (value: number, previous: number) =>
  previous > 0 ? Math.round(((value - previous) / previous) * 100) : null

/** "YYYY-MM-DD" today in `timeZone`; UTC if the zone is unknown. */
function todayIn(timeZone: string, now: Date) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/** The `range` complete days before today in the property's zone, oldest first. */
export function reportDays(
  range: TrafficRange,
  timeZone: string,
  now: Date
): string[] {
  const today = Date.parse(`${todayIn(timeZone, now)}T00:00:00Z`)
  const day = 86_400_000

  return Array.from({ length: range }, (_, i) =>
    new Date(today - (range - i) * day).toISOString().slice(0, 10)
  )
}

const KPI_LABELS: Record<TrafficKpiKey, string> = {
  views: "Page views",
  visitors: "Visitors",
  directions: "Directions clicks",
  catalogue: "Catalogue clicks",
}

const TOP_CHANNELS = 5

function channelShares(report: Ga4Report | undefined) {
  const rows = readRows(report)
    .map((row) => ({
      label: row.dim("sessionDefaultChannelGroup") || "Unassigned",
      views: row.metric("screenPageViews"),
    }))
    .filter((row) => row.views > 0)
    .sort((a, b) => b.views - a.views)
  const total = rows.reduce((sum, row) => sum + row.views, 0)
  if (!total) return []
  const top = rows.slice(0, TOP_CHANNELS)
  const rest = rows.slice(TOP_CHANNELS).reduce((sum, r) => sum + r.views, 0)
  const shares = rest ? [...top, { label: "Other", views: rest }] : top

  return shares.map((row) => ({
    label: row.label,
    pct: Math.round((row.views / total) * 100),
  }))
}

const incompleteReport = (report: Ga4Report | undefined) =>
  Boolean(
    report?.metadata?.subjectToThresholding ||
    report?.metadata?.dataLossFromOtherRow ||
    report?.metadata?.samplingMetadatas?.length
  )

/** The summary from `trafficRequests`' four reports, in that order. */
export function summariseTraffic(
  reports: readonly Ga4Report[],
  range: TrafficRange,
  now: Date = new Date()
): TrafficSummary {
  const [totals, daily, channels, actions] = reports
  const timeZone =
    reports.find((r) => r.metadata?.timeZone)?.metadata?.timeZone ?? "UTC"

  const sum = (
    report: Ga4Report | undefined,
    metric: string,
    period: string,
    match?: (row: ReturnType<typeof readRows>[number]) => boolean
  ) =>
    readRows(report)
      .filter((row) => periodOf(row) === period && (!match || match(row)))
      .reduce((total, row) => total + row.metric(metric), 0)

  const values: Record<TrafficKpiKey, [number, number]> = {
    views: [
      sum(totals, "screenPageViews", CURRENT),
      sum(totals, "screenPageViews", PREVIOUS),
    ],
    visitors: [
      sum(totals, "totalUsers", CURRENT),
      sum(totals, "totalUsers", PREVIOUS),
    ],
    directions: [
      sum(actions, "eventCount", CURRENT, action("directions")),
      sum(actions, "eventCount", PREVIOUS, action("directions")),
    ],
    catalogue: [
      sum(actions, "eventCount", CURRENT, action("catalogue")),
      sum(actions, "eventCount", PREVIOUS, action("catalogue")),
    ],
  }

  const perDay = new Map<string, number>()
  for (const row of readRows(daily)) {
    const raw = row.dim("date") ?? ""
    const date = /^\d{8}$/.test(raw)
      ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`
      : raw
    perDay.set(date, (perDay.get(date) ?? 0) + row.metric("screenPageViews"))
  }
  const days = reportDays(range, timeZone, now)

  return {
    range,
    kpis: (Object.keys(KPI_LABELS) as TrafficKpiKey[]).map((key) => {
      const [value, previous] = values[key]

      return {
        key,
        label: KPI_LABELS[key],
        value,
        previous,
        changePct: changePct(value, previous),
      }
    }),
    viewsPerDay: days.map((date) => ({ date, value: perDay.get(date) ?? 0 })),
    referrers: channelShares(channels),
    timeZone,
    through: days.at(-1) ?? "",
    incomplete: reports.some(incompleteReport),
  }
}
