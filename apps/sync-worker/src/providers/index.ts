import { eventbriteProvider } from "./eventbrite"
import { icalProvider } from "./ical"
import type { EventProvider, ProviderKey } from "./types"

const registry = new Map<ProviderKey, EventProvider>([
  [eventbriteProvider.name, eventbriteProvider],
  [icalProvider.name, icalProvider],
])

export function getProvider(key: ProviderKey): EventProvider | undefined {
  return registry.get(key)
}

export function registerProvider(provider: EventProvider): void {
  registry.set(provider.name, provider)
}

export default registry
