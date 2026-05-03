import type { EventProvider, ProviderKey } from "./types"

// Providers are registered here in Tasks 15 and 16.
// This file is intentionally minimal until those tasks complete.
const registry = new Map<ProviderKey, EventProvider>()

export function getProvider(key: ProviderKey): EventProvider | undefined {
  return registry.get(key)
}

export function registerProvider(provider: EventProvider): void {
  registry.set(provider.name, provider)
}

export default registry
