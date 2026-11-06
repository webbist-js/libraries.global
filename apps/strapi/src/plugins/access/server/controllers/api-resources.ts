import { createHash } from "node:crypto"

import {
  ATLAS_REACH_MINUTES,
  emptyAtlasFilters,
  isLibraryEntityRef,
  publicSourceUrl,
} from "@repo/shared-data"
import type { Core } from "@strapi/strapi"

import {
  requestAtlasReach,
  type ReachAllowance,
} from "../../../../utils/atlas-analysis"
import { requestAtlasNetworkReach } from "../../../../utils/atlas-network-analysis"
import { atlasEnabled } from "../../../../utils/atlas-outbox"
import { isPlaceSlug } from "../../../../utils/place-catalogue"
import { isValidServiceSecret } from "../../../../utils/service-secret"
import {
  API_DATASET_FIELDS,
  API_LIBRARY_FIELDS,
  API_LIBRARY_POPULATE,
  apiStore,
  projectApiLibraries,
  type ApiDatasetRow,
  type ApiLibraryRow,
} from "../services/api-library-projection"
import { NETWORK, publicNetworkFilter } from "../services/network-records"
import { AccessError, isDocumentId } from "../utils/admin"

/**
 * Machine API bridge for service reads and bounded analysis. Only the
 * application gateway calls these routes, after key authentication, scope,
 * coverage and ledger checks; they take the bridge secret and never a user
 * identity, so nothing here can reach staff or admin mutations. Every read
 * is a bounded, keyset-paginated or counted query over published records.
 */

const LOCALES = new Set(["en", "cs", "es", "fr"])
const SERVICE_TYPES = new Set([
  "library_service",
  "university_system",
  "consortium",
])
const CANONICAL_LOCALE = () => process.env.ATLAS_CANONICAL_LOCALE ?? "en"

/** Geometry is returned only while a result stays well inside 128 KiB. */
export const API_GEOMETRY_BUDGET = 96 * 1024

export const SERVICE_SEMANTICS = {
  serviceType:
    "library_service: a library authority or service that operates its member libraries. university_system: academic libraries of one university or system. consortium: a cooperative of independently run libraries.",
  membership:
    "Published libraries recorded as members of this grouping in the Libraries Global directory. Membership is not staff authority, does not imply a shared catalogue or card, and does not mean every member offers public access.",
}
const SERVICE_ATTRIBUTION =
  "Libraries Global contributors. Service groupings are sourced from each sourceUrl; member Library records retain their source licences."

const NETWORK_FIELDS = [
  "name",
  "slug",
  "kind",
  "description",
  "website",
  "sourceUrl",
  "lastVerifiedAt",
  "updatedAt",
]

type BridgeContext = {
  request: { header: Record<string, unknown>; body: unknown }
  query?: Record<string, unknown>
  params: Record<string, string>
  unauthorized: (message?: string) => unknown
  set: (name: string, value: string) => void
  body: unknown
  status: number
}

type ServiceRow = {
  documentId: string
  name: string
  slug: string
  kind: string
  description?: string | null
  website?: string | null
  sourceUrl?: string | null
  lastVerifiedAt?: string | null
  updatedAt?: string | null
  countries?:
    | { name?: string | null; slug?: string | null; iso2?: string | null }[]
    | null
}

function query(ctx: BridgeContext, allowed: string[]) {
  const q = (ctx.query ?? {}) as Record<string, unknown>
  for (const [key, value] of Object.entries(q))
    if (!allowed.includes(key) || typeof value !== "string")
      throw new AccessError(400, "invalid_query")

  return q as Record<string, string | undefined>
}
function locale(chosen = "en") {
  if (!LOCALES.has(chosen)) throw new AccessError(400, "invalid_locale")

  return chosen
}
function limit(value: string | undefined) {
  const n = Number(value ?? 50)
  if (!/^\d{1,3}$/.test(value ?? "50") || n < 1 || n > 50)
    throw new AccessError(400, "invalid_limit")

  return n
}
function cursor(value: string | undefined) {
  if (value !== undefined && !isDocumentId(value))
    throw new AccessError(400, "invalid_cursor")

  return value
}

