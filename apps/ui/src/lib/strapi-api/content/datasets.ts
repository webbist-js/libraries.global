import "server-only"

import { logNonBlockingError } from "@/lib/logging"
import { PublicStrapiClient } from "@/lib/strapi-api"
import type { APIResponse } from "@/types/api"

/**
 * A dataset imported into Libraries Global, from the `dataset` registry
 * in Strapi. A library's `sourceRecords[].dataset` is the registry key.
 */
export interface DatasetRecord {
  documentId: string
  key: string
  name: string
  publisher?: string | null
  sourceUrl?: string | null
  licence?: string | null
  licenceUrl?: string | null
  licenceStatus?:
    | "confirmed_in_writing"
    | "stated_by_publisher"
    | "unconfirmed"
    | null
  redistribution?:
    | "permitted"
    | "permitted_with_attribution"
    | "not_permitted"
    | "unconfirmed"
    | null
  attribution?: string | null
  coverage?: string | null
  importMechanism?: string | null
  obtainedAt?: string | null
  sourceUpdatedAt?: string | null
  notes?: string | null
}

/** Keys that mean "a person typed it in", not an imported dataset. */
const NOT_A_DATASET = new Set(["manual", "contributor", ""])

/** The dataset a record was imported from, or null when it wasn't imported. */
export async function fetchDataset(
  key: string | null | undefined
): Promise<DatasetRecord | null> {
  const trimmed = key?.trim().toLowerCase()
  if (!trimmed || NOT_A_DATASET.has(trimmed)) return null

  try {
    const res = (await PublicStrapiClient.fetchAPI(
      `/datasets/by-key/${encodeURIComponent(trimmed)}`
    )) as APIResponse<DatasetRecord | null>

    return res.data ?? null
  } catch (e: unknown) {
    logNonBlockingError({
      message: `Error fetching dataset '${trimmed}'`,
      error: {
        error: e instanceof Error ? e.message : String(e),
        stack: e instanceof Error ? e.stack : undefined,
      },
    })

    return null
  }
}
