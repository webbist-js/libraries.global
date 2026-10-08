import { afterEach, describe, expect, it, vi } from "vitest"

import createModerationController from "../../src/plugins/content-moderation/server/controllers/moderation"
import contentApiRoutes from "../../src/plugins/content-moderation/server/routes/content-api"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import { AFFILIATION_UID } from "../../src/utils/staff"
import { makeFakeStrapi } from "../helpers/fake-strapi"

/**
 * `GET /moderation/staff/:libraryDocumentId`: who has staff access at a
 * library, for a Moderator reviewing an access report. Same scope as
 * removal (`index` or every queue); 404 for an unknown or unpublished
 * library so ids can't be probed.
 */

const LIBRARY = "api::library.library"
const ROLE = "api::role-grant.role-grant"
const SUBMISSION = "plugin::content-moderation.submission"
const SECRET = "test-bridge-secret"
const ID = "library000000000000000001"
const UNPUBLISHED = "library000000000000000002"
const memberId = (user: string) => `member${user}`.padEnd(24, "0")

const library = {
  documentId: ID,
  name: "Central",
  slug: "central",
  libraryType: "Public",
  publishedAt: "2026-01-01T00:00:00.000Z",
  continent: { slug: "europe" },
  country: { slug: "united-kingdom" },
  region: { slug: "england" },
}
const affiliation = (
  user: string,
  staffRole: "owner" | "editor" | null,
  over: Record<string, unknown> = {}
) => ({
  documentId: memberId(user),
  baUserId: user,
  staffRole,
  createdAt: "2026-01-01T00:00:00.000Z",
  approvedAt: "2026-01-05T00:00:00.000Z",
  role: "Librarian",
  source: "claim",
  library: { documentId: ID },
  ...over,
})
const grant = (baUserId: string, queue: string) => ({
  documentId: `grant${baUserId}${queue}`.padEnd(24, "0"),
  baUserId,
  role: "moderator",
  queue,
  scopeLocale: null,
  expiresAt: null,
})

function setup() {
  const fake = makeFakeStrapi({
    [LIBRARY]: [
      library,
      { ...library, documentId: UNPUBLISHED, slug: "draft", publishedAt: null },
    ],
    [AFFILIATION_UID]: [
      affiliation("owner", "owner"),
      affiliation("modindex", "editor", {
        source: "team",
        createdAt: "2026-02-01T00:00:00.000Z",
        approvedAt: null,
      }),
      affiliation("proposer", null, { role: "proposer" }),
      affiliation("elsewhere", "owner", {
        library: { documentId: UNPUBLISHED },
      }),
    ],
    [ROLE]: [grant("modindex", "index"), grant("modknowledge", "knowledge")],
    [SUBMISSION]: [],
  })
  fake.services["content-moderation.submission-policy"] = createPolicy({
    strapi: fake.strapi,
  })
  fake.services["access.people"] = {
    namesOf: vi.fn(
      async (ids: string[]) =>
        new Map(
          ids.filter((id) => id !== "owner").map((id) => [id, `Name ${id}`])
        )
    ),
  }
  vi.stubEnv("STRAPI_BRIDGE_SECRET", SECRET)
  const controller: any = createModerationController({ strapi: fake.strapi })
  const ctx = (viewer: string, libraryDocumentId: unknown) => ({
    params: { libraryDocumentId },
    request: {
      headers: {
        "x-service-secret": SECRET,
        "x-ba-user-id": viewer,
        "x-ba-user-email": `${viewer}@example.org`,
      },
    },
    status: 200,
    body: undefined as any,
    set: vi.fn(),
  })

  return { ...fake, controller, ctx }
}

afterEach(() => vi.unstubAllEnvs())