function projectService(row: ServiceRow) {
  return {
    ref: row.documentId,
    slug: row.slug,
    name: row.name,
    serviceType: row.kind,
    description: row.description ?? "",
    website: publicSourceUrl(row.website),
    countries: (row.countries ?? []).map((country) => ({
      name: country.name ?? null,
      slug: country.slug ?? null,
      iso2: country.iso2 ?? null,
    })),
    source: {
      url: publicSourceUrl(row.sourceUrl),
      lastVerifiedAt: row.lastVerifiedAt ?? null,
    },
    updatedAt: row.updatedAt ?? null,
  }
}

/** A public, reviewed service by its stable ref (documentId), or 404. */
async function publicService(strapi: Core.Strapi, ref: unknown) {
  if (!isDocumentId(ref)) throw new AccessError(404, "not_found")
  const rows = await apiStore<ServiceRow>(strapi, NETWORK).findMany({
    filters: { documentId: { $eq: ref }, ...publicNetworkFilter },
    fields: NETWORK_FIELDS,
    populate: { countries: { fields: ["name", "slug", "iso2"] } },
    limit: 1,
  })
  if (!rows[0]) throw new AccessError(404, "not_found")

  return rows[0]
}

const memberFilter = (ref: string) => ({
  networks: { documentId: { $eq: ref }, ...publicNetworkFilter },
})

/** The library filter for a summary scope: a public service or a place. */
async function scopeFilter(strapi: Core.Strapi, body: Record<string, unknown>) {
  if (body.ref !== undefined) {
    const service = await publicService(strapi, body.ref)

    return {
      filters: memberFilter(service.documentId),
      scope: {
        kind: "service",
        ref: service.documentId,
        name: service.name,
        serviceType: service.kind,
      },
    }
  }
  const place = body.place as Record<string, unknown> | undefined
  if (!place || typeof place !== "object" || Array.isArray(place))
    throw new AccessError(400, "invalid_scope")
  const { country, region, area } = place
  if (
    Object.keys(place).some((k) => !["country", "region", "area"].includes(k))
  )
    throw new AccessError(400, "invalid_scope")
  for (const value of [country, region, area])
    if (value !== undefined && !isPlaceSlug(value))
      throw new AccessError(400, "invalid_place")
  if (!country || (area && !region)) throw new AccessError(400, "invalid_place")

  return {
    filters: {
      country: { slug: { $eq: country } },
      ...(region
        ? {
            region: {
              slug: { $eq: region },
              country: { slug: { $eq: country } },
            },
          }
        : {}),
      ...(area
        ? { area: { slug: { $eq: area }, region: { slug: { $eq: region } } } }
        : {}),
    },
    scope: {
      kind: "place",
      country,
      region: region ?? null,
      area: area ?? null,
    },
  }
}

const OPERATIONAL_STATUSES = [
  "open",
  "temporarily_closed",
  "permanently_closed",
  "seasonal",
  "appointment_only",
  "planned",
  "unknown",
]
/** Completeness checks for the richer `coverage` operations. */
const COMPLETENESS: Record<string, Record<string, unknown>> = {
  website: { website: { $notNull: true, $ne: "" } },
  openingTimes: { openingTimes: { $notNull: true } },
  contact: {
    $or: [
      { email: { $notNull: true, $ne: "" } },
      { phone: { $notNull: true, $ne: "" } },
    ],
  },
  location: { location: { $notNull: true } },
  catalogue: { catalogueUrl: { $notNull: true, $ne: "" } },
}
const VERIFIED_WITHIN_DAYS = 365

/** Run counts a few at a time; each is one bounded database count. */
async function counted<T>(
  items: readonly T[],
  count: (item: T) => Promise<number>
) {
  const out: number[] = []
  for (let i = 0; i < items.length; i += 6)
    out.push(...(await Promise.all(items.slice(i, i + 6).map(count))))

  return out
}

