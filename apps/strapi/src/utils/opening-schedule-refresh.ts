import { withLeaderLock } from "./leader-lock"
import { refreshNoticeEffects } from "./library-notices"

const OPENING_SCHEDULE_LOCK = 7_420_102

/** Refresh only due projections. The search guard hides stale opening claims while the bounded queue drains. */
export async function refreshDueOpeningSchedules(
  strapi: any,
  now = new Date()
): Promise<number> {
  const raw = strapi.config?.get?.("plugin::meilisearch") ?? {}
  const config = raw.config ?? raw
  const host = config.host ?? process.env.MEILISEARCH_HOST
  const key =
    config.apiKey ??
    process.env.MEILISEARCH_ADMIN_API_KEY ??
    process.env.MEILISEARCH_MASTER_KEY
  if (!host || !key) return 0
  const outcome = await withLeaderLock(
    strapi,
    OPENING_SCHEDULE_LOCK,
    async () => {
      const response = await fetch(new URL("/indexes/library/search", host), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filter: `locale = "en" AND clock_valid_until_ts > 0 AND clock_valid_until_ts <= ${Math.floor(now.getTime() / 1000)}`,
          limit: 100,
          attributesToRetrieve: ["documentId"],
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok)
        throw new Error(`Opening schedule queue returned ${response.status}`)
      const data = (await response.json()) as {
        hits?: { documentId?: string }[]
      }
      const ids = [
        ...new Set(
          (data.hits ?? []).flatMap((hit) =>
            hit.documentId ? [hit.documentId] : []
          )
        ),
      ]
      for (const id of ids) await refreshNoticeEffects(strapi, id)

      return ids.length
    }
  )

  return outcome.ran ? outcome.result : 0
}
