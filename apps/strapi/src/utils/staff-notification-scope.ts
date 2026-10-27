import { AsyncLocalStorage } from "node:async_hooks"

// Core and plugin bundles share the same scope during a service call.
const key = Symbol.for("libraries-global.grouped-staff-changes")
const registry = globalThis as typeof globalThis & {
  [key]?: AsyncLocalStorage<boolean>
}
const context =
  registry[key] ?? (registry[key] = new AsyncLocalStorage<boolean>())

export const withGroupedStaffChanges = <T>(work: () => Promise<T>) =>
  context.run(true, work)
export const groupedStaffChanges = () => context.getStore() === true