export const SUMMARY_OPERATIONS = {
  "service.profile": 1,
  "place.profile": 1,
  "service.coverage": 5,
  "place.coverage": 5,
} as const

async function summary(strapi: Core.Strapi, body: Record<string, unknown>) {
  const operation = body.operation as keyof typeof SUMMARY_OPERATIONS
  if (
    Object.keys(body).some(
      (k) => !["operation", "ref", "place", "locale"].includes(k)
    ) ||
    !(operation in SUMMARY_OPERATIONS) ||
    operation.startsWith("service.") !== (body.ref !== undefined) ||
    operation.startsWith("place.") !== (body.place !== undefined)
  )
    throw new AccessError(400, "invalid_operation")
  const lang = locale(body.locale as string | undefined)
  const { filters, scope } = await scopeFilter(strapi, body)
  const libraries = apiStore<ApiLibraryRow>(strapi, "api::library.library")
  const count = (extra: Record<string, unknown> = {}) =>
    libraries.count({
      status: "published",
      locale: lang,
      filters: { $and: [filters, extra] },
    })
  const total = await count()
  const types = (
    await apiStore<{ name: string }>(
      strapi,
      "api::library-type.library-type"
    ).findMany({
      status: "published",
      locale: "en",
      fields: ["name"],
      sort: "name:asc",
      limit: 100,
    })
  ).map((row) => String(row.name))
  const [statusCounts, typeCounts] = await Promise.all([
    counted(OPERATIONAL_STATUSES, (status) =>
      count({ operationalStatus: { $eq: status } })
    ),
    counted(types, (name) => count({ libraryType: { name: { $eq: name } } })),
  ])
  const nonZero = (keys: readonly string[], values: number[]) =>
    Object.fromEntries(
      keys.flatMap((key, i) => (values[i] ? [[key, values[i]]] : []))
    )
  const result: Record<string, unknown> = {
    operation,
    scope,
    libraries: total,
    byOperationalStatus: nonZero(OPERATIONAL_STATUSES, statusCounts),
    byLibraryType: nonZero(types, typeCounts),
  }
  if (operation.endsWith(".coverage")) {
    const checks = Object.keys(COMPLETENESS)
    const since = new Date(Date.now() - VERIFIED_WITHIN_DAYS * 86_400_000)
    const [completeness, verified] = await Promise.all([
      counted(checks, (key) => count(COMPLETENESS[key])),
      count({ lastVerifiedAt: { $gte: since.toISOString() } }),
    ])
    const datasets = await apiStore<ApiDatasetRow>(
      strapi,
      "api::dataset.dataset"
    ).findMany({
      fields: API_DATASET_FIELDS,
      sort: "key:asc",
      limit: 50,
    })
    const datasetCounts = await counted(datasets, (dataset) =>
      count({ sourceRecords: { dataset: { $eq: dataset.key } } })
    )
    result.completeness = Object.fromEntries(
      checks.map((key, i) => [key, completeness[i]])
    )
    result.verifiedWithinDays = { days: VERIFIED_WITHIN_DAYS, count: verified }
    result.sources = datasets.flatMap((dataset, i) =>
      datasetCounts[i]
        ? [
            {
              dataset: dataset.key,
              publisher: dataset.publisher ?? null,
              licence: dataset.licence ?? null,
              licenceUrl: publicSourceUrl(dataset.licenceUrl),
              attribution: dataset.attribution ?? null,
              libraries: datasetCounts[i],
            },
          ]
        : []
    )
  }

  return {
    data: result,
    meta: {
      locale: lang,
      computedAt: new Date().toISOString(),
      attribution:
        "Libraries Global contributors. Counts cover published records only; imported details retain their source licences.",
    },
  }
}

const sha = (value: string) => createHash("sha256").update(value).digest("hex")

/**
 * Machine Reach uses its own CMS admission pool per API account, separate
 * from the browser Reach allowance of the account's organisers. Credits are
 * the commercial limit; this is the native capacity ceiling behind them.
 */
