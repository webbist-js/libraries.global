import { createHash } from "node:crypto"

import {
  parseAtlasReachRequest,
  parseAtlasReachResult,
} from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

class AnalysisServiceError extends Error {
  constructor(readonly status: number) {
    super(`Analysis service HTTP ${status}`)
  }
}

export async function analysisService(path: string, body?: unknown) {
  const host = process.env.ANALYSIS_SERVICE_URL
  const token = process.env.ANALYSIS_SERVICE_TOKEN
  if (!host || !token) throw new Error("Analysis service is not configured")
  const response = await fetch(new URL(path, host), {
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
    headers: { "x-analysis-token": token, "content-type": "application/json" },
    signal: AbortSignal.timeout(10000),
    redirect: "error",
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new AnalysisServiceError(response.status)
  }
  const reader = response.body?.getReader()
  if (!reader) throw new Error("Missing analysis response")
  const parts: Uint8Array[] = []
  let bytes = 0
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > 3 * 1024 * 1024)
        throw new Error("Analysis response exceeds budget")
      parts.push(chunk.value)
    }

    return JSON.parse(Buffer.concat(parts).toString("utf8"))
  } finally {
    await reader.cancel().catch(() => {})
  }
}

/** Called only behind the private Atlas bridge, after the UI's entitlement check. */
export async function requestAtlasReach(
  strapi: Core.Strapi,
  input: unknown,
  userKey: string,
  hourlyLimit: number
) {
  const request = parseAtlasReachRequest(input)
  const library = await strapi.documents("api::library.library").findOne({
    documentId: request.libraryId,
    status: "published",
    locale: process.env.ATLAS_CANONICAL_LOCALE ?? "en",
    fields: ["documentId", "location", "operationalStatus"],
    populate: {
      country: { fields: ["iso2"] },
      libraryType: { fields: ["name"] },
    },
  })
  if (!library) return { status: 404, body: { error: "Library not found" } }
  const unavailable = (state: string, message: string) => ({
    status: 200,
    body: { schemaVersion: 1, ...request, state, message },
  })
  const coordinate = library.location as { lat: number; lng: number } | null
  if (
    ["Mobile", "Digital"].includes(library.libraryType?.name) ||
    ["permanently_closed", "temporarily_closed", "planned"].includes(
      library.operationalStatus
    ) ||
    !coordinate ||
    !Number.isFinite(coordinate.lat) ||
    !Number.isFinite(coordinate.lng) ||
    Math.abs(coordinate.lat) > 90 ||
    Math.abs(coordinate.lng) > 180
  )
    return unavailable(
      "unsupported",
      "A published, mapped visitor Library is required."
    )
  const releases = await analysisService("/releases")
  if (!Array.isArray(releases) || releases.length > 512)
    throw new Error("Invalid analysis catalogue")
  const matching = releases.filter(
    (release) =>
      Array.isArray(release.countries) &&
      release.countries.includes(library.country?.iso2) &&
      release.originBounds[0] <= coordinate.lng &&
      release.originBounds[2] >= coordinate.lng &&
      release.originBounds[1] <= coordinate.lat &&
      release.originBounds[3] >= coordinate.lat
  )
  if (matching.length !== 1)
    return unavailable(
      "unsupported",
      "Routing and population coverage is not installed for this Library."
    )
  const release = matching[0]
  const coordinateHash = createHash("sha256")
    .update(JSON.stringify([coordinate.lat, coordinate.lng]))
    .digest("hex")
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        request.libraryId,
        coordinateHash,
        request.mode,
        release.id,
        "reach-v1",
      ])
    )
    .digest("hex")
  const database = strapi.db.connection
  let job = await database("atlas_analysis_jobs")
    .where({ key })
    .where("expires_at", ">", new Date())
    .first()
  if (job?.state === "pending" && job.priority < 10)
    await database("atlas_analysis_jobs")
      .where({ key, state: "pending" })
      .update({ priority: 10 })
  if (job?.state === "failed" && request.retry) {
    await database("atlas_analysis_jobs")
      .where({ key, state: "failed" })
      .update({ expires_at: new Date(0) })
    job = null
  }
  if (!job) {
    const result = await admitReachJob(database, {
      request,
      key,
      userKey,
      hourlyLimit,
      coordinateHash,
      coordinate,
      country: library.country.iso2,
      releaseId: release.id,
    })
    if (result.status)
      return { status: result.status, body: { error: result.error } }
    job = result.job
  }
  const ready = await readyReachResult(database, job, request, coordinateHash)
  if (ready) return { status: 200, body: ready }

  if (
    ["unroutable", "unsupported", "missing_population", "failed"].includes(
      job.state
    )
  )
    return unavailable(
      job.state,
      job.last_error ?? "Analysis is unavailable for this Library."
    )

  return {
    status: 202,
    body: {
      schemaVersion: 1,
      libraryId: request.libraryId,
      mode: request.mode,
      state: "pending",
      message: "Calculating catchment",
      retryAfter: 3,
    },
  }
}

