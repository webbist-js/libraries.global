import { type APIRequestContext, expect, request, test } from "@playwright/test"

import { signIn } from "../../helpers/access-fixtures"

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

// One row per way of holding a plan (see FIXTURES). Every plan fixture is a
// reader with no claims, so apart from its plan it must look like the reader.
const PLAN_MATRIX = [
  {
    key: "reader",
    plan: "free",
    planSource: "none",
    canExport: false,
    exportRows: 0,
  },
  {
    key: "pro-grant",
    plan: "pro",
    planSource: "grant",
    canExport: true,
    exportRows: 10_000,
  },
  {
    key: "pro-earned",
    plan: "pro",
    planSource: "earned",
    canExport: true,
    exportRows: 10_000,
  },
  {
    key: "pro-verified",
    plan: "pro",
    planSource: "verified",
    canExport: true,
    exportRows: 10_000,
  },
  {
    key: "team",
    plan: "team",
    planSource: "grant",
    canExport: true,
    exportRows: 50_000,
  },
] as const

// Any existing docs slug works for the gate check; the GET only reads a draft.
const DOC_SLUG = process.env.ACCESS_DOC_SLUG || "how-to-contribute"

// /api/submissions has no capability pre-check: it forwards the body to
// Strapi as the signed-in user, so these requests reach the submission
// policy, which stays authoritative. A wiki_edit whose draftData carries
// `body` is a direct edit (docs.directEdit); without it, it's a suggestion
// (submit.docSuggestion). asDraft keeps an accepted one out of the queue.
const wikiEdit = (extra: Record<string, unknown>) => ({
  submissionType: "wiki_edit",
  targetEntityType: "wiki_article",
  targetSlug: DOC_SLUG,
  asDraft: true,
  ...extra,
})

// Better Auth allows 5 sign-ins per minute per IP. This file signs in once
// per fixture (9 times), and onboarding.spec.ts 3 more. The access project
// runs one worker, so the files take turns, and signIn waits out each 429:
// a cold run of the whole project waits out the limit about twice, so it
// takes roughly 2 to 3 minutes. Back-to-back runs share the window, so a
// test may wait out a 429 twice. Give every test room for that.
test.describe.configure({ timeout: 150_000 })

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

// The export probe needs one real library. The atlas feed is a GeoJSON
// FeatureCollection whose features carry the library's documentId as
// properties.id, which is what the export takes. Read once per worker.
let atlasLibraryId: string | undefined

async function oneAtlasLibraryId(api: APIRequestContext): Promise<string> {
  if (atlasLibraryId) return atlasLibraryId
  const res = await api.get("/api/public-proxy/api/libraries/atlas")
  expect(res.status()).toBe(200)
  const feed = (await res.json()) as {
    features?: { properties?: { id?: unknown } }[]
  }
  const id = feed.features?.[0]?.properties?.id
  if (typeof id !== "string" || !/^[a-z0-9]{20,32}$/.test(id))
    throw new Error("The atlas feed has no library documentId to export")
  atlasLibraryId = id

  return id
}

const exportBody = (ids: string[]) => ({ format: "csv", ids })

/**
 * The records of an RFC 4180 CSV. Each ends with CRLF, except a CRLF inside
 * a quoted cell (an address can hold one), which belongs to the cell.
 */
function csvRecords(csv: string): string[] {
  const records: string[] = []
  let start = 0
  let quoted = false
  for (let i = 0; i < csv.length; i++) {
    if (csv[i] === '"') quoted = !quoted
    else if (!quoted && csv.startsWith("\r\n", i)) {
      records.push(csv.slice(start, i))
      start = i + 2
      i++
    }
  }
  if (start < csv.length) records.push(csv.slice(start))

  return records
}

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
      const exported = await api.post("/api/export/atlas", {
        data: exportBody([await oneAtlasLibraryId(api)]),
      })
      expect(exported.status()).toBe(401)
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

  test("the Next route gate refuses a reader's direct wiki edit", async ({
    baseURL,
  }) => {
    const api = await signedIn(baseURL!, "reader")
    const res = await api.post(`/api/contribute/wiki/${DOC_SLUG}`, {
      data: { draftData: { body: [] } },
    })
    expect(res.status()).toBe(403)
  })

  test("Strapi refuses a reader's direct wiki edit sent past the UI", async ({
    baseURL,
  }) => {
    const api = await signedIn(baseURL!, "reader")
    const res = await api.post("/api/submissions", {
      data: wikiEdit({ draftData: { body: [] } }),
    })
    expect(res.status()).toBe(403)
    // The submission policy's refusal, passed through unchanged by Next.
    expect((await res.json())?.error?.message).toBe(
      "You can't submit this type of change."
    )
  })

  test("Strapi still lets a reader suggest a docs change", async ({
    baseURL,
  }) => {
    const api = await signedIn(baseURL!, "reader")
    const res = await api.post("/api/submissions", {
      data: wikiEdit({
        fields: { category: "Other", proposal: "Access E2E probe" },
      }),
    })
    // Past the capability check. Each run saves one draft, so many runs in
    // an hour can meet the reader's hourly quota (429), which is fine here.
    expect(res.status()).not.toBe(403)
    expect([200, 429]).toContain(res.status())
  })
})

test.describe("access plan matrix (API)", () => {
  for (const row of PLAN_MATRIX) {
    test(`${row.key}: plan ${row.plan} (${row.planSource}), export ${
      row.canExport ? "allowed" : "refused"
    }`, async ({ baseURL }) => {
      const api = await signedIn(baseURL!, row.key)

      const { user } = await (await api.get("/api/auth/get-session")).json()
      expect(user.profileLoaded).toBe(true)
      expect(user.plan).toBe(row.plan)
      expect(user.planSource).toBe(row.planSource)
      expect(user.features.includes("atlas.export")).toBe(row.canExport)
      expect(user.limits.exportRows).toBe(row.exportRows)

      const res = await api.post("/api/export/atlas", {
        data: exportBody([await oneAtlasLibraryId(api)]),
      })
      if (row.canExport) {
        expect(res.status()).toBe(200)
        expect(res.headers()["content-type"]).toContain("text/csv")
        const body = await res.body()
        // A UTF-8 byte-order mark, the header row, then exactly one data
        // row: the one library asked for. A header-only file fails here.
        expect(body.subarray(0, 3).toString("hex")).toBe("efbbbf")
        const records = csvRecords(body.subarray(3).toString("utf8"))
        expect(records[0]).toMatch(/^name,slug,/)
        expect(records).toHaveLength(2)
        expect(records[1]).toMatch(/[^,]/)
      } else {
        expect(res.status()).toBe(402)
        expect(await res.json()).toMatchObject({ feature: "atlas.export" })
      }
    })
  }

  test("money never buys trust: every paid plan has the reader's access", async ({
    baseURL,
  }) => {
    // With Strapi down every session is a reader with no capabilities, so
    // they'd all match. A loaded profile and the reader's full signed-in set
    // rule that out.
    const trustOf = async (key: string) => {
      const api = await signedIn(baseURL!, key)
      const { user } = await (await api.get("/api/auth/get-session")).json()
      expect(user.profileLoaded, key).toBe(true)

      return {
        contributorRole: user.contributorRole,
        capabilities: [...user.capabilities].sort(),
      }
    }
    const reader = await trustOf("reader")
    expect(reader).toEqual({
      contributorRole: "reader",
      capabilities: [...ALL_SIGNED_IN].sort(),
    })
    for (const row of PLAN_MATRIX.filter((r) => r.plan !== "free"))
      expect(await trustOf(row.key), row.key).toEqual(reader)
  })
})
