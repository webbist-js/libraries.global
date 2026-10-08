import "server-only"

/**
 * Where a library's traffic numbers come from. The Team plan's Traffic tab
 * reads through this interface, so the analytics provider can land later
 * without touching the page: today `TRAFFIC_SOURCE=sample` (the default)
 * answers with deterministic illustrative numbers, and `vercel` is a stub.
 */
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

/** A small deterministic generator, so the same library always shows the same sample. */
function seeded(seed: string) {
  let h = 2166136261
  for (const ch of seed) {
    h ^= ch.codePointAt(0) ?? 0
    h = Math.imul(h, 16777619)
  }

  return () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5

    return ((h >>> 0) % 10_000) / 10_000
  }
}

const isoDay = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)

export class SampleTrafficSource implements TrafficSource {
  async getSummary(
    libraryDocumentId: string,
    range: TrafficRange
  ): Promise<TrafficSummary> {
    const random = seeded(`${libraryDocumentId}:${range}`)
    const base = 18 + Math.round(random() * 40)
    const viewsPerDay = Array.from({ length: range }, (_, i) => {
      const weekday = new Date(isoDay(range - 1 - i)).getUTCDay()
      const weekend = weekday === 0 || weekday === 6

      return {
        date: isoDay(range - 1 - i),
        value: Math.round(base * (weekend ? 0.55 : 1) * (0.7 + random() * 0.6)),
      }
    })
    const views = viewsPerDay.reduce((sum, p) => sum + p.value, 0)
    const visitors = Math.round(views * (0.58 + random() * 0.1))
    const directions = Math.round(views * (0.06 + random() * 0.03))
    const catalogue = Math.round(views * (0.03 + random() * 0.02))
    const pct = () => Math.round((random() - 0.35) * 40)

    return {
      range,
      sample: true,
      kpis: [
        { key: "views", label: "Page views", value: views, changePct: pct() },
        {
          key: "visitors",
          label: "Visitors",
          value: visitors,
          changePct: pct(),
        },
        {
          key: "directions",
          label: "Directions clicks",
          value: directions,
          changePct: pct(),
        },
        {
          key: "catalogue",
          label: "Catalogue clicks",
          value: catalogue,
          changePct: pct(),
        },
      ],
      viewsPerDay,
      referrers: [
        { label: "Search engines", pct: 62 },
        { label: "Direct", pct: 24 },
        { label: "Other websites", pct: 9 },
        { label: "Social media", pct: 5 },
      ],
      searches: [
        {
          query: "library opening hours",
          count: 14 + Math.round(random() * 30),
        },
        { query: "library near me", count: 9 + Math.round(random() * 20) },
        { query: "accessible library", count: 4 + Math.round(random() * 10) },
        { query: "library wifi", count: 2 + Math.round(random() * 8) },
      ],
    }
  }
}

/** Reserved for the Vercel analytics source; not configured yet. */
export class VercelTrafficSource implements TrafficSource {
  async getSummary(): Promise<TrafficSummary> {
    throw new Error("not_configured")
  }
}

/** The configured source, from `TRAFFIC_SOURCE` (server-side only). */
export function trafficSource(): TrafficSource {
  return process.env.TRAFFIC_SOURCE === "vercel"
    ? new VercelTrafficSource()
    : new SampleTrafficSource()
}