async function admitReachJob(
  database: Core.Strapi["db"]["connection"],
  options: {
    request: ReturnType<typeof parseAtlasReachRequest>
    key: string
    userKey: string
    hourlyLimit: number
    coordinateHash: string
    coordinate: { lat: number; lng: number }
    country: string
    releaseId: string
  }
) {
  const {
    request,
    key,
    userKey,
    hourlyLimit,
    coordinateHash,
    coordinate,
    country,
    releaseId,
  } = options

  return database.transaction(async (trx) => {
    // Serialize only admission, never the heavy calculation.
    await trx.raw("SELECT pg_advisory_xact_lock(7420124)")
    const known = await trx("atlas_analysis_jobs")
      .where({ key })
      .where("expires_at", ">", new Date())
      .first()
    if (known) return { job: known }
    await trx("atlas_analysis_jobs").where({ key }).delete()
    const count = await trx("atlas_analysis_jobs").count("key as n").first()
    if (Number(count.n) >= 10000)
      return {
        status: 503,
        error: "Analysis cache is at capacity. Retry later.",
      }
    const window = new Date(Math.floor(Date.now() / 3600000) * 3600000)
    const budget = await trx("atlas_analysis_budgets")
      .where({ key: userKey, window_start: window })
      .first()
    if ((budget?.used ?? 0) >= hourlyLimit)
      return { status: 429, error: "Hourly analysis allowance reached." }
    await trx("atlas_analysis_budgets")
      .insert({ key: userKey, window_start: window, used: 1 })
      .onConflict(["key", "window_start"])
      .merge({ used: trx.raw("atlas_analysis_budgets.used + 1") })
    const payload = {
      libraryId: request.libraryId,
      coordinateHash,
      mode: request.mode,
      lat: coordinate.lat,
      lng: coordinate.lng,
      country: country,
      release: releaseId,
    }
    const rows = await trx("atlas_analysis_jobs")
      .insert({
        key,
        document_id: request.libraryId,
        coordinate_hash: coordinateHash,
        release_id: releaseId,
        mode: request.mode,
        priority: 10,
        payload: JSON.stringify(payload),
      })
      .returning("*")

    return { job: rows[0] }
  })
}

export interface AtlasAnalysisJob {
  state: string
  result_key?: string
  last_error?: string
  key: string
  priority?: number
}
async function readyReachResult(
  database: Core.Strapi["db"]["connection"],
  job: AtlasAnalysisJob,
  request: ReturnType<typeof parseAtlasReachRequest>,
  coordinateHash: string
) {
  const key = job.key
  if (job.state === "ready" && job.result_key) {
    try {
      const result = parseAtlasReachResult(
        await analysisService(`/results/${job.result_key}`)
      )
      if (
        result.coordinateHash !== coordinateHash ||
        result.libraryId !== request.libraryId ||
        result.mode !== request.mode
      )
        throw new Error("Mismatched analysis result")

      return result
    } catch (error) {
      if (!(error instanceof AnalysisServiceError) || error.status !== 404)
        throw error
      // Evicted work is admitted again on the next poll, including its compute
      // allowance. A transient service outage must not invalidate good results.
      await database("atlas_analysis_jobs")
        .where({ key, state: "ready" })
        .update({ expires_at: new Date(0) })
    }
  }

  return null
}
