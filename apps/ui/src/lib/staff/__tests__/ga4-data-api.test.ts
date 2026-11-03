import { createVerify, generateKeyPairSync } from "node:crypto"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  batchRunReports,
  Ga4Error,
  ga4Config,
  resetGa4TokenCache,
} from "../ga4-data-api"

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})
const serviceAccount = {
  type: "service_account",
  client_email: "reports@example.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
}

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "content-type": "application/json" },
  })

describe("ga4Config", () => {
  it("is off without a numeric property id or a usable credential", () => {
    expect(ga4Config({})).toBeNull()
    expect(
      ga4Config({
        GA4_PROPERTY_ID: "properties/1",
        GA4_CREDENTIALS_JSON: JSON.stringify(serviceAccount),
      })
    ).toBeNull()
    expect(ga4Config({ GA4_PROPERTY_ID: "1" })).toBeNull()
    expect(
      ga4Config({ GA4_PROPERTY_ID: "1", GA4_CREDENTIALS_JSON: "{nope" })
    ).toBeNull()
    expect(
      ga4Config({
        GA4_PROPERTY_ID: "1",
        GA4_CREDENTIALS_JSON: JSON.stringify({ type: "service_account" }),
      })
    ).toBeNull()
    expect(
      ga4Config({ GA4_PROPERTY_ID: "1", GA4_CREDENTIALS_FILE: "/missing.json" })
    ).toBeNull()
  })

  it("accepts raw or base64 JSON", () => {
    const raw = JSON.stringify(serviceAccount)
    expect(
      ga4Config({ GA4_PROPERTY_ID: "558992450", GA4_CREDENTIALS_JSON: raw })
        ?.credentials.type
    ).toBe("service_account")
    expect(
      ga4Config({
        GA4_PROPERTY_ID: "558992450",
        GA4_CREDENTIALS_JSON: Buffer.from(raw).toString("base64"),
      })?.propertyId
    ).toBe("558992450")
  })
})

describe("batchRunReports", () => {
  const config = ga4Config({
    GA4_PROPERTY_ID: "558992450",
    GA4_CREDENTIALS_JSON: JSON.stringify(serviceAccount),
  })!
  const fetchMock = vi.fn()

  beforeEach(() => {
    resetGa4TokenCache()
    vi.stubGlobal("fetch", fetchMock)
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("signs a read-only service-account assertion and reuses the token", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("oauth2")
        ? json({ access_token: "token-1", expires_in: 3600 })
        : json({ reports: [{ rows: [] }] })
    )
    await batchRunReports(config, [{}])
    await batchRunReports(config, [{}])

    const tokenCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes("oauth2")
    )
    expect(tokenCalls).toHaveLength(1)
    const body = new URLSearchParams(tokenCalls[0]![1].body as URLSearchParams)
    expect(body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer"
    )
    const [header, claims, signature] = body.get("assertion")!.split(".")
    const verifier = createVerify("RSA-SHA256")
    verifier.update(`${header}.${claims}`)
    expect(
      verifier.verify(publicKey, Buffer.from(signature!, "base64url"))
    ).toBe(true)
    const decoded = JSON.parse(Buffer.from(claims!, "base64url").toString())
    expect(decoded.scope).toBe(
      "https://www.googleapis.com/auth/analytics.readonly"
    )
    expect(decoded.iss).toBe(serviceAccount.client_email)

    const [reportUrl, reportInit] = fetchMock.mock.calls.at(-1)!
    expect(reportUrl).toBe(
      "https://analyticsdata.googleapis.com/v1beta/properties/558992450:batchRunReports"
    )
    expect(reportInit.headers.authorization).toBe("Bearer token-1")
    expect(reportInit.signal).toBeInstanceOf(AbortSignal)
  })

  it("tells quota exhaustion apart from other failures", async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("oauth2")
        ? json({ access_token: "t", expires_in: 3600 })
        : json({ error: { status: "RESOURCE_EXHAUSTED" } }, 429)
    )
    await expect(batchRunReports(config, [{}])).rejects.toMatchObject({
      kind: "quota",
    })

    fetchMock.mockImplementation(async (url: string) =>
      url.includes("oauth2")
        ? json({ access_token: "t", expires_in: 3600 })
        : json({ error: { status: "PERMISSION_DENIED" } }, 403)
    )
    await expect(batchRunReports(config, [{}])).rejects.toMatchObject({
      kind: "auth",
    })
  })

  it("fails closed when the token request is refused", async () => {
    fetchMock.mockResolvedValue(json({ error: "invalid_grant" }, 400))
    await expect(batchRunReports(config, [{}])).rejects.toBeInstanceOf(Ga4Error)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
