import { afterEach, describe, expect, it, vi } from "vitest"

import {
  discussionActor,
  discussionsHostConfig,
  publicDiscussionAuthor,
} from "../src/utils/discussions-host"

function host(profile: any, grants: any[] = []) {
  return {
    db: { query: () => ({ findOne: async () => profile }) },
    documents: () => ({
      findMany: async () => grants,
      findOne: async () => null,
    }),
  }
}
afterEach(() => vi.unstubAllEnvs())

describe("Libraries Global discussion adapter", () => {
  it.each([
    ["es", "/en/journal/reports/story?contentLang=es"],
    ["fr", "/fr/journal/reports/story"],
  ])(
    "links an attached %s article through a supported interface locale",
    async (locale, url) => {
      const strapi = {
        documents: () => ({
          findOne: async () => ({
            title: "Story",
            slug: "story",
            locale,
            section: { slug: "reports" },
          }),
        }),
      }
      expect(
        await discussionsHostConfig.targets!["api::blog-article.blog-article"](
          {
            uid: "api::blog-article.blog-article",
            documentId: "story",
            locale,
          },
          { strapi, actor: null }
        )
      ).toEqual({ title: "Story", url })
    }
  )
  it("never trusts a forged identity header without the bridge secret", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "trusted-secret")
    expect(
      await discussionsHostConfig.identity!(
        {
          request: {
            headers: { "x-service-secret": "wrong", "x-ba-user-id": "owner" },
          },
        },
        { strapi: host({ username: "owner" }) }
      )
    ).toBeNull()
  })
  it("separates Journal editor permissions from discussion moderation", async () => {
    const actor = await discussionActor(
      host({ profileVisibility: "public", username: "writer" }, [
        { role: "journal_editor", queue: "all" },
      ]),
      "writer"
    )
    expect(actor?.profile?.url).toBe("/profile/writer")
    expect(actor?.capabilities).not.toContain("moderate")
  })
  it.each(["private", "limited"])(
    "does not expose a %s profile in live author projections",
    async (profileVisibility) => {
      const projection = await publicDiscussionAuthor("ba:writer", {
        strapi: host({
          username: "hidden",
          profileVisibility,
          baUserId: "writer",
        }),
      })
      expect(projection).toEqual({ name: "Community member" })
    }
  )
  it("honours live activity opt-out and deleted accounts", async () => {
    expect(
      await publicDiscussionAuthor("ba:writer", {
        strapi: host({
          username: "hidden",
          profileVisibility: "public",
          publicPrefs: { showActivity: false },
        }),
      })
    ).toEqual({ name: "Community member" })
    expect(await discussionActor(host(null), "deleted")).toBeNull()
  })
  it("rechecks live discussion grants and locale scope for moderation and private reads", async () => {
    const strapi = host({}, [
      { role: "moderator", queue: "discussions", scopeLocale: "fr" },
    ])
    const actor = {
      key: "ba:moderator",
      name: "Moderator",
      capabilities: ["moderate"] as const,
    }
    const authorize = discussionsHostConfig.authorize!
    expect(
      await authorize({
        strapi,
        actor: { ...actor, capabilities: ["moderate"] },
        action: "moderate",
        subject: {},
        thread: { language: "en" },
      })
    ).toBe(false)
    expect(
      await authorize({
        strapi,
        actor: { ...actor, capabilities: ["moderate"] },
        action: "moderate",
        subject: {},
        thread: { language: "fr" },
      })
    ).toBe(true)
    expect(
      await authorize({
        strapi,
        actor: { ...actor, capabilities: ["moderate"] },
        action: "read",
        subject: { visibility: "private" },
        thread: { language: "en" },
      })
    ).toBe(false)
    expect(
      await authorize({
        strapi: host({}, []),
        actor: { ...actor, capabilities: ["moderate"] },
        action: "moderate",
        subject: {},
        thread: { language: "fr" },
      })
    ).toBe(false)
  })
  it("does not let the thread language expand a scoped moderator's record authority", async () => {
    const strapi = host({}, [
      { role: "moderator", queue: "discussions", scopeLocale: "en" },
    ])
    const actor = {
      key: "ba:moderator",
      name: "Moderator",
      capabilities: ["moderate" as const],
    }
    expect(
      await discussionsHostConfig.authorize!({
        strapi,
        actor,
        action: "moderate",
        subject: { visibility: "public" },
        thread: { language: "en" },
        recordLanguage: "es",
      })
    ).toBe(false)
    expect(
      await discussionsHostConfig.authorize!({
        strapi,
        actor,
        action: "moderate",
        subject: { visibility: "public" },
        thread: { language: "es" },
        recordLanguage: "en",
      })
    ).toBe(true)
    expect(
      await discussionsHostConfig.authorize!({
        strapi,
        actor,
        action: "read",
        subject: { visibility: "private" },
        thread: { language: "en" },
        recordLanguage: "es",
      })
    ).toBe(false)
  })
  it("makes an attached article unavailable after unpublication", async () => {
    expect(
      await discussionsHostConfig.targets!["api::blog-article.blog-article"](
        { uid: "api::blog-article.blog-article", documentId: "story" },
        { strapi: host(null), actor: null }
      )
    ).toBeNull()
  })
})
