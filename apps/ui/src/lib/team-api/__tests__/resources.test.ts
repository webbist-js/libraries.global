import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { GET as jobResultRoute } from "@/app/api/v1/analysis/jobs/[id]/result/route"
import { GET as jobStatus } from "@/app/api/v1/analysis/jobs/[id]/route"
import { POST as reachRoute } from "@/app/api/v1/analysis/reach/route"
import { POST as summaryRoute } from "@/app/api/v1/analysis/summary/route"
import { GET as listServices } from "@/app/api/v1/services/route"
import { GET as proposalStatus } from "@/app/api/v1/submissions/[id]/route"
import { POST as proposeCorrection } from "@/app/api/v1/submissions/corrections/route"
import { BillingError } from "@/lib/billing/config"

import { maintainApiJobs } from "../analysis-jobs"
import { isTeamApiPath, teamApiMethod } from "../paths"
import { ApiRefusal } from "../store"
import type * as StoreModule from "../store"
import { fakeJobsPool } from "./fake-jobs-pool"

type FakeJobs = ReturnType<typeof fakeJobsPool>

const { find, reserve, finish, active, jobs, credits } = vi.hoisted(() => ({
  find: vi.fn(),
  reserve: vi.fn(),
  finish: vi.fn(),
  active: vi.fn(),
  jobs: { current: null as null | FakeJobs },
  credits: { reserve: vi.fn(), settle: vi.fn(), refund: vi.fn() },
}))
vi.mock("../store", async (original) => ({
  ...(await original<typeof StoreModule>()),
  findApiKey: find,
  reserveApiRequest: reserve,
  finishApiRequest: finish,
}))
vi.mock("../team", () => ({ checkApiTeamActive: active }))
vi.mock("../analysis", () => ({
  reserveAnalysis: credits.reserve,
  settleAnalysis: credits.settle,
  refundAnalysis: credits.refund,
}))
vi.mock("@/lib/auth", () => ({
  get authDbPool() {
    return jobs.current!.pool
  },
}))

