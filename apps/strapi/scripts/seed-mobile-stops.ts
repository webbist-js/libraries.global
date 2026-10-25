/** Rebuild mobile stops from the running public API, a page of vehicles at a time. */
import {
  localDateTime,
  normalizeMobileTimetable,
  type TimetableNotice,
} from "@repo/shared-data"

import { readEnvFile } from "./seed-meilisearch"
import {
  mobileStopDocuments,
  MOBILE_STOP_INDEX,
  MOBILE_STOP_SETTINGS,
} from "../src/utils/mobile-stop-index"

export async function seedMobileStops() {
  const env = { ...readEnvFile(), ...process.env },
    base = env.STRAPI_URL ?? "http://127.0.0.1:1337",
    host = env.MEILISEARCH_HOST ?? "http://localhost:7701"
  if (!env.STRAPI_API_TOKEN || !env.MEILISEARCH_MASTER_KEY)
    throw new Error(
      "Set STRAPI_API_TOKEN and MEILISEARCH_MASTER_KEY before rebuilding mobile stops."
    )
  const get = async (path: string) => {
    const response = await fetch(new URL(path, base), {
      headers: { Authorization: `Bearer ${env.STRAPI_API_TOKEN}` },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`Strapi returned ${response.status}`)

    return response.json()
  }
  const meili = async (path: string, method: string, body?: unknown) => {
    const response = await fetch(new URL(path, host), {
      method,
      headers: {
        Authorization: `Bearer ${env.MEILISEARCH_MASTER_KEY}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) throw new Error(`Meilisearch returned ${response.status}`)

    return response.json()
  }
  const wait = async (taskUid: number) => {
    for (;;) {
      const task = await meili(`/tasks/${taskUid}`, "GET")
      if (task.status === "succeeded") return
      if (task.status === "failed" || task.status === "canceled")
        throw new Error(
          `Mobile stop task failed: ${task.error?.code ?? task.status}`
        )
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  await wait(
    (
      await meili("/indexes", "POST", {
        uid: MOBILE_STOP_INDEX,
        primaryKey: "id",
      })
    ).taskUid
  ).catch(async () => {
    await meili(`/indexes/${MOBILE_STOP_INDEX}`, "GET")
  })
  await wait(
    (await meili(`/indexes/${MOBILE_STOP_INDEX}/documents`, "DELETE")).taskUid
  )
  await wait(
    (
      await meili(
        `/indexes/${MOBILE_STOP_INDEX}/settings`,
        "PATCH",
        MOBILE_STOP_SETTINGS
      )
    ).taskUid
  )
  let count = 0
  for (let page = 1; ; page++) {
    const query = new URLSearchParams({
      "filters[libraryType][name][$eq]": "Mobile",
      status: "published",
      "pagination[page]": String(page),
      "pagination[pageSize]": "50",
    })
    for (const [i, field] of [
      "name",
      "slug",
      "libraryType",
      "operationalStatus",
      "timezone",
    ].entries())
      query.set(`fields[${i}]`, field)
    for (const relation of ["continent", "country", "region"])
      query.set(`populate[${relation}][fields][0]`, "slug")
    query.set("populate[networks][fields][0]", "documentId")
    const result = await get(`/api/libraries?${query}`),
      rows = result.data ?? []
    // The list shape leaves the timetable out (1.8); read each vehicle's
    // from its timetable route.
    for (const library of rows)
      library.mobileTimetable =
        (
          await get(`/api/mobile/${library.documentId}/timetable`).catch(
            () => null
          )
        )?.timetable ?? null
    const live = rows.length
      ? await get(
          `/api/mobile-libraries/live?ids=${rows.map((r: any) => r.documentId).join(",")}`
        ).catch(() => ({ states: [] }))
      : { states: [] }
    for (const library of rows) {
      const tt = normalizeMobileTimetable(library.mobileTimetable),
        areaIds = [
          ...new Set(
            tt?.stops.flatMap((stop) =>
              stop.areaDocumentId ? [stop.areaDocumentId] : []
            )
          ),
        ]
      const areas = new Map<string, { slug: string; name: string }>()
      for (let offset = 0; offset < areaIds.length; offset += 100) {
        const params = new URLSearchParams({
          status: "published",
          "fields[0]": "name",
          "fields[1]": "slug",
          "pagination[pageSize]": "100",
        })
        areaIds
          .slice(offset, offset + 100)
          .forEach((id, i) => params.set(`filters[documentId][$in][${i}]`, id))
        for (const area of (await get(`/api/areas?${params}`)).data ?? [])
          areas.set(area.documentId, { slug: area.slug, name: area.name })
      }
      const notices: TimetableNotice[] =
        (await get(`/api/library-notices/for-library/${library.documentId}`))
          .data ?? []
      const docs = mobileStopDocuments(
        library,
        notices,
        localDateTime(new Date(), library.timezone ?? "UTC").date,
        live.states?.find(
          (state: any) => state.libraryDocumentId === library.documentId
        )?.sharesLive === true,
        areas
      )
      if (docs.length) {
        await wait(
          (
            await meili(
              `/indexes/${MOBILE_STOP_INDEX}/documents?primaryKey=id`,
              "PUT",
              docs
            )
          ).taskUid
        )
        count += docs.length
      }
    }
    if (
      !rows.length ||
      result.meta?.pagination?.page >= result.meta?.pagination?.pageCount
    )
      break
  }
  console.log(`mobile-stop index: ${count} stops`)
}
if (process.argv[1]?.endsWith("seed-mobile-stops.ts"))
  seedMobileStops().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
