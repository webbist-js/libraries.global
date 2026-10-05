import type { EventProviderKey } from "@repo/shared-data"

import { aspenProvider } from "./providers/aspen"
import { eventbriteProvider } from "./providers/eventbrite"
import { icalProvider } from "./providers/ical"
import { solusProvider } from "./providers/solus"
import { spydusProvider } from "./providers/spydus"
import { ticketsourceProvider } from "./providers/ticketsource"
import { wegottickets as wegotticketsProvider } from "./providers/wegottickets"
import type { EventProvider } from "./types"

const ALL: EventProvider[] = [
  aspenProvider,
  eventbriteProvider,
  icalProvider,
  solusProvider,
  spydusProvider,
  ticketsourceProvider,
  wegotticketsProvider,
]

const registry = new Map<EventProviderKey, EventProvider>(
  ALL.map((p) => [p.name, p])
)

export const providerRegistry: ReadonlyMap<EventProviderKey, EventProvider> =
  registry

export function getProvider(key: string): EventProvider | undefined {
  return registry.get(key as EventProviderKey)
}

/** Tests only: replace one provider. */
export function __setProviderForTest(p: EventProvider): void {
  registry.set(p.name, p)
}
/** Tests only: restore the real providers. */
export function __resetProvidersForTest(): void {
  registry.clear()
  for (const p of ALL) registry.set(p.name, p)
}
