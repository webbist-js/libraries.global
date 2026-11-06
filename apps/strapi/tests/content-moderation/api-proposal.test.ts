import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock(
  "../../src/plugins/content-moderation/server/services/submission",
  () => ({
    resolveSubmissionLocale: async (_s: unknown, locale: unknown) =>
      typeof locale === "string" ? locale : "en",
  })
)

import createController from "../../src/plugins/content-moderation/server/controllers/api-proposal"
import { isApiProposal } from "../../src/plugins/content-moderation/server/utils/api-proposals"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"

const account = "team00000000000000000001"
const keyId = "0f8fad5b-d9cb-469f-a165-70867728950e"
const entityRef = "europe:united-kingdom:england:bristol:central-library"
const evidence = {
  type: "institutional_url",
  url: "https://bristol.gov.uk/libraries/central",
  licence: "OGL-UK-3.0",
  sourceName: "Bristol City Council",
}
const correction = (changes: Record<string, unknown>, extra = {}) => ({
  account,
  keyId,
  idempotencyKey: "client-key-0001",
  kind: "correction",
  locale: "en",
  proposal: { target: entityRef, changes },
  evidence,
  ...extra,
})
const context = (
  body: unknown,
  secret = "fixture",
  params = {},
  query = {}
) => ({
  request: { header: { "x-service-secret": secret }, body },
  params,
  query,
  set: vi.fn(),
  unauthorized: vi.fn(),
  status: 200,
  body: undefined as any,
})

const library = {
  documentId: "library00000000000000001",
  slug: "central-library",
  name: "Central Library",
  phone: "0117 000",
  location: { lat: 51.45, lng: -2.59 },
}

function runtime(
  options: { submissions?: any[]; counts?: number; safe?: boolean } = {}
) {
  const submissions = options.submissions ?? []
  const create = vi.fn(async (data: any) => ({
    documentId: "submission000000000000001",
    createdAt: "2026-11-06T00:00:00.000Z",
    ...data,
  }))
  const events = vi.fn(async () => ({}))
  const findSubmissions = vi.fn(async ({ filters }: any) =>
    submissions.filter((row) =>
      Object.entries(filters).every(([key, cond]: [string, any]) =>
        cond?.$eq !== undefined
          ? row[key] === cond.$eq
          : cond?.$in
            ? cond.$in.includes(row[key])
            : true
      )
    )
  )
  const strapi = {
    documents: (uid: string) => {
      if (uid === "plugin::content-moderation.submission")
        return {
          findMany: findSubmissions,
          count: vi.fn(async () => options.counts ?? 0),
        }
      if (uid === "plugin::content-moderation.review-event")
        return { create: events }
      if (uid === "api::library.library")
        return { findMany: vi.fn(async () => [library]) }

      return { findMany: vi.fn(async () => []) }
    },
    plugin: () => ({
      service: (name: string) =>
        name === "submission"
          ? { create }
          : { checkContent: async () => ({ ok: options.safe ?? true }) },
    }),
  }

  return { strapi, create, events, findSubmissions }
}

beforeEach(() => vi.stubEnv("STRAPI_BRIDGE_SECRET", "fixture"))
afterEach(() => vi.unstubAllEnvs())

