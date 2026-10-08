export type SupporterEntry = {
  username: string
  displayName: string
  initials: string
  city: string | null
  country: string | null
  since: string | null
}

export type SupporterCosts = {
  month: string
  currency: string
  runningCosts: number
  supportIncome: number | null
  breakdown: string | null
}

export type SupportersResponse = {
  entries: SupporterEntry[]
  newThisMonth: SupporterEntry[]
  total: number
  listed: number
  unlisted: number
  countries: string[]
  matched: number
  page: number
  pageSize: number
  costs: SupporterCosts | null
  title: string | null
  lead: string | null
}
