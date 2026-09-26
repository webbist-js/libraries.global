import { type APIRequestContext, expect, request, test } from "@playwright/test"

import {
  emailFor,
  FIXTURE_PASSWORD,
  retryAfterMs,
} from "../../helpers/seed-access-fixtures"

// Needs `pnpm seed:access` first. The seed waits out the UI's 60 s session
// cache whenever it changes a fixture that may already have been read.

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

// Better Auth allows 5 sign-ins per minute per IP and this file does 6, so
// one test may wait out a 429. Give every test room for that.
test.describe.configure({ timeout: 150_000 })

async function signIn(api: APIRequestContext, baseURL: string, key: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await api.post("/api/auth/sign-in/email", {
      data: { email: emailFor(key), password: FIXTURE_PASSWORD },
      headers: { Origin: baseURL },
    })
    if (res.status() !== 429) return res
    await new Promise((r) =>
      setTimeout(r, retryAfterMs(res.headers()["x-retry-after"]))
    )
  }
  throw new Error(`sign-in for ${key} stayed rate-limited`)
}

test.describe("access role matrix (API)", () => {
  test("anonymous: no session, gated routes refuse with 401", async ({
    baseURL,
  }) => {
    const api = await request.newContext({ baseURL })
    const s = await (await api.get("/api/auth/get-session")).json()
    expect(s?.user ?? null).toBeNull()
    expect((await api.get(`/api/contribute/wiki/${DOC_SLUG}`)).status()).toBe(
      401
    )
    expect((await api.post("/api/upload", { multipart: {} })).status()).toBe(
      401
    )
  })

  for (const row of MATRIX) {
    test(`${row.key}: session capabilities and route gates match`, async ({
      baseURL,
    }) => {
      const api = await request.newContext({ baseURL })
      const signInRes = await signIn(api, baseURL!, row.key)
      expect(signInRes.ok()).toBe(true)

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
    const api = await request.newContext({ baseURL })
    expect((await signIn(api, baseURL!, "reader")).ok()).toBe(true)
    const res = await api.post(`/api/contribute/wiki/${DOC_SLUG}`, {
      data: { draftData: { body: [] } },
    })
    expect(res.status()).toBe(403)
  })
})
