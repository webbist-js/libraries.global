import "server-only"

import { z } from "zod"

import { readJsonCapped } from "@/lib/bridge-params"
import { getEnvVar } from "@/lib/env-vars"
import type { LibraryExportSource } from "@/lib/export-format"

/**
 * Ids per call to Strapi's export action. Strapi's JSON body limit is
 * koa-body's 1 MB default, which about 38,800 documentIds already pass;
 * 5,000 of them are about 140 KB.
 */
const BRIDGE_CHUNK_SIZE = 5000

/** Bridge calls in flight at once, so one big export can't flood Strapi. */
const BRIDGE_CONCURRENCY = 2

const text = z.string().nullable()
const coordinate = z.number().nullable()

/** One row, as `LibraryExportRow` in apps/strapi/src/utils/library-export.ts. */
const ExportRow = z.object({
  name: text,
  slug: text,
  libraryType: text,
  operationalStatus: text,
  streetAddress: text,
  city: text,
  region: text,
  country: text,
  lat: coordinate,
  lng: coordinate,
  website: text,
  phone: text,
  email: text,
  continentSlug: text,
  countrySlug: text,
  regionSlug: text,
}) satisfies z.ZodType<LibraryExportSource>

const ExportResponse = z.object({ data: z.record(z.string(), z.unknown()) })

type ExportRows = Map<string, LibraryExportSource>

/**
 * A bridge response's rows that match `ExportRow`; the others are skipped.
 * Null when the body isn't `{ data }` or none of its rows match, so a renamed
 * or removed field fails the export instead of leaving a column blank.
 */
function validRows(json: unknown): [string, LibraryExportSource][] | null {
  const body = ExportResponse.safeParse(json)
  if (!body.success) return null
  const entries = Object.entries(body.data.data)
  const rows = entries.flatMap(
    ([id, value]): [string, LibraryExportSource][] => {
      const row = ExportRow.safeParse(value)

      return row.success ? [[id, row.data]] : []
    }
  )

  return entries.length > 0 && rows.length === 0 ? null : rows
}

/** One bridge call's valid rows, or null when it fails in any way. */
async function fetchChunk(
  ids: readonly string[],
  secret: string,
  signal?: AbortSignal
): Promise<[string, LibraryExportSource][] | null> {
  try {
    const strapiUrl = getEnvVar("STRAPI_URL", true)!.replace(/\/$/, "")
    const res = await fetch(`${strapiUrl}/api/libraries/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Secret": secret,
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    })
    if (!res.ok) return null

    const body = await readJsonCapped(res, 8 * 1024 * 1024)

    return body.ok ? validRows(body.body) : null
  } catch {
    return null
  }
}

/**
 * Rows for `ids` from Strapi's bridge-gated export action, keyed by id. The
 * ids go in chunks of BRIDGE_CHUNK_SIZE, at most BRIDGE_CONCURRENCY at once.
 * Ids Strapi doesn't have are absent. Null when any chunk fails; the caller
 * turns that into a 502 without echoing anything back.
 */
export async function fetchExportRows(
  ids: readonly string[],
  secret: string,
  options?: { signal?: AbortSignal }
): Promise<ExportRows | null> {
  const pending: (readonly string[])[] = []
  for (let i = 0; i < ids.length; i += BRIDGE_CHUNK_SIZE)
    pending.push(ids.slice(i, i + BRIDGE_CHUNK_SIZE))
  const rows: ExportRows = new Map()
  let failed = false
  // Each worker takes the next chunk until none are left or one has failed.
  const worker = async () => {
    while (!failed) {
      const chunk = pending.shift()
      if (!chunk) return
      const found = await fetchChunk(chunk, secret, options?.signal)
      if (found) for (const [id, row] of found) rows.set(id, row)
      else failed = true
    }
  }
  await Promise.all(Array.from({ length: BRIDGE_CONCURRENCY }, () => worker()))

  return failed ? null : rows
}
