import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getSession = vi.fn()
const fetchMock = vi.fn()

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }))

vi.stubEnv("STRAPI_URL", "http://strapi.test")
vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")

const { POST } = await import("../route")

type Submission = {
  submissionType: string
  status: string
  targetSlug?: string | null
}

let mine: Submission[] = []

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/profile/me/claim-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  )

let userSeq = 0
const signIn = () => {
  userSeq += 1
  getSession.mockResolvedValue({
    user: {
      id: `user-${userSeq}`,
      email: `u${userSeq}@example.org`,
      emailVerified: false,
      name: "Reader",
    },
    session: { id: "s1" },
  })
}

const calledPath = (suffix: string) =>
  fetchMock.mock.calls.some(([url]) => String(url).includes(suffix))

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  mine = []
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("/auth-bridge/claim-status"))
      return Response.json({ claimedLibraryEntityRef: null })
    if (url.includes("/content-moderation/submissions/my"))
      return Response.json({ data: mine })
    if (url.includes("/auth-bridge/affiliation-count"))
      return Response.json({ count: 0 })
    if (url.includes("/content-moderation/submissions"))
      return Response.json({ data: { documentId: "sub1" } })

    return new Response("unexpected", { status: 500 })
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const CLAIM = { libraryEntityRef: "GB-BL-001", libraryName: "British Library" }

describe("POST /api/profile/me/claim-library", () => {
  it("returns 401 when signed out", async () => {
    getSession.mockResolvedValue(null)

    expect((await post(CLAIM)).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("files a moderated claim when nothing is pending", async () => {
    signIn()

    const res = await post(CLAIM)

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      status: "pending",
      method: "contact_us",
    })
    expect(calledPath("/content-moderation/submissions/my")).toBe(true)
  })

  it.each(["pending", "needs_info"])(
    "refuses with 409 while a %s claim for the library is open",
    async (status) => {
      signIn()
      mine = [
        { submissionType: "library_claim", status, targetSlug: "GB-BL-001" },
      ]

      const res = await post(CLAIM)

      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ error: "claim_pending" })
      expect(calledPath("/auth-bridge/affiliation-count")).toBe(false)
    }
  )

  it.each([
    [
      "a rejected claim",
      {
        submissionType: "library_claim",
        status: "rejected",
        targetSlug: "GB-BL-001",
      },
    ],
    [
      "a pending claim for another library",
      {
        submissionType: "library_claim",
        status: "pending",
        targetSlug: "GB-BL-002",
      },
    ],
    [
      "a pending correction",
      {
        submissionType: "correction",
        status: "pending",
        targetSlug: "GB-BL-001",
      },
    ],
  ])("does not count %s", async (_label, submission) => {
    signIn()
    mine = [submission]

    expect((await post(CLAIM)).status).toBe(200)
  })

  it("still files the claim when the listing can't be read", async () => {
    signIn()
    const answer = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes("/submissions/my")
        ? new Response("boom", { status: 500 })
        : answer(url, init)
    )

    expect((await post(CLAIM)).status).toBe(200)
  })

  it("returns 429 on the 31st call in a minute from one user", async () => {
    signIn()
    for (let i = 0; i < 30; i++) expect((await post(CLAIM)).status).toBe(200)

    const res = await post(CLAIM)

    expect(res.status).toBe(429)
    expect(res.headers.get("retry-after")).toBeTruthy()
  })
})