describe("GET /moderation/staff/:libraryDocumentId", () => {
  it("is registered as a public content-api route next to the removal", () => {
    expect(contentApiRoutes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          method: "GET",
          path: "/moderation/staff/:libraryDocumentId",
          handler: "moderation.staffList",
          config: expect.objectContaining({ auth: false }),
        }),
        expect.objectContaining({
          method: "POST",
          path: "/moderation/staff/:affiliationDocumentId/remove",
          handler: "moderation.removeStaff",
        }),
      ])
    )
  })

  it("403 for a Moderator outside the index queue, 400 for a bad id, 404 for an unknown or unpublished library", async () => {
    const { controller, ctx } = setup()
    const knowledge = ctx("modknowledge", ID)
    await controller.staffList(knowledge)
    expect(knowledge.status).toBe(403)

    const bad = ctx("modindex", "not-an-id")
    await controller.staffList(bad)
    expect(bad.status).toBe(400)

    const missing = ctx("modindex", "library000000000000000009")
    await controller.staffList(missing)
    expect(missing.status).toBe(404)

    const draft = ctx("modindex", UNPUBLISHED)
    await controller.staffList(draft)
    expect(draft.status).toBe(404)
    expect(draft.body).toEqual(missing.body)
  })

  it("401 without the bridge secret and user", async () => {
    const { controller, ctx } = setup()
    const c = ctx("modindex", ID)
    delete (c.request.headers as any)["x-service-secret"]
    await controller.staffList(c)
    expect(c.status).toBe(401)
  })

  it("lists the library's staff with level, source and date, proposers left out, and the caller's own row not removable", async () => {
    const { controller, ctx } = setup()
    const c = ctx("modindex", ID)
    await controller.staffList(c)

    expect(c.status).toBe(200)
    expect(c.set).toHaveBeenCalledWith("Cache-Control", "no-store")
    expect(c.body).toEqual({
      data: {
        library: {
          documentId: ID,
          name: "Central",
          path: "/europe/united-kingdom/england/central",
        },
        staff: [
          {
            affiliationDocumentId: memberId("owner"),
            // No profile name known: a neutral label, never the email.
            name: "Library staff",
            staffRole: "owner",
            source: "claim",
            approvedAt: "2026-01-05T00:00:00.000Z",
            canRemove: true,
          },
          {
            affiliationDocumentId: memberId("modindex"),
            name: "Name modindex",
            staffRole: "editor",
            source: "team",
            // No approval date: the row's creation stands in.
            approvedAt: "2026-02-01T00:00:00.000Z",
            canRemove: false,
          },
        ],
      },
    })
    expect(JSON.stringify(c.body)).not.toContain("@example.org")
    expect(JSON.stringify(c.body)).not.toContain("proposer")
  })

  it("lists a claim whose role is NULL (no job title), as listStaff does", async () => {
    const { controller, ctx, store, strapi } = setup()
    store[AFFILIATION_UID]!.push(
      affiliation("untitled", "editor", {
        role: null,
        createdAt: "2026-03-01T00:00:00.000Z",
      })
    )
    // The fake's `$ne` is JS `!==`, which a NULL role passes. SQL's `<>` is
    // not true for NULL, so a row filtered that way is dropped here the way
    // the database drops it: only the shared claim filter keeps it.
    const fresh = strapi.documents
    strapi.documents = vi.fn((uid: string) => {
      const api = fresh(uid)
      if (uid !== AFFILIATION_UID) return api
      const { findMany } = api
      api.findMany = vi.fn(async (q: any = {}) => {
        const rows = await findMany(q)

        return q.filters?.role?.$ne === undefined
          ? rows
          : rows.filter((r: any) => r.role !== null && r.role !== undefined)
      })

      return api
    })

    const c = ctx("modindex", ID)
    await controller.staffList(c)

    expect(c.status).toBe(200)
    expect(c.body.data.staff.map((s: any) => s.affiliationDocumentId)).toEqual([
      memberId("owner"),
      memberId("modindex"),
      memberId("untitled"),
    ])
    expect(c.body.data.staff.at(-1)).toMatchObject({
      name: "Name untitled",
      staffRole: "editor",
      source: "claim",
      approvedAt: "2026-01-05T00:00:00.000Z",
      canRemove: true,
    })
    expect(JSON.stringify(c.body)).not.toContain("proposer")
  })

  it("a global Moderator reads it too; the path is null when the hierarchy is incomplete", async () => {
    const { controller, ctx, store } = setup()
    store[ROLE]!.push(grant("modall", "all"))
    store[LIBRARY]![0]!.region = null
    const c = ctx("modall", ID)
    await controller.staffList(c)

    expect(c.status).toBe(200)
    expect(c.body.data.library.path).toBeNull()
    expect(c.body.data.staff.every((s: any) => s.canRemove)).toBe(true)
  })
})
