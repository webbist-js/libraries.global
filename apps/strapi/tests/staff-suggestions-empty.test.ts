import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import createStaff from "../src/plugins/content-moderation/server/services/staff"
import createSubmissions from "../src/plugins/content-moderation/server/services/submission"

/**
 * The Staff area's suggestions page with nothing waiting: `[]`, and no
 * profile lookup at all (Strapi refuses `limit: 0`, which an empty page
 * used to send).
 */

const LIB = "api::library.library"
const SUB = "plugin::content-moderation.submission"
const AFF = "api::library-affiliation.library-affiliation"
const PROFILE = "api::user-profile.user-profile"
const id = "library00000000000000001"
const viewer = {
  id: "staff",
  email: "staff@example.org",
  name: "Library staff",
}

function setup() {
  const f = makeFakeStrapi({
    [LIB]: [
      {
        documentId: id,
        name: "Central",
        slug: "central",
        locale: "en",
        publishedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    [AFF]: [
      {
        documentId: "affiliation0000000000001",
        baUserId: viewer.id,
        library: { documentId: id },
        role: "Librarian",
        staffRole: "owner",
        approvedAt: "2026-01-01",
      },
    ],
    [SUB]: [],
    [PROFILE]: [],
  })
  f.services["content-moderation.submission"] = createSubmissions({
    strapi: f.strapi,
  })
  const original = f.strapi.documents
  const profileQueries: unknown[] = []
  f.strapi.documents = vi.fn((uid: string) => {
    const api = original(uid)
    if (uid === PROFILE) {
      const findMany = api.findMany
      api.findMany = vi.fn(async (q: unknown) => {
        profileQueries.push(q)

        return findMany(q)
      })
    }

    return api
  })

  return { ...f, staff: createStaff({ strapi: f.strapi }), profileQueries }
}

describe("staff suggestions, empty page", () => {
  it("answers [] with the page meta and never asks for profiles", async () => {
    const { staff, profileQueries } = setup()
    const page = await staff.suggestions(viewer, id)

    expect(page).toEqual({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    })
    expect(profileQueries).toEqual([])
  })

  it("keeps the caller's own corrections off the page, so one of theirs alone is still empty", async () => {
    const { staff, store, profileQueries } = setup()
    store[SUB]!.push({
      documentId: "s0000000000000000000001",
      submissionType: "correction",
      status: "pending",
      submittedByUserId: viewer.id,
      targetDocumentId: id,
      fields: { kind: "record", summary: "Mine" },
      createdAt: "2026-01-03T00:00:00.000Z",
    })
    const page = await staff.suggestions(viewer, id, 2, 10)

    expect(page).toEqual({
      data: [],
      meta: { page: 2, pageSize: 10, total: 0 },
    })
    expect(profileQueries).toEqual([])
  })

  it("is 404 for a library the caller isn't staff of", async () => {
    const { staff } = setup()
    await expect(
      staff.suggestions(viewer, "library00000000000000002")
    ).rejects.toMatchObject({ status: 404, code: "not_found" })
  })
})
