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
  registrationUrl?: string | null
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
  isFree: boolean
  priceMin?: number | null
  priceMax?: number | null
  registrationUrl?: string | null
  libraryEntityRef?: string | null
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
