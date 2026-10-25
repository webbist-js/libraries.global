// Strapi supports documentId ordering; its generated sort keys omit that built-in field.
const documentOrder: Record<string, "asc"> = { documentId: "asc" }
import { createHash } from "node:crypto"

import {
  atlasLocalGeography,
  atlasNetworkReachLimit,
  atlasNetworkReachMode,
  type AtlasReachCapacity,
  ATLAS_REACH_MAX_SERVICE_LIBRARIES,
  atlasMatchesProjection,
  atlasResolveScope,
  parseAtlasNetworkReachRequest,
  parseAtlasNetworkReachResult,
  projectAtlasLibrary,
  type AtlasDictionary,
  type AtlasNetworkOption,
  type AtlasNetworkReachResult,
  type AtlasNetworkSelection,
  type AtlasScope,
} from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import { analysisService } from "./atlas-analysis"
import { atlasJson } from "./atlas-json"
import {
  networkEligible,
  networkSelection,
  type NetworkLibrary,
} from "./atlas-network-catalogue"
import { ATLAS_SOURCE_FIELDS, atlasSourceDto } from "./atlas-source"

export { atlasNetworkCatalogue } from "./atlas-network-catalogue"

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex")

/** All selection and cache identities come from current canonical CMS facts. */
export async function requestAtlasNetworkReach(
  strapi: Core.Strapi,
  input: unknown,
  userKey: string,
  hourlyLimit: number,
  capacity: AtlasReachCapacity = 1
) {
  assertCapacity(capacity)
  const request = parseAtlasNetworkReachRequest(input)
  const network = await strapi
    .documents("api::library-network.library-network")
    .findOne({ documentId: request.networkId, fields: ["name", "kind"] })
  if (!network) return { status: 404, body: { error: "Network not found" } }
  const state = (value: string, message: string) => ({
    status: 200,
    body: {
      schemaVersion: 1,
      networkId: request.networkId,
      areaCode: request.areaCode,
      mode: request.mode,
      state: value,
      message,
    },
  })
  const rows = (await strapi.documents("api::library.library").findMany({
    status: "published",
    locale: process.env.ATLAS_CANONICAL_LOCALE ?? "en",
    fields: [...ATLAS_SOURCE_FIELDS],
    filters: { networks: { documentId: request.networkId } },
    limit: 251,
    sort: documentOrder,
    populate: {
      libraryType: { fields: ["name"] },
      country: { fields: ["iso2", "name", "slug"] },
      networks: { fields: ["name", "slug"] },
      accessibility: { fields: ["name"] },
      services: { fields: ["name"] },
      amenities: { fields: ["name"] },
    },
  })) as unknown as NetworkLibrary[]
  if (rows.length > 250)
    return state(
      "unsupported",
      "This service is too large for local Reach. Choose one library instead."
    )
  if (
    rows.filter(networkEligible).length >
    ATLAS_REACH_MAX_SERVICE_LIBRARIES * capacity
  )
    return state(
      "unsupported",
      `Local Reach supports at most ${ATLAS_REACH_MAX_SERVICE_LIBRARIES * capacity} eligible libraries. Choose a smaller service or one library.`
    )
  const selection = await networkSelection(
    strapi,
    network as AtlasNetworkOption,
    rows
  )
  const problem = selectionProblem(selection, capacity, request.minutes)
  if (problem) return state("unsupported", problem)
  if (request.areaCode && !selection.areaCodes.includes(request.areaCode))
    throw new RangeError("Reporting area is outside this service")
  const areaCodes = request.areaCode ? [request.areaCode] : selection.areaCodes
  const areaCode = areaCodes[0]!
  const areaName =
    areaCodes.length === 1
      ? atlasLocalGeography.areas.find((area) => area.code === areaCode)!.name
      : selection.areaName
  const {
    members,
    excluded,
    error: memberError,
  } = await networkMembers(strapi, rows, request.scope)
  if (memberError) return state("unsupported", memberError)
  const releases = await analysisService("/releases")
  if (!Array.isArray(releases) || releases.length > 512)
    throw new Error("Invalid release catalogue")
  const matching = releases.filter((release) =>
    members.every(
      (member) =>
        release.countries.includes(member.country) &&
        release.originBounds[0] <= member.lng &&
        release.originBounds[2] >= member.lng &&
        release.originBounds[1] <= member.lat &&
        release.originBounds[3] >= member.lat
    )
  )
  if (matching.length !== 1)
    return state(
      "unsupported",
      "A shared routing and population release is required for every selected library."
    )
  const release = matching[0]
  const nation = { E: "GB-ENG", W: "GB-WLS", S: "GB-SCT", N: "GB-NIR" }[
    areaCode[0]
  ]
  const communityReleases = (release.communityReleases ?? []).filter(
    (entry: { country: string; id: string }) =>
      entry.country === nation &&
      areaCodes.every((code) => code[0] === areaCode[0])
  )
  if (communityReleases.length > 1)
    throw new Error("Ambiguous community edition")
  const communityRelease = communityReleases[0]?.id ?? null
  const selectionHash = hash([
    members,
    excluded,
    network.name,
    request.scope,
    areaCodes,
    atlasLocalGeography.version,
    release.id,
    "network-service-area-v5-selected-time",
    capacity,
    request.minutes ?? null,
    communityRelease,
  ])
  const payload = {
    kind: "network",
    capacity,
    ...(request.minutes !== undefined ? { minutes: request.minutes } : {}),
    networkId: request.networkId,
    networkName: network.name,
    areaCode,
    ...(areaCodes.length > 1 ? { areaCodes } : {}),
    selectionHash,
    mode: request.mode,
    release: release.id,
    members,
    excludedLibraries: excluded,
    areaVersion: atlasLocalGeography.version,
    communityRelease,
  }

  return networkJobResponse(strapi, {
    request,
    payload,
    userKey,
    hourlyLimit,
    areaName,
    areaCodes,
    serviceLibraries: rows.length,
    state,
  })
}