export const machineAllowance = (account: string): ReachAllowance => ({
  kind: "api",
  hourly: 60,
  daily: 500,
  accountKey: sha(`api-machine-day:${account}`),
})
const machineUserKey = (account: string) => sha(`api-machine:${account}`)

type Contour = {
  minutes: number
  residents: number | null
  coveredFraction: number
  geometry?: unknown
  percent?: number | null
  outsideResidents?: number | null
}

type Provenance = {
  release?: unknown
  source?: unknown
  sourceUrl?: unknown
  licence?: unknown
  year?: unknown
}
type ReachResult = Record<string, unknown> & {
  contours?: Contour[]
  warnings?: unknown[]
  network?: Provenance | null
  population?: Provenance | null
}

const provenance = (p: Provenance | null | undefined) =>
  p
    ? {
        release: p.release,
        source: p.source,
        sourceUrl: p.sourceUrl,
        licence: p.licence,
        ...(p.year !== undefined ? { year: p.year } : {}),
      }
    : null

/** The licensed, published-field projection of a Reach result. */
export function projectReachResult(
  result: ReachResult,
  subject: Record<string, unknown>,
  minutes?: number
) {
  const contours: Contour[] = (result.contours ?? [])
    .filter((c: Contour) => minutes === undefined || c.minutes === minutes)
    .map((c: Contour) => ({
      minutes: c.minutes,
      residents: c.residents,
      coveredFraction: c.coveredFraction,
      ...(c.percent !== undefined ? { percent: c.percent } : {}),
      ...(c.outsideResidents !== undefined
        ? { outsideResidents: c.outsideResidents }
        : {}),
      geometry: c.geometry ?? null,
    }))
  const projected: Record<string, unknown> = {
    ...subject,
    state: result.state,
    travelMode: result.mode,
    calculatedAt: result.calculatedAt,
    method: result.method,
    warnings: result.warnings ?? [],
    ...(result.kind === "network"
      ? {
          areaCode: result.areaCode,
          ...(result.areaCodes ? { areaCodes: result.areaCodes } : {}),
          totalResidents: result.totalResidents,
          selectedLibraries: result.selectedLibraries,
          excludedLibraries: result.excludedLibraries,
          unavailableLibraries: result.unavailableLibraries,
          ...(result.reportingArea
            ? { reportingArea: result.reportingArea }
            : {}),
        }
      : {}),
    contours,
    sources: {
      routing: provenance(result.network),
      population: provenance(result.population),
    },
    geometry: "included",
  }
  if (Buffer.byteLength(JSON.stringify(projected)) > API_GEOMETRY_BUDGET) {
    projected.contours = contours.map((c) => ({ ...c, geometry: null }))
    projected.geometry = "unavailable"
  }

  return projected
}

const UNAVAILABLE = new Set([
  "unsupported",
  "unroutable",
  "missing_population",
  "failed",
])

const REACH_KEYS = new Set([
  "account",
  "mode",
  "ref",
  "travelMode",
  "minutes",
  "areaCode",
])

function isValidReachBody(body: Record<string, unknown>) {
  const { account, mode, travelMode, minutes, areaCode } = body
  if (Object.keys(body).some((k) => !REACH_KEYS.has(k))) return false
  if (!isDocumentId(account)) return false
  if (!["library", "service", "network"].includes(String(mode))) return false
  if (!["walking", "cycling"].includes(String(travelMode))) return false
  if (
    minutes !== undefined &&
    !(ATLAS_REACH_MINUTES as readonly unknown[]).includes(minutes)
  )
    return false
  if (areaCode === undefined) return true

  return (
    mode === "service" &&
    typeof areaCode === "string" &&
    /^[EWSN]\d{8}$/.test(areaCode)
  )
}

type ReachOutcome = { status: number; body?: unknown }
type ReachRequest = {
  account: string
  mode: string
  ref: unknown
  travelMode: unknown
  minutes: unknown
  areaCode: unknown
}

