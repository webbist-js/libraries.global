// Re-exported from @repo/shared-data — edit types there, not here.
export type {
  EventsStats,
  ProviderStat,
  CategoryStat,
  LibraryStat,
  HeatmapCell,
  CountryStat,
  DailyVolumeStat,
  FeaturedEvent,
  GridEvent,
  GlobalEventsResponse,
  EventsProgrammeData,
} from "@repo/shared-data"

// ── Events browse filter state (moved from the retired EventsFilterBar) ───────

export type DateScope = "today" | "tomorrow" | "this-week" | "this-month"
export type PriceScope = "all" | "free" | "paid"
export type TimeOfDay = "morning" | "afternoon" | "evening" | "night"

export interface FilterState {
  dateScope: DateScope
  priceScope: PriceScope
  eventTypes: string[] // multi-select; empty = all types
  search: string
  timeOfDay: TimeOfDay[]
  countryCode: string
  regionSlug: string
  calendarDate?: string // ISO date string (YYYY-MM-DD); when set, overrides dateScope to single day
  page: number
}
