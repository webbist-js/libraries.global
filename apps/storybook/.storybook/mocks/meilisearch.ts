// Preserve real SDK clients and search transforms; only these server homepage
// aggregate readers cross Storybook's stable, explicit fixture transport.
import type {
  fetchGlobeMarkers as sourceGlobeMarkers,
  fetchUpcomingEvents as sourceUpcomingEvents,
} from "../../../ui/src/lib/meilisearch"
import { readServerFixture } from "../server-fixtures"

export * from "../../../ui/src/lib/meilisearch"

export function fetchUpcomingEvents(
  ...args: Parameters<typeof sourceUpcomingEvents>
) {
  return readServerFixture("search.fetchUpcomingEvents", args)
}

export function fetchGlobeMarkers(
  ...args: Parameters<typeof sourceGlobeMarkers>
) {
  return readServerFixture("search.fetchGlobeMarkers", args)
}