async function reachLibrary(strapi: Core.Strapi, request: ReachRequest) {
  const { account, mode, ref, travelMode } = request
  if (!isLibraryEntityRef(ref)) throw new AccessError(404, "not_found")
  const rows = await apiStore<ApiLibraryRow>(
    strapi,
    "api::library.library"
  ).findMany({
    status: "published",
    locale: CANONICAL_LOCALE(),
    filters: { entityRef: { $eq: ref } },
    fields: ["entityRef", "name"],
    limit: 1,
  })
  if (!rows[0]) throw new AccessError(404, "not_found")
  const subject = { mode, ref: rows[0].entityRef, name: rows[0].name }
  const outcome: ReachOutcome = await requestAtlasReach(
    strapi,
    {
      schemaVersion: 1,
      libraryId: rows[0].documentId,
      mode: travelMode,
    },
    machineUserKey(account),
    machineAllowance(account)
  )

  return { subject, outcome }
}

async function reachService(strapi: Core.Strapi, request: ReachRequest) {
  const { account, mode, ref, travelMode, minutes, areaCode } = request
  const service = await publicService(strapi, ref)
  // Service mode is one reporting area; network mode the whole service.
  if (mode === "service" && areaCode === undefined)
    throw new AccessError(400, "area_required")
  const subject = {
    mode,
    ref: service.documentId,
    name: service.name,
    serviceType: service.kind,
  }
  const outcome: ReachOutcome = await requestAtlasNetworkReach(
    strapi,
    {
      schemaVersion: 1,
      networkId: service.documentId,
      mode: travelMode,
      scope: {
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      },
      ...(areaCode ? { areaCode } : {}),
      ...(minutes !== undefined ? { minutes } : {}),
    },
    machineUserKey(account),
    machineAllowance(account)
  )

  return { subject, outcome }
}

function reachResponse(
  outcome: ReachOutcome,
  subject: Record<string, unknown>,
  minutes: number | undefined
) {
  if (outcome.status === 404) throw new AccessError(404, "not_found")
  if (outcome.status === 429)
    return { state: "refused", code: "analysis_capacity" }
  if (outcome.status === 503) throw new AccessError(503, "analysis_capacity")
  if (outcome.status === 202) return { state: "pending", retryAfter: 3 }
  if (outcome.status !== 200 || !outcome.body)
    throw new AccessError(503, "analysis_unavailable")
  const result = outcome.body as ReachResult
  const state = String(result.state)
  if (UNAVAILABLE.has(state)) return { state: "unavailable", reason: state }
  if (state !== "ready" && state !== "partial")
    throw new AccessError(503, "analysis_unavailable")

  return {
    state: "ready",
    result: projectReachResult(result, subject, minutes),
  }
}

async function reach(strapi: Core.Strapi, body: Record<string, unknown>) {
  if (!isValidReachBody(body)) throw new AccessError(400, "invalid_analysis")
  if (!atlasEnabled() || !process.env.ANALYSIS_SERVICE_URL)
    throw new AccessError(503, "analysis_unavailable")
  const request = body as ReachRequest
  const { subject, outcome } =
    request.mode === "library"
      ? await reachLibrary(strapi, request)
      : await reachService(strapi, request)

  return reachResponse(
    outcome,
    subject,
    request.mode === "library"
      ? (request.minutes as number | undefined)
      : undefined
  )
}

const wrap =
  (work: (ctx: BridgeContext) => Promise<unknown>) =>
  async (ctx: BridgeContext) => {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized("Invalid service secret")
    ctx.set("Cache-Control", "no-store")
    try {
      ctx.body = await work(ctx)
    } catch (error) {
      if (error instanceof RangeError) {
        ctx.status = 400
        ctx.body = { error: { code: "invalid_analysis" } }

        return
      }
      if (!(error instanceof AccessError)) throw error
      ctx.status = error.status
      ctx.body = { error: { code: error.code } }
    }
  }

const requestBody = (ctx: BridgeContext) => {
  const value = ctx.request.body
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AccessError(400, "invalid_body")

  return value as Record<string, unknown>
}

