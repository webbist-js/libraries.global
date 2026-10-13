/** Refresh search settings and published library projections in bounded batches.
 * Does not delete the index or write CMS records. Optional --country/--region
 * slugs restrict a label backfill to the affected place.
 * Run with: pnpm --filter @repo/strapi exec tsx scripts/refresh-library-projections.ts
 * Add --settings-only to apply filter/display settings without rewriting documents.
 */
import type { LibraryNotice } from "@repo/shared-data"

import {
  attachMobileTimetables,
  entriesQueryParams,
  meilisearchId,
  readEnvFile,
  seededIndexes,
} from "./seed-meilisearch"

export async function refreshLibraryProjections() {
  const settingsOnly = process.argv.includes("--settings-only")
  const env = { ...readEnvFile(), ...process.env }
  const cms = env.STRAPI_URL ?? "http://127.0.0.1:1337"
  const host = env.MEILISEARCH_HOST ?? "http://localhost:7701"
  const token = env.STRAPI_API_TOKEN
  const key = env.MEILISEARCH_ADMIN_API_KEY ?? env.MEILISEARCH_MASTER_KEY
  if (!key || (!settingsOnly && !token))
    throw new Error("CMS and search credentials are required")
  const index = seededIndexes().find((item) => item.name === "library")!
  const request = async (
    base: string,
    pathname: string,
    credential: string,
    method = "GET",
    body?: unknown
  ) => {
    const response = await fetch(`${base}${pathname}`, {
      method,
      headers: {
        Authorization: `Bearer ${credential}`,
        "Content-Type": "application/json",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(60_000),
    })
    if (!response.ok)
      throw new Error(
        `${method} ${pathname.split("?")[0]} returned ${response.status}`
      )

    return response.json()
  }
  const wait = async (taskUid: number) => {
    const deadline = Date.now() + 120_000
    while (Date.now() < deadline) {
      const task = await request(host, `/tasks/${taskUid}`, key)
      if (task.status === "succeeded") return
      if (task.status === "failed" || task.status === "canceled")
        throw new Error(`Search task ${taskUid} ${task.status}`)
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    throw new Error(`Search task ${taskUid} timed out`)
  }
  const settings = await request(
    host,
    "/indexes/library/settings",
    key,
    "PATCH",
    index.settings
  )
  await wait(settings.taskUid)
  console.log("Library search settings applied")
  if (settingsOnly) return
  let after = 0
  let total = 0
  for (;;) {
    const params = entriesQueryParams(index.entriesQuery, 1, 100)
    params.set("pagination[withCount]", "false")
    params.set("sort", "id:asc")
    if (after) params.set("filters[id][$gt]", String(after))
    for (const relation of ["country", "region"] as const) {
      const option = process.argv.indexOf(`--${relation}`)
      if (option !== -1) {
        const slug = process.argv[option + 1]
        if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
          throw new Error(`Invalid --${relation} slug`)
        params.set(`filters[${relation}][slug][$eq]`, slug)
      }
    }
    const { data: entries = [] } = await request(
      cms,
      `/api/libraries?${params}`,
      token!
    )
    if (!entries.length) break
    await attachMobileTimetables(entries, (pathname) =>
      request(cms, pathname, token!)
    )
    const ids = [
      ...new Set(entries.map((entry: any) => String(entry.documentId))),
    ]
    const notices = await request(
      cms,
      `/api/library-notices/for-libraries?ids=${encodeURIComponent(ids.join(","))}`,
      token!
    )
    const documents = await Promise.all(
      entries.map(async (entry: any) => ({
        ...(await index.transformEntry({
          entry,
          notices: (notices.data?.[entry.documentId] ?? []) as LibraryNotice[],
        })),
        _meilisearch_id: meilisearchId("library", entry),
      }))
    )
    const task = await request(
      host,
      "/indexes/library/documents?primaryKey=_meilisearch_id",
      key,
      "PUT",
      documents
    )
    await wait(task.taskUid)
    total += entries.length
    console.log(`Refreshed ${total} published library projections`)
    const next = Number(entries.at(-1)?.id)
    if (entries.length < 100) break
    if (!Number.isFinite(next) || next <= after)
      throw new Error("CMS did not supply an advancing library cursor")
    after = next
  }
}

if (process.argv[1]?.endsWith("refresh-library-projections.ts"))
  refreshLibraryProjections().catch((error: unknown) => {
    console.error(
      error instanceof Error
        ? error.message
        : "Library projection refresh failed"
    )
    process.exitCode = 1
  })
