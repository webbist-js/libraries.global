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
  it("gives context management only to the live Board and only for Library/Drive contexts", async () => {
    const board = { key: "ba:board", name: "Board", capabilities: [] }
    const strapi = host({}, [{ role: "editorial_board", queue: "all" }])
    const authorize = discussionsHostConfig.authorizeContext!
    expect(
      await authorize({
        strapi,
        actor: board,
        target: { uid: "api::drive.drive", documentId: "drive" },
      })
    ).toBe("manage")
    expect(
      await authorize({
        strapi: host({}, []),
        actor: board,
        target: { uid: "api::drive.drive", documentId: "drive" },
      })
    ).toBe(false)
    expect(
      await authorize({
        strapi,
        actor: board,
        target: {
          uid: "api::blog-article.blog-article",
          documentId: "article",
        },
      })
    ).toBe(false)
    expect(
      await authorize({
        strapi: host({}, [{ role: "moderator", queue: "discussions" }]),
        actor: board,
        target: { uid: "api::drive.drive", documentId: "drive" },
      })
    ).toBe(false)
  })
  it("hides cancelled/draft Drives from members and rechecks Board access", async () => {
    const grants: any[] = [{ role: "editorial_board", queue: "all" }]
    const strapi = {
      documents: (uid: string) => ({
        findOne: async () => ({
          slug: "draft",
          title: "Private planning",
          status: "draft",
        }),
        findMany: async () => (uid.includes("role-grant") ? grants : []),
      }),
    }
    const target = { uid: "api::drive.drive", documentId: "draft" }
    const resolve = discussionsHostConfig.targets![target.uid]
    expect(await resolve(target, { strapi, actor: null })).toBeNull()
    expect(
      await resolve(target, {
        strapi,
        actor: { key: "ba:board", name: "Board" },
      })
    ).toMatchObject({ title: "Private planning", active: false })
    grants.length = 0
    expect(
      await resolve(target, {
        strapi,
        actor: { key: "ba:board", name: "Board" },
      })
    ).toBeNull()
  })
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
  it.each(["journal_editor", "wiki_editor"])(
    "keeps %s editing separate from discussion moderation",
    async (role) => {
      const actor = await discussionActor(
        host({ profileVisibility: "public", username: "writer" }, [
          { role, queue: "all" },
        ]),
        "writer"
      )
      expect(actor?.profile?.url).toBe("/profile/writer")
      expect(actor?.capabilities).not.toContain("moderate")
      expect(actor?.capabilities).not.toContain("sanction")
    }
  )
  it.each([
    ["editorial_board", "all", null, true, true],
    ["moderator", "discussions", null, true, true],
    ["moderator", "all", null, true, true],
    ["moderator", "discussions", "fr", true, false],
    ["moderator", "knowledge", null, false, false],
  ])(
    "projects discussion authority for %s / %s / %s",
    async (role, queue, scopeLocale, moderate, sanction) => {
      const strapi = host({ profileVisibility: "public", username: "editor" }, [
        { role, queue, scopeLocale },
      ])
      const actor = await discussionActor(strapi, "editor")
      expect(actor?.capabilities?.includes("moderate")).toBe(moderate)
      expect(actor?.capabilities?.includes("sanction")).toBe(sanction)
      for (const action of ["moderate", "sanction"] as const) {
        expect(
          await discussionsHostConfig.authorize!({
            strapi,
            actor,
            action,
            subject: { visibility: "public" },
            thread: { language: "fr" },
            recordLanguage: "fr",
          })
        ).toBe(action === "moderate" ? moderate : sanction)
      }
    }
  )
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
  it("projects fresh public bylines without leaking private identifiers or querying roles for anonymous authors", async () => {
    const documents = vi.fn(() => ({ findMany: async () => [] }))
    const profile = {
      username: "writer",
      profileVisibility: "public",
      baUserId: "private-user",
      documentId: "private-profile",
      profileBackground: "mint",
      avatar: {
        url: "/uploads/owned.webp",
        alternativeText: "Writer",
        provider_metadata: { secret: "private" },
      },
    }
    const strapi = { ...host(profile), documents }
    expect(await publicDiscussionAuthor("ba:writer", { strapi })).toEqual({
      name: "@writer",
      slug: "writer",
      url: "/profile/writer",
      avatar: { url: "/uploads/owned.webp", alternativeText: "Writer" },
      background: "mint",
    })
    expect(documents).toHaveBeenCalledWith("api::role-grant.role-grant")
    documents.mockClear()
    profile.profileVisibility = "private"
    expect(await publicDiscussionAuthor("ba:writer", { strapi })).toEqual({
      name: "Community member",
    })
    expect(documents).not.toHaveBeenCalled()
  })
  it("projects verified roles once each, gives Board membership precedence and honours revocation", async () => {
    const grants = [
      { role: "wiki_editor", queue: "all" },
      { role: "journal_editor", queue: "all" },
      { role: "moderator", queue: "discussions", scopeLocale: "fr" },
    ]
    const strapi = host(
      { username: "writer", profileVisibility: "public" },
      grants
    )
    expect(await publicDiscussionAuthor("ba:writer", { strapi })).toMatchObject(
      {
        badges: ["editor", "moderator"],
      }
    )
    grants.push({ role: "editorial_board", queue: "all" })
    expect(await publicDiscussionAuthor("ba:writer", { strapi })).toMatchObject(
      {
        badges: ["editorial_board"],
      }
    )
    grants.length = 0
    expect(
      await publicDiscussionAuthor("ba:writer", { strapi })
    ).not.toHaveProperty("badges")
  })
  it("tags only the published suggestion's actual proposer, independently of display names", async () => {
    const suggestion = {
      suggestedBy: "owner",
      publicationStatus: "published",
      status: "open",
    }
    const target = {
      uid: "plugin::content-moderation.option-suggestion",
      documentId: "suggestion",
    }
    const profile = { username: "shared-name", profileVisibility: "public" }
    const documents = vi.fn((uid: string) => ({
      findMany: async () => [],
      findOne: async () => (uid === target.uid ? suggestion : null),
    }))
    const strapi = { ...host(profile), documents }
    expect(
      await publicDiscussionAuthor("ba:owner", { strapi, target })
    ).toMatchObject({
      badges: ["suggested_this"],
    })
    expect(
      await publicDiscussionAuthor("ba:other", { strapi, target })
    ).not.toHaveProperty("badges")
    expect(
      await publicDiscussionAuthor("ba:owner", { strapi })
    ).not.toHaveProperty("badges")
    suggestion.publicationStatus = "pending"
    expect(
      await publicDiscussionAuthor("ba:owner", { strapi, target })
    ).not.toHaveProperty("badges")
    suggestion.publicationStatus = "published"
    suggestion.status = "removed"
    expect(
      await publicDiscussionAuthor("ba:owner", { strapi, target })
    ).not.toHaveProperty("badges")
    suggestion.status = "open"
    profile.profileVisibility = "private"
    documents.mockClear()
    expect(
      await publicDiscussionAuthor("ba:owner", { strapi, target })
    ).toEqual({ name: "Community member" })
    expect(documents).not.toHaveBeenCalled()
  })
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