export default ({ strapi }: { strapi: Core.Strapi }) => {
  return {
    /** GET /api/services: public, reviewed services, keyset by ref. */
    services: wrap(async (ctx) => {
      const q = query(ctx, [
        "locale",
        "limit",
        "after",
        "serviceType",
        "country",
      ])
      const lang = locale(q.locale)
      const size = limit(q.limit)
      const after = cursor(q.after)
      if (q.serviceType !== undefined && !SERVICE_TYPES.has(q.serviceType))
        throw new AccessError(400, "invalid_service_type")
      if (q.country !== undefined && !isPlaceSlug(q.country))
        throw new AccessError(400, "invalid_country")
      const rows = await apiStore<ServiceRow>(strapi, NETWORK).findMany({
        filters: {
          ...publicNetworkFilter,
          ...(after ? { documentId: { $gt: after } } : {}),
          ...(q.serviceType ? { kind: { $eq: q.serviceType } } : {}),
          ...(q.country ? { countries: { slug: { $eq: q.country } } } : {}),
        },
        fields: NETWORK_FIELDS,
        populate: { countries: { fields: ["name", "slug", "iso2"] } },
        sort: "documentId:asc",
        limit: size + 1,
      })
      const page = rows.slice(0, size)

      return {
        data: page.map(projectService),
        meta: {
          locale: lang,
          limit: size,
          nextCursor: rows.length > size ? page.at(-1).documentId : null,
          semantics: SERVICE_SEMANTICS,
          attribution: SERVICE_ATTRIBUTION,
        },
      }
    }),
    /** GET /api/services/:ref: one public service with coverage metadata. */
    service: wrap(async (ctx) => {
      const q = query(ctx, ["locale"])
      const lang = locale(q.locale)
      const row = await publicService(strapi, ctx.params.ref)
      const libraryCount = await apiStore<ApiLibraryRow>(
        strapi,
        "api::library.library"
      ).count({
        status: "published",
        locale: lang,
        filters: memberFilter(row.documentId),
      })

      return {
        data: {
          ...projectService(row),
          coverage: {
            libraryCount,
            countries: (row.countries ?? []).length,
            lastVerifiedAt: row.lastVerifiedAt ?? null,
          },
        },
        meta: {
          locale: lang,
          semantics: SERVICE_SEMANTICS,
          attribution: SERVICE_ATTRIBUTION,
        },
      }
    }),
    /** GET /api/services/:ref/libraries: published members from the CMS. */
    serviceLibraries: wrap(async (ctx) => {
      const q = query(ctx, ["locale", "limit", "after"])
      const lang = locale(q.locale)
      const size = limit(q.limit)
      const after = cursor(q.after)
      const service = await publicService(strapi, ctx.params.ref)
      const rows = await apiStore<ApiLibraryRow>(
        strapi,
        "api::library.library"
      ).findMany({
        status: "published",
        locale: lang,
        filters: {
          ...memberFilter(service.documentId),
          ...(after ? { documentId: { $gt: after } } : {}),
        },
        fields: API_LIBRARY_FIELDS,
        sort: "documentId:asc",
        limit: size + 1,
        populate: API_LIBRARY_POPULATE,
      })
      const page = rows.slice(0, size)

      return {
        data: await projectApiLibraries(strapi, page),
        meta: {
          locale: lang,
          limit: size,
          service: { ref: service.documentId, serviceType: service.kind },
          nextCursor: rows.length > size ? page.at(-1).documentId : null,
          semantics: SERVICE_SEMANTICS,
          attribution:
            "Libraries Global contributors. Imported details retain their source licence; see sourceRecords.",
        },
      }
    }),
    /** POST /api/analysis/summary: counted aggregates over published records. */
    summary: wrap((ctx) => summary(strapi, requestBody(ctx))),
    /** POST /api/analysis/reach: CMS/native admission with a machine pool. */
    reach: wrap((ctx) => reach(strapi, requestBody(ctx))),
  }
}
