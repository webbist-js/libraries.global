export * from "./articles"
export * from "./community-palette"
export * from "./membership-links"

// ── Events ────────────────────────────────────────────────────────────────────

export interface EventsStats {
  totalEvents: number
  totalThisWeek: number
  totalThisMonth: number
  percentFree: number
  peakSlot: string | null
  peakCount: number
}

export interface ProviderStat {
  provider: string
  count: number
}

export interface CategoryStat {
  type: string
  count: number
}

export interface LibraryStat {
  entityRef: string
  name: string
  count: number
}

export interface HeatmapCell {
  dow: number
  hour: number
  count: number
}

export interface CountryStat {
  countryCode: string
  count: number
}

export interface DailyVolumeStat {
  date: string
  count: number
}

export interface FeaturedEvent {
  documentId: string
  title: string
  description?: string | null
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  timezone: string
  eventType: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  libraryEntityRef?: string | null
  libraryName?: string | null
  libraryCity?: string | null
  sourceProvider?: string | null
  tags?: string[] | null
}

export interface GridEvent {
  documentId: string
  title: string
  url: string
  imageUrl?: string | null
  startTime: string
  endTime?: string | null
  allDay: boolean
  timezone: string
  eventType: string
  sourceProvider: string
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  libraryName?: string | null
  librarySlug?: string | null
  status: string
}

export interface GlobalEventsResponse {
  events: GridEvent[]
  total: number
  page: number
  pageSize: number
}

export interface EventsProgrammeData {
  stats: EventsStats
  providers: ProviderStat[]
  categories: CategoryStat[]
  topLibraries: LibraryStat[]
  heatmap: HeatmapCell[]
  featured: FeaturedEvent[]
  countryBreakdown: CountryStat[]
  dailyVolume: DailyVolumeStat[]
}

// This value must be in sync with the fullPath of root page in the Strapi
export const ROOT_PAGE_PATH = "/"

/**
 * Join Strapi page path segments into a single normalized path (no duplicate slashes).
 * It always starts with ROOT_PAGE_PATH ("/"). Optionally, locale prefix can be added.
 *
 * Examples (input -> output):
 *   [""]                                   -> "/"
 *   [null, undefined]                      -> "/"
 *   ["/"]                                  -> "/"
 *   ["/", "//", "///"]                     -> "/"
 *   ["slug"]                               -> "/slug"
 *   ["/slug"]                              -> "/slug"
 *   ["/", "/slug"]                         -> "/slug"
 *   ["/parent", "slug"]                    -> "/parent/slug"
 *   ["/parent", "/slug"]                   -> "/parent/slug"
 *   ["/parent/", "/slug"]                  -> "/parent/slug"
 *   ["/parent/1", "/slug"]                 -> "/parent/1/slug"
 *   ["/parent/1", "slug"]                  -> "/parent/1/slug"
 *   ["parent/1", "slug"]                   -> "/parent/1/slug"
 *   ["/granparent/parent", "child/kid"]    -> "/granparent/parent/child/kid"
 *
 *   With locale:
 *   ["", ""], "en"                         -> "/en"
 *   ["/"], "en"                            -> "/en"
 *   ["", "slug"], "en"                     -> "/en/slug"
 *   ["/parent", "slug"], "en"              -> "/en/parent/slug"
 *   ["/en/parent", "slug"], "en"           -> "/en/parent/slug"
 */
export const normalizePageFullPath = (
  paths: (string | undefined | null)[],
  locale?: string | null
) => {
  const filteredPaths = paths.filter(Boolean) as string[]
  const fullPath = [ROOT_PAGE_PATH, ...filteredPaths]
    .join("/")
    .replaceAll(/\/+/g, "/")

  if (locale) {
    // make sure not to add same locale twice
    if (fullPath.startsWith(`/${locale}/`) || fullPath === `/${locale}`) {
      return fullPath
    }

    return `/${locale}${fullPath === "/" ? "" : fullPath}`
  }

  return fullPath
}

export * from "./facility-checklist"
export * from "./content-safety"
export * from "./localized-library-fields"
export * from "./locales"
export * from "./dismissible-prompts"
export * from "./gaps"
export * from "./verify"
export * from "./event-providers"
export * from "./drives"
export * from "./mobile-timetable"
export type * from "./opening-times-shape"
export * from "./staff-fields"
export * from "./decline-reasons"
export * from "./library-notices"
export type * from "./supporters"

export { CONTINENTS, CONTINENT_COUNTRIES, type Continent } from "./geography"
export * from "./atlas/contracts"
export * from "./atlas/cells"
export * from "./atlas/sort-keys"
export * from "./atlas/hours"
export * from "./atlas/projection"
export * from "./atlas/filters"
export * from "./atlas/requests"
export * from "./atlas/per-capita"
export * from "./population"

export * from "./atlas/library-access"
export * from "./atlas/geometry"
export * from "./atlas/reach"
export * from "./atlas/population-density"
export * from "./local-population"
export * from "./email"
export * from "./beta-email"
export * from "./notification-preferences"

export * from "./library-sources"
export * from "./library-entity-ref"

export * from "./opening-schedule"
export * from "./article-browse"

export * from "./moderation-presentation"

export * from "./profile-target"

export * from "./library-types"

export * from "./suggestion-review"
export * from "./telemetry"
export * from "./event-time"

export * from "./atlas/network-reach"
export * from "./atlas/reach-limits"

export * from "./atlas/reach-insights"

export * from "./atlas/library-density"

export * from "./widgets"

export * from "./networks"