describe("API proposal intake", () => {
  it("requires the bridge secret", async () => {
    const { strapi, create } = runtime()
    const ctx = context(correction({ phone: "0117 111" }), "wrong")
    await createController({ strapi }).create(ctx)
    expect(ctx.unauthorized).toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })

  it("files an untrusted pending proposal with account, key, licence and history", async () => {
    const { strapi, create, events } = runtime()
    const ctx = context(correction({ phone: "0117 111" }))
    await createController({ strapi }).create(ctx)
    expect(ctx.status).toBe(201)
    const data = create.mock.calls[0]![0]
    expect(data).toMatchObject({
      submissionType: "correction",
      targetDocumentId: library.documentId,
      submittedByUserId: `api:${account}`,
      apiAccountId: account,
      apiKeyId: keyId,
      idempotencyKey: "client-key-0001",
      sourceLicence: "OGL-UK-3.0",
      fields: {
        kind: "record",
        phone: "0117 111",
        previous: { phone: "0117 000" },
      },
    })
    expect(data).not.toHaveProperty("asDraft")
    expect(data).not.toHaveProperty("requestedByStaff")
    expect(data).not.toHaveProperty("staffCreation")
    expect(isApiProposal(data)).toBe(true)
    expect(events).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toStatus: "pending",
        reviewerKind: "system",
      }),
    })
    expect(ctx.body.data).toMatchObject({
      status: "in_review",
      kind: "correction",
    })
    expect(JSON.stringify(ctx.body)).not.toContain(keyId)
  })

  it("refuses protected fields, relations and dotted CMS paths", async () => {
    const { strapi, create } = runtime()
    for (const [changes, code] of [
      [{ entityRef: "x:y" }, "field_not_allowed"],
      [{ sourceRecords: [] }, "field_not_allowed"],
      [{ verifiedSections: {} }, "field_not_allowed"],
      [{ country: "france" }, "field_not_allowed"],
      [{ "location.lat": 1 }, "field_path_refused"],
      [{ lat: 51 }, "invalid_field_value"],
      [{ website: "ftp://example.org/x" }, "invalid_field_value"],
      [{ operationalStatus: "deleted" }, "invalid_field_value"],
    ] as const) {
      const ctx = context(correction(changes))
      await createController({ strapi }).create(ctx)
      expect(ctx.status).toBe(400)
      expect(ctx.body.error.code).toBe(code)
    }
    expect(create).not.toHaveBeenCalled()
  })

  it("refuses identity and moderation keys in the body", async () => {
    const { strapi, create } = runtime()
    for (const extra of [
      { submittedByUserId: "ba-user" },
      { staffCreation: {} },
      { status: "approved" },
    ]) {
      const ctx = context(correction({ phone: "1" }, extra))
      await createController({ strapi }).create(ctx)
      expect(ctx.status).toBe(400)
    }
    expect(create).not.toHaveBeenCalled()
  })

  it("returns the original proposal on replay and refuses a changed payload", async () => {
    const built = {
      submissionType: "correction",
      targetEntityType: "library",
      targetDocumentId: library.documentId,
      targetSlug: library.slug,
      fields: {
        kind: "record",
        libraryName: library.name,
        phone: "0117 111",
        previous: { phone: "0117 000" },
      },
    }
    const existing = {
      documentId: "submission000000000000009",
      apiAccountId: account,
      idempotencyKey: "client-key-0001",
      payloadHash: payloadHash({ ...built, contentLocale: "en" }),
      submissionType: "correction",
      status: "pending",
      reviewNote: "internal reviewer note",
      reviewedByUserId: "moderator",
    }
    const { strapi, create } = runtime({ submissions: [existing] })
    const replay = context(correction({ phone: "0117 111" }))
    await createController({ strapi }).create(replay)
    expect(replay.status).toBe(200)
    expect(replay.body).toMatchObject({
      replayed: true,
      data: { id: existing.documentId },
    })
    expect(JSON.stringify(replay.body)).not.toContain("internal reviewer note")
    const changed = context(correction({ phone: "0117 222" }))
    await createController({ strapi }).create(changed)
    expect(changed.status).toBe(409)
    expect(changed.body.error.code).toBe("idempotency_conflict")
    expect(create).not.toHaveBeenCalled()
  })

  it("detects an open duplicate payload from the same account", async () => {
    const built = {
      submissionType: "correction",
      targetEntityType: "library",
      targetDocumentId: library.documentId,
      targetSlug: library.slug,
      fields: {
        kind: "record",
        libraryName: library.name,
        phone: "0117 111",
        previous: { phone: "0117 000" },
      },
    }
    const { strapi, create } = runtime({
      submissions: [
        {
          documentId: "submission000000000000007",
          apiAccountId: account,
          idempotencyKey: "another-key-001",
          payloadHash: payloadHash({ ...built, contentLocale: "en" }),
          status: "pending",
        },
      ],
    })
    const ctx = context(correction({ phone: "0117 111" }))
    await createController({ strapi }).create(ctx)
    expect(ctx.status).toBe(409)
    expect(ctx.body.error).toMatchObject({
      code: "duplicate_proposal",
      proposalId: "submission000000000000007",
    })
    expect(create).not.toHaveBeenCalled()
  })

  it("rate-limits writes per key and account", async () => {
    const { strapi, create } = runtime({ counts: 30 })
    const ctx = context(correction({ phone: "0117 111" }))
    await createController({ strapi }).create(ctx)
    expect(ctx.status).toBe(429)
    expect(create).not.toHaveBeenCalled()
  })

  it("shows status only to the submitting account, without notes or reviewers", async () => {
    const row = {
      documentId: "submission000000000000009",
      apiAccountId: account,
      submissionType: "correction",
      status: "rejected",
      reviewNote: "private reviewer reasoning",
      reviewedByUserId: "moderator-1",
      reviewedAt: "2026-11-06T01:00:00.000Z",
      contentLocale: "en",
    }
    const { strapi } = runtime({ submissions: [row] })
    const owner = context(
      undefined,
      "fixture",
      { id: row.documentId },
      { account }
    )
    await createController({ strapi }).status(owner)
    expect(owner.body.data).toMatchObject({
      status: "declined",
      decidedAt: row.reviewedAt,
    })
    expect(JSON.stringify(owner.body)).not.toMatch(
      /private reviewer|moderator-1/
    )
    const other = context(
      undefined,
      "fixture",
      { id: row.documentId },
      {
        account: "team00000000000000000002",
      }
    )
    await createController({ strapi }).status(other)
    expect(other.status).toBe(404)
    expect(other.body).toEqual({ error: { code: "not_found" } })
  })
})
