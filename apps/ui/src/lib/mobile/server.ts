import "server-only"
import { normalizeMobileTimetable } from "@repo/shared-data"

import { isDocumentIdParam } from "@/lib/bridge-params"

import type { PublicMobileTimetable } from "./types"

export async function fetchMobileTimetable(
  id: string
): Promise<PublicMobileTimetable | null> {
  if (!isDocumentIdParam(id)) return null
  const url = new URL(
    `/api/mobile/${id}/timetable`,
    process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
  )
  const response = await fetch(url, {
    next: { tags: ["library", `mobile:${id}`], revalidate: 300 },
    signal: AbortSignal.timeout(10000),
  })
  if (response.status === 404) return null
  if (!response.ok) throw new Error("Mobile timetable unavailable")
  const row = (await response.json()) as PublicMobileTimetable

  return {
    ...row,
    timetable: normalizeMobileTimetable(row.timetable),
    notices: Array.isArray(row.notices) ? row.notices : [],
  }
}
