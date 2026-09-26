import type {
  EventProvider,
  EventType,
  LibraryHint,
  ProviderCredentials,
  RawEvent,
} from "./types"
import { safeFetch } from "../lib/safe-fetch"

const MAX_EVENTS = 5000
const MAX_PAGES = 50
const _EVENTS_TIMEOUT_MS = 20000

const EVENT_TYPE_MAP: Record<string, EventType> = {
  storytime: "storytime",
  "book club": "book_club",
  talk: "talk",
  lecture: "talk",
  workshop: "workshop",
  exhibition: "exhibition",
  tour: "tour",
  film: "screening",
  screening: "screening",
  performance: "performance",
  "drop-in": "drop_in",
  other: "other",
}

function makeAuthString(
  customerKey: string,
  username: string,
  password: string,
  institutionID: string,
  locationCode: string
): string {
  return `${customerKey}:${username}:${password}:${institutionID}:${locationCode}`
}

function buildBaseUrl(endpoint: string): string {
  return endpoint.endsWith("/") ? endpoint : `${endpoint}/`
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Token cache: authString → { token, expires } */
const tokenCache = new Map<string, { token: string; expires: number }>()

async function getAuthToken(
  baseUrl: string,
  authString: string
): Promise<string> {
  const cacheKey = Buffer.from(authString).toString("base64")
  const cached = tokenCache.get(cacheKey)

  if (cached && cached.expires > Date.now() + 10 * 60 * 1000) {
    return cached.token
  }

  const res = await safeFetch(`${baseUrl}lcf/1.0/authorization`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(authString).toString("base64")}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Spydus auth failed (${res.status}): ${body}`)
  }

  const data = await res.json()
  const token = data?.Access_Token as string | undefined
  if (!token) throw new Error("Spydus auth: missing Access_Token in response")

  tokenCache.set(cacheKey, { token, expires: Date.now() + 2 * 60 * 60 * 1000 })

  return token
}

function buildHeaders(
  token: string,
  institutionID: string,
  locationCode: string
): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-Institution-ID": institutionID,
    "X-Location-Code": locationCode,
  }
}

async function fetchSessions(
  baseUrl: string,
  token: string,
  institutionID: string,
  locationCode: string
): Promise<any[]> {
  const headers = buildHeaders(token, institutionID, locationCode)
  const all: any[] = []
  let params: Record<string, string> | undefined
  let pageCount = 0

  while (all.length < MAX_EVENTS && pageCount < MAX_PAGES) {
    pageCount++

    const url = new URL(`${baseUrl}events/1.0/sessions/search`)
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    }

    const res = await safeFetch(url.toString(), { headers })
    if (!res.ok) throw new Error(`Spydus sessions/search ${res.status}`)

    const data = await res.json()
    const records: any[] = data?.records ?? []
    const setInfo = data?.setInfo ?? {}

    if (!records.length) break

    const valid = records.filter((r) => r?.record?.format === "EVSES")
    all.push(...valid)

    const hasMore = Boolean(setInfo.hasMoreRecords)
    if (!hasMore || !setInfo.setId || !setInfo.lastIrn) break

    params = { setId: String(setInfo.setId), lastIrn: String(setInfo.lastIrn) }
    await sleep(250)
  }

  // Deduplicate by irn
  const seen = new Map<string, any>()
  for (const wrapped of all) {
    const irn = wrapped?.record?.irn
    if (irn && !seen.has(irn)) seen.set(irn, wrapped)
  }

  return Array.from(seen.values())
}

function extractStartTime(record: any): string | null {
  const sdg = record?.sessionDetailsGroup
  if (!sdg) return null

  const raw: string | undefined =
    sdg.startDateTime ?? sdg.sessionDateTime ?? sdg.startDate ?? undefined
  if (!raw) return null

  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null

  return d.toISOString()
}

function extractEndTime(record: any): string | undefined {
  const sdg = record?.sessionDetailsGroup
  if (!sdg) return undefined

  const raw: string | undefined = sdg.endDateTime ?? sdg.endDate ?? undefined
  if (!raw) return undefined

  const d = new Date(raw)

  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function extractVenueName(record: any): string | undefined {
  return (
    record?.sessionDetailsGroup?.locationDetails?.locationName ??
    record?.sessionDetailsGroup?.location ??
    undefined
  )
}

function extractTitle(record: any): string {
  return (
    record?.sessionDetailsGroup?.eventTitle?.value ??
    record?.sessionDetailsGroup?.title ??
    record?.title ??
    "Untitled Event"
  )
}

export const spydusProvider: EventProvider = {
  name: "spydus",
  eventTypeMap: EVENT_TYPE_MAP,

  async test(credentials: ProviderCredentials) {
    const {
      endpoint,
      customerKey,
      username,
      password,
      institutionID,
      locationCode,
    } = credentials

    if (
      !endpoint ||
      !customerKey ||
      !username ||
      !password ||
      !institutionID ||
      !locationCode
    ) {
      return { ok: false, error: "Missing one or more Spydus credentials" }
    }

    try {
      const baseUrl = buildBaseUrl(endpoint)
      const authString = makeAuthString(
        customerKey,
        username,
        password,
        institutionID,
        locationCode
      )
      await getAuthToken(baseUrl, authString)

      return { ok: true }
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message }
    }
  },

  async fetch(
    credentials: ProviderCredentials,
    _hints: LibraryHint[]
  ): Promise<RawEvent[]> {
    const {
      endpoint,
      customerKey,
      username,
      password,
      institutionID,
      locationCode,
    } = credentials

    if (
      !endpoint ||
      !customerKey ||
      !username ||
      !password ||
      !institutionID ||
      !locationCode
    ) {
      throw new Error("Missing Spydus credentials")
    }

    const baseUrl = buildBaseUrl(endpoint)
    const authString = makeAuthString(
      customerKey,
      username,
      password,
      institutionID,
      locationCode
    )
    const token = await getAuthToken(baseUrl, authString)
    const sessions = await fetchSessions(
      baseUrl,
      token,
      institutionID,
      locationCode
    )

    const events: RawEvent[] = []

    for (const wrapped of sessions) {
      const record = wrapped?.record
      if (!record) continue

      const startTime = extractStartTime(record)
      if (!startTime) continue

      events.push({
        externalId: String(record.irn),
        title: extractTitle(record),
        description: (record.sessionDetailsGroup?.description ??
          record.description ??
          "") as string,
        url: (record._spydus?.publicUrl ?? "") as string,
        imageUrl: undefined,
        startTime,
        endTime: extractEndTime(record),
        allDay: false,
        timezone: "UTC",
        tags: [],
        isFree: true, // Library events via Spydus are typically free
        venueName: extractVenueName(record),
      })
    }

    return events
  },
}
