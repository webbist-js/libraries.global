import type { Core } from "@strapi/strapi"

import { withLeaderLock } from "./leader-lock"

const EVENT = "plugin::events.event"
const LOCK = 7_420_108
const BATCH = 200

/** Reconciles raw worker writes, which do not fire Document Service lifecycles.
 * A durable watermark advances only after Meilisearch has accepted every task.
 * Restarting or retrying repeats idempotent updates, including pending-row deletions.
 */
export async function refreshEventSearch(
  strapi: Core.Strapi,
  fetchImpl: typeof fetch = fetch
) {
  const plugin = strapi.plugin("meilisearch")
  if (!plugin) return
  const { host, apiKey } = await plugin.service("store").getCredentials()
  if (!host || !apiKey) return

  return withLeaderLock(strapi, LOCK, async () => {
    const store = strapi.store({
      type: "plugin",
      name: "events",
      key: "search-projection-v3",
    })
    const saved = await store.get()
    const previous =
      saved &&
      typeof saved === "object" &&
      "through" in saved &&
      typeof saved.through === "string"
        ? saved.through
        : "1970-01-01T00:00:00.000Z"
    const through = new Date().toISOString()
    const config = strapi.config.get<{
      event: { settings: unknown; entriesQuery: Record<string, unknown> }
    }>("plugin::meilisearch").event
    const call = async (pathname: string, method = "GET", body?: unknown) => {
      const response = await fetchImpl(new URL(pathname, host), {
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(10000),
      })
      if (!response.ok)
        throw new Error(
          `Event search ${method} ${pathname.split("?")[0]} returned ${response.status}`
        )
      const data = await response.json()
      if (!data || typeof data !== "object" || Array.isArray(data))
        throw new Error("Invalid event search response")

      return data as Record<string, unknown>
    }
    const wait = async (taskUid: unknown) => {
      if (typeof taskUid !== "number" || !Number.isSafeInteger(taskUid))
        throw new Error("Invalid event search task")
      const deadline = Date.now() + 30000
      while (Date.now() < deadline) {
        const task = await call(`/tasks/${taskUid}`)
        if (task.status === "succeeded") return
        if (task.status === "failed" || task.status === "canceled")
          throw new Error(`Event search task ${taskUid} failed`)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error(`Event search task ${taskUid} timed out`)
    }
    const existing = await fetchImpl(new URL("/indexes/event", host), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    })
    if (existing.status === 404) {
      const task = await call("/indexes", "POST", {
        uid: "event",
        primaryKey: "_meilisearch_id",
      })
      await wait(task.taskUid)
    } else if (!existing.ok)
      throw new Error(`Event index lookup returned ${existing.status}`)
    const settings = await call(
      "/indexes/event/settings",
      "PATCH",
      config.settings
    )
    await wait(settings.taskUid)
    let after = 0
    let count = 0
    for (;;) {
      const entries = await strapi.documents(EVENT).findMany({
        ...config.entriesQuery,
        filters: {
          id: { $gt: after },
          updatedAt: { $gte: previous, $lte: through },
        },
        sort: ["id:asc"],
        limit: BATCH,
      })
      if (!entries.length) break
      const tasks = await plugin
        .service("meilisearch")
        .updateEntriesInMeilisearch({ contentType: EVENT, entries })
      for (const task of tasks) await wait(task.taskUid)
      count += entries.length
      const next = Number(entries.at(-1).id)
      if (!Number.isSafeInteger(next) || next <= after)
        throw new Error("Event search cursor did not advance")
      after = next
      if (entries.length < BATCH) break
    }
    await store.set({ value: { through } })

    return count
  })
}
