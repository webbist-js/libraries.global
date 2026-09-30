import { beforeEach, describe, expect, it, vi } from "vitest"

import submissionControllerFactory, {
  resetStatsCache,
} from "../../src/plugins/content-moderation/server/controllers/submission"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const SUB = "plugin::content-moderation.submission"
const LIB = "api::library.library"
const PROFILE = "api::user-profile.user-profile"
const COUNTRY = "api::country.country"
const LANG = "profile.language-entry"

function harness() {
  const today = new Date().toISOString()
  const made = makeFakeStrapi(
    {
      [SUB]: [
        { documentId: "s1", status: "pending", createdAt: today },
        { documentId: "s2", status: "draft", createdAt: today },
        {
          documentId: "s3",
          status: "approved",
          createdAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      [LIB]: [{ documentId: "l1" }, { documentId: "l2" }],
      [PROFILE]: [{ documentId: "p1" }],
      [COUNTRY]: [{ documentId: "c1" }],
      [LANG]: [
        { documentId: "e1", code: "en" },
        { documentId: "e2", code: "en" },
        { documentId: "e3", code: "fr" },
      ],
    },
    { tables: { components_profile_language_entries: LANG } }
  )
  const perUid = new Map<string, any>()
  const fresh = made.strapi.documents
  made.strapi.documents = vi.fn((uid: string) => {
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })
  const ctx = () => ({ body: undefined as any, set: vi.fn() })

  return {
    ...made,
    ctx,
    controller: submissionControllerFactory({ strapi: made.strapi }),
  }
}

describe("stats", () => {
  beforeEach(() => resetStatsCache())

  it("counts through the Document Service from a UTC day start and caches for a minute", async () => {
    const { strapi, ctx, controller } = harness()
    const c1 = ctx()
    await controller.stats(c1)
    expect(c1.body.data).toEqual({
      submissionsToday: 1,
      indexedLibraries: 2,
      totalContributors: 1,
      totalCountries: 1,
      totalLanguages: 2,
    })
    expect(c1.set).toHaveBeenCalledWith("Cache-Control", "public, max-age=60")
    const subCount = strapi.documents(SUB).count.mock.calls[0]?.[0]
    expect(subCount.filters.createdAt.$gte).toBe(
      `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
    )

    const c2 = ctx()
    await controller.stats(c2)
    expect(c2.body.data).toEqual(c1.body.data)
    expect(strapi.documents(SUB).count).toHaveBeenCalledTimes(1)
    expect(strapi.db.query).not.toHaveBeenCalled()
  })
})