const secret = `lg_api_${"a".repeat(43)}`
const TEAM = "team00000000000000000001"
const OTHER = "team00000000000000000002"
const KEY = "0f8fad5b-d9cb-469f-a165-70867728950e"
const entityRef = "europe:united-kingdom:england:bristol:central-library"
const serviceRef = "network00000000000000001"
const call = (
  path: string,
  init: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {}
) =>
  new Request(`https://libraries.global${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(init.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
      ...init.headers,
    },
    body:
      init.body === undefined
        ? undefined
        : typeof init.body === "string"
          ? init.body
          : JSON.stringify(init.body),
  })
const params = <T>(value: T) => ({ params: Promise.resolve(value) })
let fetcher: ReturnType<typeof vi.fn<typeof fetch>>
const cms = (status: number, body: unknown) =>
  fetcher.mockResolvedValueOnce(Response.json(body, { status }))
const reachBody = { mode: "library", ref: entityRef, travelMode: "walking" }
const ready = {
  state: "ready",
  result: {
    mode: "library",
    ref: entityRef,
    contours: [],
    geometry: "included",
  },
}

function signIn(team = TEAM) {
  find.mockResolvedValue({ id: KEY, team_id: team, created_by: "organiser" })
}

beforeEach(() => {
  vi.resetAllMocks()
  jobs.current = fakeJobsPool()
  for (const flag of [
    "API_SERVICE_READS_ENABLED",
    "API_SUBMISSIONS_ENABLED",
    "API_ANALYSIS_ENABLED",
  ])
    vi.stubEnv(flag, "true")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "bridge-fixture")
  signIn()
  active.mockResolvedValue(undefined)
  reserve.mockImplementation(async (_p, key) => ({
    id: "request",
    teamId: key.team_id,
    keyId: key.id,
    periodStart: "2026-11-03T09:30:00.000Z",
    budget: 131_072,
    credits: 0,
    remaining: { requests: 999, bytes: 5000, credits: 100 },
    resetsAt: "2026-12-03T09:30:00.000Z",
  }))
  finish.mockResolvedValue(true)
  credits.reserve.mockImplementation(async (_t, jobId, n) => ({
    jobId,
    state: "reserved",
    credits: n,
    resetsAt: "",
  }))
  credits.settle.mockResolvedValue("settled")
  credits.refund.mockResolvedValue("refunded")
  fetcher = vi.fn<typeof fetch>()
  vi.stubGlobal("fetch", fetcher)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("flags", () => {
  it("a disabled resource is not callable and does no key or ledger work", async () => {
    vi.stubEnv("API_SERVICE_READS_ENABLED", "false")
    const response = await listServices(
      call("/api/v1/services"),
      undefined as never
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({
      error: { code: "resource_not_enabled" },
    })
    expect(find).not.toHaveBeenCalled()
    expect(reserve).not.toHaveBeenCalled()
  })
  it("an enabled flag still requires a key", async () => {
    const response = await listServices(
      new Request("https://libraries.global/api/v1/services"),
      undefined as never
    )
    expect(response.status).toBe(401)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("network Reach stays off without its own flag, before any credit", async () => {
    const response = await reachRoute(
      call("/api/v1/analysis/reach", {
        method: "POST",
        body: { mode: "network", ref: serviceRef, travelMode: "walking" },
      }),
      undefined as never
    )
    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe("analysis_mode_unavailable")
    expect(credits.reserve).not.toHaveBeenCalled()
    expect(fetcher).not.toHaveBeenCalled()
  })
})

describe("authorisation and accounting", () => {
  it("refuses revoked keys and lapsed coverage before any upstream call", async () => {
    find.mockRejectedValueOnce(new BillingError("invalid_api_key", 401))
    expect(
      (await listServices(call("/api/v1/services"), undefined as never)).status
    ).toBe(401)
    reserve.mockRejectedValueOnce(new BillingError("api_access_inactive", 403))
    expect(
      (await listServices(call("/api/v1/services"), undefined as never)).status
    ).toBe(403)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("passes each route's own scope to the ledger and refuses the wrong one", async () => {
    reserve.mockRejectedValueOnce(
      new ApiRefusal("api_scope_refused", 403, null)
    )
    const response = await reachRoute(
      call("/api/v1/analysis/reach", { method: "POST", body: reachBody }),
      undefined as never
    )
    expect(response.status).toBe(403)
    expect(reserve.mock.calls[0]?.[3]).toBe("analysis:run")
    expect(credits.reserve).not.toHaveBeenCalled()
    cms(200, { data: [], meta: {} })
    await listServices(call("/api/v1/services"), undefined as never)
    expect(reserve.mock.calls[1]?.[3]).toBe("services:read")
  })
  it("never lets one customer read another's job", async () => {
    cms(200, { state: "pending" })
    const accepted = await reachRoute(
      call("/api/v1/analysis/reach", { method: "POST", body: reachBody }),
      undefined as never
    )
    const { job } = await accepted.json()
    signIn(OTHER)
    for (const route of [jobStatus, jobResultRoute]) {
      const response = await route(
        call(`/api/v1/analysis/jobs/${job.id}`),
        params({ id: job.id })
      )
      expect(response.status).toBe(404)
    }
  })
  it("rejects excessive bodies before the bridge", async () => {
    const big = call("/api/v1/submissions/corrections", {
      method: "POST",
      headers: { "Idempotency-Key": "client-key-0001" },
      body: JSON.stringify({ target: entityRef, pad: "x".repeat(20_000) }),
    })
    expect((await proposeCorrection(big, undefined as never)).status).toBe(413)
    const reach = call("/api/v1/analysis/reach", {
      method: "POST",
      body: { ...reachBody, ref: "x".repeat(3000) },
    })
    expect((await reachRoute(reach, undefined as never)).status).toBe(413)
    expect(fetcher).not.toHaveBeenCalled()
    expect(credits.reserve).not.toHaveBeenCalled()
  })
})

describe("submissions", () => {
  const correction = {
    target: entityRef,
    changes: { phone: "0117 111" },
    evidence: {
      type: "institutional_url",
      url: "https://bristol.gov.uk/x",
      licence: "OGL-UK-3.0",
      sourceName: "Bristol City Council",
    },
  }
  it("requires an idempotency key and refuses protected fields locally", async () => {
    const missing = await proposeCorrection(
      call("/api/v1/submissions/corrections", {
        method: "POST",
        body: correction,
      }),
      undefined as never
    )
    expect((await missing.json()).error.code).toBe("idempotency_key_required")
    const protectedField = await proposeCorrection(
      call("/api/v1/submissions/corrections", {
        method: "POST",
        headers: { "Idempotency-Key": "client-key-0001" },
        body: { ...correction, changes: { entityRef: "a:b" } },
      }),
      undefined as never
    )
    expect(protectedField.status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it("forwards the account and key, never a person, and reports replays", async () => {
    cms(200, {
      data: { id: "submission000000000000001", status: "in_review" },
      replayed: true,
    })
    const response = await proposeCorrection(
      call("/api/v1/submissions/corrections", {
        method: "POST",
        headers: { "Idempotency-Key": "client-key-0001" },
        body: correction,
      }),
      undefined as never
    )
    expect(response.status).toBe(200)
    expect((await response.json()).meta).toMatchObject({
      replayed: true,
      trust: "untrusted_proposal",
    })
    const sent = JSON.parse(String(fetcher.mock.calls[0]![1]!.body))
    expect(sent).toMatchObject({
      account: TEAM,
      keyId: KEY,
      idempotencyKey: "client-key-0001",
      kind: "correction",
    })
    expect(JSON.stringify(sent)).not.toContain("organiser")
  })
  it("passes documented conflicts through and hides others", async () => {
    cms(409, {
      error: {
        code: "duplicate_proposal",
        proposalId: "submission000000000000002",
        note: "x",
      },
    })
    const dup = await proposeCorrection(
      call("/api/v1/submissions/corrections", {
        method: "POST",
        headers: { "Idempotency-Key": "client-key-0002" },
        body: correction,
      }),
      undefined as never
    )
    expect(dup.status).toBe(409)
    expect(await dup.json()).toEqual({
      error: {
        code: "duplicate_proposal",
        proposalId: "submission000000000000002",
      },
    })
    cms(500, { error: { code: "internal_stack_trace" } })
    const hidden = await proposeCorrection(
      call("/api/v1/submissions/corrections", {
        method: "POST",
        headers: { "Idempotency-Key": "client-key-0003" },
        body: correction,
      }),
      undefined as never
    )
    expect(hidden.status).toBe(502)
    expect(await hidden.text()).not.toContain("internal_stack_trace")
  })
  it("looks up status only for the authenticated account", async () => {
    cms(404, { error: { code: "not_found" } })
    const response = await proposalStatus(
      call("/api/v1/submissions/submission000000000000001"),
      params({ id: "submission000000000000001" })
    )
    expect(response.status).toBe(404)
    expect(String(fetcher.mock.calls[0]![0])).toContain(`account=${TEAM}`)
  })
})

describe("analysis jobs", () => {
  const accept = () =>
    reachRoute(
      call("/api/v1/analysis/reach", { method: "POST", body: reachBody }),
      undefined as never
    )
  it("reserves credits at acceptance and returns 202 with a job", async () => {
    cms(200, { state: "pending" })
    const response = await accept()
    expect(response.status).toBe(202)
    const { job } = await response.json()
    expect(job).toMatchObject({
      state: "pending",
      credits: { reserved: 5, charge: "reserved" },
    })
    expect(credits.reserve).toHaveBeenCalledWith(TEAM, job.id, 5)
    expect(credits.settle).not.toHaveBeenCalled()
  })
  it("a replay reuses the open job instead of charging again", async () => {
    cms(200, { state: "pending" })
    const first = await (await accept()).json()
    const second = await (await accept()).json()
    expect(second.job.id).toBe(first.job.id)
    expect(credits.reserve).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it("a cached result settles zero credits but still meters delivery", async () => {
    cms(200, ready)
    const response = await accept()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.job).toMatchObject({ cached: true, credits: { spent: 0 } })
    expect(credits.settle).toHaveBeenCalledWith(body.job.id, { credits: 0 })
    expect(finish.mock.calls[0]?.[2]).toMatchObject({ status: 200 })
  })
  it("refuses at the credit quota edge without starting work", async () => {
    credits.reserve.mockRejectedValueOnce(
      new ApiRefusal("quota_analysis", 429, 60)
    )
    const response = await accept()
    expect(response.status).toBe(429)
    expect((await response.json()).error.code).toBe("quota_analysis")
    expect(fetcher).not.toHaveBeenCalled()
    expect(jobs.current!.rows).toHaveLength(0)
  })
  it("refunds a failed job and reports it", async () => {
    cms(200, { state: "unavailable", reason: "unroutable" })
    const response = await accept()
    expect(response.status).toBe(422)
    const body = await response.json()
    expect(body.error.code).toBe("analysis_unroutable")
    expect(credits.refund).toHaveBeenCalledTimes(1)
    expect(jobs.current!.rows[0]).toMatchObject({
      state: "failed",
      charge: "refunded",
    })
  })
  it("refunds when the CMS is unreachable", async () => {
    fetcher.mockRejectedValueOnce(new Error("down"))
    const response = await accept()
    expect(response.status).toBe(502)
    expect(credits.refund).toHaveBeenCalledTimes(1)
  })
  it("settles once on completion, and result fetches never charge again", async () => {
    cms(200, { state: "pending" })
    const { job } = await (await accept()).json()
    jobs.current!.rows[0]!.checked_at = new Date(Date.now() - 10_000)
    cms(200, ready)
    const status = await (
      await jobStatus(
        call(`/api/v1/analysis/jobs/${job.id}`),
        params({ id: job.id })
      )
    ).json()
    expect(status.job).toMatchObject({
      state: "complete",
      cached: false,
      credits: { spent: 5 },
    })
    expect(credits.settle).toHaveBeenCalledWith(job.id, { credits: 5 })
    for (let n = 0; n < 2; n++) {
      const result = await jobResultRoute(
        call(`/api/v1/analysis/jobs/${job.id}/result`),
        params({ id: job.id })
      )
      expect(result.status).toBe(200)
    }
    expect(credits.settle).toHaveBeenCalledTimes(1)
    expect(credits.reserve).toHaveBeenCalledTimes(1)
    expect(reserve.mock.calls.every((args) => !args[5]?.analysisCredits)).toBe(
      true
    )
  })
  it("does not deliver a result whose credits were already refunded", async () => {
    cms(200, { state: "pending" })
    const { job } = await (await accept()).json()
    jobs.current!.rows[0]!.checked_at = new Date(Date.now() - 10_000)
    credits.settle.mockResolvedValueOnce("refunded")
    cms(200, ready)
    const response = await jobResultRoute(
      call(`/api/v1/analysis/jobs/${job.id}/result`),
      params({ id: job.id })
    )
    expect(response.status).toBe(410)
    expect(jobs.current!.rows[0]).toMatchObject({
      state: "expired",
      result: null,
    })
  })
  it("expires an abandoned job and refunds exactly once", async () => {
    cms(200, { state: "pending" })
    await accept()
    jobs.current!.rows[0]!.expires_at = new Date(Date.now() - 1000)
    expect(await maintainApiJobs(jobs.current!.pool)).toBe(1)
    expect(await maintainApiJobs(jobs.current!.pool)).toBe(0)
    expect(credits.refund).toHaveBeenCalledTimes(1)
    expect(jobs.current!.rows[0]).toMatchObject({
      state: "expired",
      charge: "refunded",
    })
  })
  it("caps open jobs per customer", async () => {
    for (let n = 0; n < 5; n++) {
      cms(200, { state: "pending" })
      await reachRoute(
        call("/api/v1/analysis/reach", {
          method: "POST",
          body: {
            ...reachBody,
            minutes: [5, 10, 15, 30][n % 4],
            travelMode: n < 4 ? "walking" : "cycling",
          },
        }),
        undefined as never
      )
    }
    const sixth = await reachRoute(
      call("/api/v1/analysis/reach", {
        method: "POST",
        body: { ...reachBody, travelMode: "cycling", minutes: 10 },
      }),
      undefined as never
    )
    expect(sixth.status).toBe(429)
    expect((await sixth.json()).error.code).toBe("analysis_queue_full")
    expect(credits.reserve).toHaveBeenCalledTimes(5)
  })
  it("rejects polygons, coordinates and memberships in Reach input", async () => {
    for (const extra of [
      { polygon: [[0, 0]] },
      { lat: 1, lng: 2 },
      { libraries: [entityRef] },
    ]) {
      const response = await reachRoute(
        call("/api/v1/analysis/reach", {
          method: "POST",
          body: { ...reachBody, ...extra },
        }),
        undefined as never
      )
      expect(response.status).toBe(400)
    }
    expect(credits.reserve).not.toHaveBeenCalled()
  })
  it("charges summary variants their own credits and reuses identical results", async () => {
    const body = { operation: "service.coverage", ref: serviceRef }
    cms(200, { data: { libraries: 3 }, meta: {} })
    const first = await summaryRoute(
      call("/api/v1/analysis/summary", { method: "POST", body }),
      undefined as never
    )
    expect(first.status).toBe(200)
    expect(credits.reserve.mock.calls[0]?.[2]).toBe(5)
    const again = await (
      await summaryRoute(
        call("/api/v1/analysis/summary", { method: "POST", body }),
        undefined as never
      )
    ).json()
    expect(again.meta.cached).toBe(false)
    expect(credits.reserve).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(1)
    cms(200, { data: { libraries: 3 }, meta: {} })
    await summaryRoute(
      call("/api/v1/analysis/summary", {
        method: "POST",
        body: {
          operation: "place.profile",
          place: { country: "united-kingdom" },
        },
      }),
      undefined as never
    )
    expect(credits.reserve.mock.calls[1]?.[2]).toBe(1)
  })
  it("refunds a failed summary", async () => {
    cms(503, { error: { code: "analysis_unavailable" } })
    const response = await summaryRoute(
      call("/api/v1/analysis/summary", {
        method: "POST",
        body: { operation: "service.profile", ref: serviceRef },
      }),
      undefined as never
    )
    expect(response.status).toBe(503)
    expect(credits.refund).toHaveBeenCalledTimes(1)
    expect(credits.settle).not.toHaveBeenCalled()
  })
})

describe("machine paths", () => {
  it("recognises the new routes with their single method", () => {
    expect(teamApiMethod("/api/v1/services")).toBe("GET")
    expect(teamApiMethod(`/api/v1/services/${serviceRef}/libraries`)).toBe(
      "GET"
    )
    expect(teamApiMethod("/api/v1/submissions/libraries")).toBe("POST")
    expect(teamApiMethod("/api/v1/analysis/reach")).toBe("POST")
    expect(
      teamApiMethod(`/api/v1/analysis/jobs/reach:${"a".repeat(22)}/result`)
    ).toBe("GET")
    expect(isTeamApiPath("/api/v1/services/../admin")).toBe(false)
    expect(isTeamApiPath("/api/v1/analysis/jobs/anything")).toBe(false)
  })
})
