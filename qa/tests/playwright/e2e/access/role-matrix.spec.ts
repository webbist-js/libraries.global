import { type APIRequestContext, expect, request, test } from "@playwright/test"

import {
  emailFor,
  FIXTURE_PASSWORD,
  retryAfterMs,
} from "../../helpers/access-fixtures"

// Local only, opt-in: run with `pnpm playwright-access-tests` after
// `pnpm seed:access`. The seed waits out the UI's 60 s session cache
// whenever it changes a fixture that may already have been read.

const ALL_SIGNED_IN = [
  "submit.correction",
  "submit.newLibrary",
  "submit.claim",
  "submit.docSuggestion",
  "submit.journalPitch",
  "submit.topicSuggestion",
]

const MATRIX = [
  { key: "reader", extra: [], directEdit: false },
  { key: "contributor", extra: [], directEdit: false },
  {
    key: "librarian",
    extra: ["submit.libraryEdit", "events.feed"],
    directEdit: false,
  },
  { key: "wiki-editor", extra: ["docs.directEdit"], directEdit: true },
  { key: "editorial", extra: ["docs.directEdit"], directEdit: true },
] as const

// Any existing docs slug works for the gate check; the GET only reads a draft.
const DOC_SLUG = process.env.ACCESS_DOC_SLUG || "how-to-contribute"

// Better Auth allows 5 sign-ins per minute per IP. This file signs in 5
// times, but back-to-back runs share the window, so a test may wait out a
// 429. Give every test room for that.
test.describe.configure({ timeout: 150_000 })

const SIGN_IN_ATTEMPTS = 3

async function signIn(api: APIRequestContext, baseURL: string, key: string) {
  for (let attempt = 1; attempt <= SIGN_IN_ATTEMPTS; attempt++) {
    const res = await api.post("/api/auth/sign-in/email", {
      data: { email: emailFor(key), password: FIXTURE_PASSWORD },
      headers: { Origin: baseURL },
    })
    if (res.status() !== 429) return res
    if (attempt === SIGN_IN_ATTEMPTS) break
    const wait = retryAfterMs(res.headers()["x-retry-after"])
    await new Promise((r) => setTimeout(r, wait))
  }
  throw new Error(`sign-in for ${key} stayed rate-limited`)
}

// One signed-in context per fixture, created on first use and shared, so the
// reader's matrix row and the bypass test cost a single sign-in. If a failure
// restarts the worker, the next test simply signs in again.
const contexts = new Map<string, APIRequestContext>()

async function signedIn(baseURL: string, key: string) {
  const cached = contexts.get(key)
  if (cached) return cached
  const api = await request.newContext({ baseURL })
  const res = await signIn(api, baseURL, key)
  if (!res.ok()) {
    await api.dispose()
    throw new Error(`sign-in for ${key} failed: ${res.status()}`)
  }
  contexts.set(key, api)

  return api
}

test.afterAll(async () => {
  await Promise.all(Array.from(contexts.values(), (api) => api.dispose()))
  contexts.clear()
})

test.describe("access role matrix (API)", () => {
  test("anonymous: no session, gated routes refuse with 401", async ({
    baseURL,
  }) => {
    const api = await request.newContext({ baseURL })
    try {
      const s = await (await api.get("/api/auth/get-session")).json()
      expect(s?.user ?? null).toBeNull()
      expect((await api.get(`/api/contribute/wiki/${DOC_SLUG}`)).status()).toBe(
        401
      )
      expect((await api.post("/api/upload", { multipart: {} })).status()).toBe(
        401
      )
    } finally {
      await api.dispose()
    }
  })

  for (const row of MATRIX) {
    test(`${row.key}: session capabilities and route gates match`, async ({
      baseURL,
    }) => {
      const api = await signedIn(baseURL!, row.key)

      const { user } = await (await api.get("/api/auth/get-session")).json()
      expect(user.profileLoaded).toBe(true)
      expect([...user.capabilities].sort()).toEqual(
        [...ALL_SIGNED_IN, ...row.extra].sort()
      )
      expect(user.plan).toBe("free")
      expect(user.features).toEqual([])
      // Money never buys trust, and trust never shows up as a plan.
      expect(user).not.toHaveProperty("subscription")

      const wiki = await api.get(`/api/contribute/wiki/${DOC_SLUG}`)
      if (row.directEdit) expect(wiki.status()).toBe(200)
      else expect(wiki.status()).toBe(403)

      const upload = await api.post("/api/upload", { multipart: {} })
      // Allowed callers get past the gate and fail validation (400); others get 403.
      expect(upload.status()).toBe(row.directEdit ? 400 : 403)
    })
  }

  test("server refuses a reader's direct wiki edit even if the UI is bypassed", async ({
    baseURL,
  }) => {
    const api = await signedIn(baseURL!, "reader")
    const res = await api.post(`/api/contribute/wiki/${DOC_SLUG}`, {
      data: { draftData: { body: [] } },
    })
    expect(res.status()).toBe(403)
  })
})
