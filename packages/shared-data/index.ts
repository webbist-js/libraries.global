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