function assertCapacity(capacity: number) {
  if (capacity !== 1 && capacity !== 2)
    throw new RangeError("Invalid Reach capacity")
}

function selectionProblem(
  selection: AtlasNetworkSelection,
  capacity: AtlasReachCapacity,
  minutes: number | undefined
): string | null {
  const limit = atlasNetworkReachLimit(selection, capacity)
  if (limit === "libraries")
    return `Local Reach supports at most ${ATLAS_REACH_MAX_SERVICE_LIBRARIES * capacity} eligible libraries. Choose a smaller service or one library.`
  if (limit)
    return "This service or its reporting area exceeds your Reach calculation allowance. Choose one library instead."
  if (
    atlasNetworkReachMode(selection, capacity) === "single" &&
    minutes === undefined
  )
    return "Choose one travel time for this larger service. Changing the time requires another calculation."
  if (!selection.available)
    return "This service needs mapped libraries and supported reporting boundaries before coverage can be calculated."

  return null
}

async function admitNetworkJob(
  db: Core.Strapi["db"]["connection"],
  key: string,
  userKey: string,
  hourlyLimit: number,
  payload: {
    networkId: string
    selectionHash: string
    release: string
    mode: string
  }
) {
  return db.transaction(async (trx) => {
    await trx.raw("SELECT pg_advisory_xact_lock(7420124)")
    const known = await trx("atlas_analysis_jobs")
      .where({ key })
      .where("expires_at", ">", new Date())
      .first()
    if (known) return { job: known }
    const window = new Date(Math.floor(Date.now() / 3600000) * 3600000)
    const budget = await trx("atlas_analysis_budgets")
      .where({ key: userKey, window_start: window })
      .first()
    if ((budget?.used ?? 0) >= hourlyLimit) return { status: 429 }
    const count = await trx("atlas_analysis_jobs").count("key as n").first()
    if (Number(count.n) >= 10000) return { status: 503 }
    await trx("atlas_analysis_jobs").where({ key }).delete()
    await trx("atlas_analysis_budgets")
      .insert({ key: userKey, window_start: window, used: 1 })
      .onConflict(["key", "window_start"])
      .merge({ used: trx.raw("atlas_analysis_budgets.used + 1") })
    const jobs = await trx("atlas_analysis_jobs")
      .insert({
        key,
        document_id: `network-${payload.networkId}`,
        coordinate_hash: payload.selectionHash,
        release_id: payload.release,
        mode: payload.mode,
        priority: 10,
        payload: JSON.stringify(payload),
      })
      .returning("*")

    return { job: jobs[0] }
  })
}

async function networkMembers(
  strapi: Core.Strapi,
  rows: NetworkLibrary[],
  scope: AtlasScope
) {
  const resolved = await networkScope(strapi, scope)
  const notices = await strapi
    .documents("api::library-notice.library-notice")
    .findMany({
      filters: {
        library: {
          documentId: { $in: rows.map((row) => row.documentId) },
        },
        endedAt: { $null: true },
      },
      fields: [
        "documentId",
        "type",
        "scope",
        "scopeWeek",
        "scopeDay",
        "from",
        "to",
        "endedAt",
        "hours",
      ],
      populate: { library: { fields: ["documentId"] } },
      limit: 1001,
    })
  if (notices.length > 1000)
    throw new RangeError("Network notice budget exceeded")
  const members: {
    libraryId: string
    coordinateHash: string
    lat: number
    lng: number
    country: string
  }[] = []
  let excluded = 0
  const now = new Date()
  for (const row of rows) {
    if (!networkEligible(row)) {
      excluded++
      continue
    }
    const projection = projectAtlasLibrary(
      atlasSourceDto(
        row,
        notices.filter(
          (notice) => notice.library?.documentId === row.documentId
        )
      ),
      { atlasId: 1, canonicalLocale: row.locale, now }
    )
    if (!projection)
      return {
        members,
        excluded,
        error:
          "An eligible library has no valid map coordinate; resolve it before estimating gaps.",
      }
    if (!atlasMatchesProjection(projection, resolved, now)) continue
    members.push({
      libraryId: row.documentId,
      coordinateHash: hash([row.location.lat, row.location.lng]),
      lat: row.location.lat,
      lng: row.location.lng,
      country: row.country?.iso2,
    })
  }
  if (!members.length)
    return {
      members,
      excluded,
      error: "No eligible mapped libraries match this selection.",
    }

  return { members, excluded, error: null }
}

