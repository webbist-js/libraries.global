export interface EventsStats {
  totalEvents: number
  totalThisWeek: number
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
  sourceProvider?: string | null
  tags?: string[] | null
}

export interface EventsProgrammeData {
  stats: EventsStats
  providers: ProviderStat[]
  categories: CategoryStat[]
  topLibraries: LibraryStat[]
  heatmap: HeatmapCell[]
  featured: FeaturedEvent | null
}
