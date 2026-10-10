/** Types for a future real per-library traffic report. No sample source. */
export type TrafficRange = 7 | 30 | 90

export interface TrafficSummary {
  range: TrafficRange
  /** True for illustrative numbers: the page says so. */
  sample: boolean
  kpis: {
    key: "views" | "visitors" | "directions" | "catalogue"
    label: string
    value: number
    /** Change against the previous period, in percent. */
    changePct: number
  }[]
  /** One point per day, oldest first. */
  viewsPerDay: { date: string; value: number }[]
  /** Share of visits by origin, in percent, largest first. */
  referrers: { label: string; pct: number }[]
  /** The searches that led to the page, most common first. */
  searches: { query: string; count: number }[]
}

export interface TrafficSource {
  getSummary: (
    libraryDocumentId: string,
    range: TrafficRange
  ) => Promise<TrafficSummary>
}

export const TRAFFIC_RANGES: readonly TrafficRange[] = [7, 30, 90]

export function parseTrafficRange(value: unknown): TrafficRange {
  const n = Number(Array.isArray(value) ? value[0] : value)

  return (TRAFFIC_RANGES as readonly number[]).includes(n)
    ? (n as TrafficRange)
    : 30
}