async function networkJobResponse(
  strapi: Core.Strapi,
  {
    request,
    payload,
    userKey,
    hourlyLimit,
    areaName,
    areaCodes,
    serviceLibraries,
    state,
  }: {
    request: ReturnType<typeof parseAtlasNetworkReachRequest>
    payload: {
      networkId: string
      areaCode: string
      selectionHash: string
      release: string
      mode: string
      members: Awaited<ReturnType<typeof networkMembers>>["members"]
      excludedLibraries: number
      communityRelease: string | null
    }
    userKey: string
    hourlyLimit: number
    areaName: string
    areaCodes: string[]
    serviceLibraries: number
    state: (value: string, message: string) => { status: number; body: unknown }
  }
) {
  const key = hash([payload.selectionHash, request.mode])
  const db = strapi.db.connection
  let job = await db("atlas_analysis_jobs")
    .where({ key })
    .where("expires_at", ">", new Date())
    .first()
  if (job?.state === "ready" && job.result_key) {
    try {
      const result = parseAtlasNetworkReachResult(
        await analysisService(`/results/${job.result_key}`)
      )
      verifyNetworkIdentity(result, request, payload)

      return {
        status: 200,
        body: {
          ...result,
          areaCodes,
          scope: request.scope,
          analysis: {
            schemaVersion: 2,
            eligibleLibraries: payload.members,
            serviceLibraries,
            filteredOutLibraries:
              serviceLibraries -
              payload.excludedLibraries -
              payload.members.length,
            routingRelease: payload.release,
            communityRelease: payload.communityRelease,
          },
          reportingArea: {
            name: areaName,
            version: atlasLocalGeography.version,
            sourceUrl: atlasLocalGeography.boundaryUrl,
            licence: atlasLocalGeography.boundaryLicence,
          },
        },
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !("status" in error) ||
        error.status !== 404
      )
        throw error
      await db("atlas_analysis_jobs")
        .where({ key })
        .update({ expires_at: new Date(0) })
      job = null
    }
  }
  if (job?.state === "failed" && request.retry) {
    await db("atlas_analysis_jobs").where({ key, state: "failed" }).delete()
    job = null
  }
  if (!job) {
    const admission = await admitNetworkJob(
      db,
      key,
      userKey,
      hourlyLimit,
      payload
    )
    if (admission.status)
      return {
        status: admission.status,
        body: { error: "Network analysis allowance or capacity reached" },
      }
    job = admission.job
  }
  if (
    ["failed", "unsupported", "unroutable", "missing_population"].includes(
      job.state
    )
  )
    return state(
      job.state,
      job.state === "failed"
        ? "Coverage could not be calculated. Please try again."
        : (job.last_error ?? "Network analysis unavailable")
    )

  return {
    status: 202,
    body: {
      schemaVersion: 1,
      networkId: request.networkId,
      areaCode: request.areaCode,
      mode: request.mode,
      state: "pending",
      retryAfter: 3,
    },
  }
}

async function networkScope(strapi: Core.Strapi, scope: AtlasScope) {
  // Resolve the same translated facility/accessibility aliases as Atlas search.
  const dictionaryState = await strapi.db
    .connection("atlas_state")
    .where({ key: "current" })
    .first("dictionary")
  const dictionary = atlasJson(dictionaryState?.dictionary) as AtlasDictionary
  if (
    !dictionary ||
    !Array.isArray(dictionary.entries) ||
    dictionary.entries.length > 10000
  )
    throw new Error("Atlas dictionary unavailable")

  return atlasResolveScope(scope, dictionary)
}

function verifyNetworkIdentity(
  result: AtlasNetworkReachResult,
  request: ReturnType<typeof parseAtlasNetworkReachRequest>,
  payload: { selectionHash: string; areaCode: string }
) {
  if (
    result.selectionHash !== payload.selectionHash ||
    result.mode !== request.mode ||
    result.networkId !== request.networkId ||
    result.areaCode !== payload.areaCode ||
    result.requestedMinutes !== request.minutes
  )
    throw new Error("Mismatched network result")
}
