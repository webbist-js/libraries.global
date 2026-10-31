import { afterEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import bridge from "../src/api/auth-bridge/controllers/auth-bridge"

const PROFILE = "api::user-profile.user-profile"
const OWNED = "plugin::content-moderation.submission-upload"
const FILE = "plugin::upload.file"

async function save(
  fields: Record<string, unknown>,
  owners = [{ fileId: 7, baUserId: "owner" }],
  mime = "image/png"
) {
  const fake = makeFakeStrapi({
    [PROFILE]: [
      {
        documentId: "profile-owner",
        baUserId: "owner",
        profileBackground: "violet",
        coverImage: 2,
      },
    ],
    [OWNED]: owners,
    [FILE]: [{ id: 7, mime }],
  })
  ;(globalThis as any).strapi = { ...fake.strapi, query: fake.strapi.db.query }
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "appearance-test-secret")
  const ctx: any = {
    request: {
      header: { "x-service-secret": "appearance-test-secret" },
      body: { baUserId: "owner", ...fields },
    },
    send: (body: unknown) => {
      ctx.status = 200
      ctx.body = body
    },
    badRequest: () => {
      ctx.status = 400
    },
    forbidden: () => {
      ctx.status = 403
    },
  }
  await bridge.upsertProfile(ctx)

  return { ctx, profile: fake.store[PROFILE]![0]! }
}

afterEach(() => {
  vi.unstubAllEnvs()
  delete (globalThis as any).strapi
})

describe("profile appearance writes", () => {
  it.each(["light", "dark", "system"])(
    "persists a private interface preference: %s",
    async (appearancePreference) => {
      const result = await save({ appearancePreference })
      expect(result.ctx.status).toBe(200)
      expect(result.profile.appearancePreference).toBe(appearancePreference)
      expect(result.profile.profileBackground).toBe("violet")
    }
  )
  it.each(["auto", "Dark", null, {}])(
    "rejects invalid interface preferences: %s",
    async (appearancePreference) => {
      const result = await save({ appearancePreference })
      expect(result.ctx.status).toBe(400)
      expect(result.profile.appearancePreference).toBeUndefined()
    }
  )
  it("persists a palette choice without changing the uploaded cover", async () => {
    const result = await save({ profileBackground: "mint" })
    expect(result.ctx.status).toBe(200)
    expect(result.profile.profileBackground).toBe("mint")
    expect(result.profile.coverImage).toBe(2)
  })
  it.each(["url(javascript:alert(1))", "unknown", null, { hue: 25 }])(
    "rejects arbitrary backgrounds before a write: %s",
    async (value) => {
      const result = await save({ profileBackground: value })
      expect(result.ctx.status).toBe(400)
      expect(result.profile.profileBackground).toBe("violet")
    }
  )
  it("attaches an owned raster image and clears its relation without deleting media", async () => {
    const attached = await save({ coverImageFileId: 7 })
    expect(attached.ctx.status).toBe(200)
    expect(attached.profile.coverImage).toBe(7)
    const cleared = await save({ coverImageFileId: null })
    expect(cleared.ctx.status).toBe(200)
    expect(cleared.profile.coverImage).toBeNull()
  })
  it.each(["coverImageFileId", "avatarFileId"])(
    "refuses another member's media for %s",
    async (field) => {
      const result = await save({ [field]: 7 }, [
        { fileId: 7, baUserId: "someone-else" },
      ])
      expect(result.ctx.status).toBe(403)
      expect(result.profile.coverImage).toBe(2)
    }
  )
  it("refuses non-image media even when owned", async () => {
    expect(
      (await save({ coverImageFileId: 7 }, undefined, "image/svg+xml")).ctx
        .status
    ).toBe(400)
  })
})
