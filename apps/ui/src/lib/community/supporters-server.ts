import "server-only"

import type { SupportersResponse } from "@repo/shared-data"

import { supportersParams, type SupportersQuery } from "./supporters"

export type { SupportersQuery } from "./supporters"

/** Always fresh: opting out must take effect on the next public request. */
export async function fetchSupporters(
  query: SupportersQuery = {}
): Promise<SupportersResponse | null> {
  const params = supportersParams(query)
  try {
    const res = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/supporters?${params}`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      }
    )
    if (!res.ok) return null
    const body = (await res.json()) as { data?: SupportersResponse }

    return body.data ?? null
  } catch {
    return null
  }
}
