import type { EventSearchParams } from "@/lib/meilisearch"

import {
  DEFAULT_EVENTS_FILTERS,
  type EventsFilters,
  type WhenScope,
  type TimeSlot,
} from "./event-display"

export const EVENTS_PAGE_SIZE = 30
const WHEN = new Set<WhenScope>(["any", "today", "weekend", "7d", "30d"])
const TIMES = new Set<TimeSlot>(["morning", "afternoon", "evening", "allday"])

export function readEventBrowse(query: URLSearchParams) {
  return {
    filters: {
      search: (query.get("q") ?? "").slice(0, 200),
      when: WHEN.has(query.get("when") as WhenScope)
        ? (query.get("when") as WhenScope)
        : "any",
      types: [
        ...new Set(
          (query.get("type") ?? "")
            .split(",")
            .filter((v) => /^[a-z_]{1,30}$/.test(v))
        ),
      ],
      times: [
        ...new Set(
          (query.get("time") ?? "")
            .split(",")
            .filter((v): v is TimeSlot => TIMES.has(v as TimeSlot))
        ),
      ],
      freeOnly: query.get("free") === "1",
    } satisfies EventsFilters,
    page: Math.min(
      3334,
      Math.max(1, Math.trunc(Number(query.get("page"))) || 1)
    ),
  }
}
export function writeEventBrowse(
  query: URLSearchParams,
  filters: EventsFilters,
  page: number
) {
  const values = {
    q: filters.search,
    when: filters.when === "any" ? "" : filters.when,
    type: filters.types.join(","),
    time: filters.times.join(","),
    free: filters.freeOnly ? "1" : "",
    page: page > 1 ? String(page) : "",
  }
  for (const [key, value] of Object.entries(values))
    if (value) query.set(key, value)
    else query.delete(key)

  return query.toString()
}
export function eventSearchParams(
  filters: EventsFilters,
  page: number,
  now: Date
): EventSearchParams {
  const from = new Date(now)
  const to = new Date(now)
  if (filters.when === "weekend") {
    if (now.getDay() >= 1 && now.getDay() <= 5) {
      from.setDate(from.getDate() + 6 - from.getDay())
      from.setHours(0, 0, 0, 0)
    }
    to.setTime(from.getTime())
    if (to.getDay() === 6) to.setDate(to.getDate() + 1)
  } else if (filters.when === "7d" || filters.when === "30d")
    to.setDate(to.getDate() + (filters.when === "7d" ? 7 : 30))
  to.setHours(23, 59, 59, 999)

  return {
    query: filters.search,
    eventTypes: filters.types,
    timeSlots: filters.times,
    isFree: filters.freeOnly ? true : undefined,
    statuses: ["upcoming", "ongoing"],
    fromTimestamp: Math.floor(from.getTime() / 1000),
    toTimestamp:
      filters.when === DEFAULT_EVENTS_FILTERS.when
        ? undefined
        : Math.floor(to.getTime() / 1000),
    page: page - 1,
    hitsPerPage: EVENTS_PAGE_SIZE,
  }
}
