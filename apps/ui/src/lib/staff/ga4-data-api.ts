import "server-only"
import { createSign } from "node:crypto"
import { readFileSync } from "node:fs"

/**
 * A minimal, server-only GA4 Data API client: a read-only credential, a
 * cached access token and `batchRunReports`. Plain `fetch` rather than
 * Google's gRPC SDK, so nothing heavy reaches the Next.js bundle.
 *
 * Configuration (all server-side, never `NEXT_PUBLIC_`):
 * - `GA4_PROPERTY_ID`: the numeric property id.
 * - `GA4_CREDENTIALS_JSON`: the credential JSON, raw or base64. A service
 *   account with Viewer access to the property is the production identity;
 *   an `authorized_user` file (gcloud ADC) works for local checks.
 * - `GA4_CREDENTIALS_FILE`: a path to the same JSON, instead of the above.
 */

const SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const API = "https://analyticsdata.googleapis.com/v1beta"
const TIMEOUT_MS = 10_000

type ServiceAccount = {
  type: "service_account"
  client_email: string
  private_key: string
  token_uri?: string
}
type AuthorizedUser = {
  type: "authorized_user"
  client_id: string
  client_secret: string
  refresh_token: string
  token_uri?: string
}

export type Ga4Credentials = ServiceAccount | AuthorizedUser
export type Ga4Config = { propertyId: string; credentials: Ga4Credentials }

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value : null

function parseCredentials(raw: string): Ga4Credentials | null {
  const source = raw.trim()
  let json: unknown
  try {
    json = JSON.parse(
      source.startsWith("{")
        ? source
        : Buffer.from(source, "base64").toString("utf8")
    )
  } catch {
    return null
  }
  if (!json || typeof json !== "object") return null
  const value = json as Record<string, unknown>
  const tokenUri = text(value.token_uri) ?? undefined
  if (
    value.type === "service_account" &&
    text(value.client_email) &&
    text(value.private_key)
  )
    return {
      type: "service_account",
      client_email: value.client_email as string,
      private_key: value.private_key as string,
      token_uri: tokenUri,
    }
  if (
    value.type === "authorized_user" &&
    text(value.client_id) &&
    text(value.client_secret) &&
    text(value.refresh_token)
  )
    return {
      type: "authorized_user",
      client_id: value.client_id as string,
      client_secret: value.client_secret as string,
      refresh_token: value.refresh_token as string,
      token_uri: tokenUri,
    }

  return null
}

/** The configured property and credential, or null when reporting is off. */
export function ga4Config(
  env: Record<string, string | undefined> = process.env
): Ga4Config | null {
  const propertyId = env.GA4_PROPERTY_ID?.trim()
  if (!propertyId || !/^\d{1,20}$/.test(propertyId)) return null
  let raw = env.GA4_CREDENTIALS_JSON
  if (!raw?.trim() && env.GA4_CREDENTIALS_FILE?.trim()) {
    try {
      raw = readFileSync(env.GA4_CREDENTIALS_FILE.trim(), "utf8")
    } catch {
      return null
    }
  }
  const credentials = raw ? parseCredentials(raw) : null

  return credentials ? { propertyId, credentials } : null
}

const base64url = (value: string | Buffer) =>
  Buffer.from(value).toString("base64url")

function signedAssertion(account: ServiceAccount, audience: string) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SCOPE,
      aud: audience,
      iat: now,
      exp: now + 3600,
    })
  )
  const signer = createSign("RSA-SHA256")
  signer.update(`${header}.${claims}`)

  return `${header}.${claims}.${base64url(signer.sign(account.private_key))}`
}

let cachedToken: { key: string; token: string; expiresAt: number } | null = null

const credentialKey = (credentials: Ga4Credentials) =>
  credentials.type === "service_account"
    ? `sa:${credentials.client_email}`
    : `user:${credentials.client_id}`

async function accessToken(credentials: Ga4Credentials): Promise<string> {
  const key = credentialKey(credentials)
  if (cachedToken?.key === key && cachedToken.expiresAt > Date.now())
    return cachedToken.token
  const tokenUrl = credentials.token_uri ?? TOKEN_URL
  const body =
    credentials.type === "service_account"
      ? new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: signedAssertion(credentials, tokenUrl),
        })
      : new URLSearchParams({
          grant_type: "refresh_token",
          client_id: credentials.client_id,
          client_secret: credentials.client_secret,
          refresh_token: credentials.refresh_token,
        })
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const json = (await response.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
  } | null
  if (!response.ok || !json?.access_token)
    throw new Ga4Error("auth", `token request failed (${response.status})`)
  cachedToken = {
    key,
    token: json.access_token,
    // Renew a minute early.
    expiresAt: Date.now() + Math.max(60, (json.expires_in ?? 3600) - 60) * 1000,
  }

  return json.access_token
}

export class Ga4Error extends Error {
  constructor(
    readonly kind: "auth" | "quota" | "error",
    message: string
  ) {
    super(`GA4 Data API: ${message}`)
  }
}

/** One Data API report, as much of it as the traffic summary reads. */
export type Ga4Report = {
  dimensionHeaders?: { name: string }[]
  metricHeaders?: { name: string }[]
  rows?: {
    dimensionValues?: { value?: string }[]
    metricValues?: { value?: string }[]
  }[]
  metadata?: {
    timeZone?: string
    subjectToThresholding?: boolean
    dataLossFromOtherRow?: boolean
    samplingMetadatas?: unknown[]
  }
}

/** Up to five reports in one call (one quota request). Throws `Ga4Error`. */
export async function batchRunReports(
  config: Ga4Config,
  requests: Record<string, unknown>[]
): Promise<Ga4Report[]> {
  const token = await accessToken(config.credentials)
  const response = await fetch(
    `${API}/properties/${config.propertyId}:batchRunReports`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ requests }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }
  )
  if (response.status === 401) cachedToken = null
  const json = (await response.json().catch(() => null)) as {
    reports?: Ga4Report[]
    error?: { status?: string }
  } | null
  if (response.status === 429 || json?.error?.status === "RESOURCE_EXHAUSTED")
    throw new Ga4Error("quota", "quota exhausted")
  if (response.status === 401 || response.status === 403)
    throw new Ga4Error("auth", `not authorised (${response.status})`)
  if (!response.ok || !Array.isArray(json?.reports))
    throw new Ga4Error("error", `report failed (${response.status})`)

  return json.reports
}

/** Test seam: forget the cached access token. */
export function resetGa4TokenCache() {
  cachedToken = null
}
