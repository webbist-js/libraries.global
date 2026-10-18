import { resolveCapabilities } from "@repo/access"
import { describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import createSubmission from "../src/plugins/content-moderation/server/services/submission"
import { applyArticleSubmission } from "../src/plugins/content-moderation/server/utils/article-apply"
import { payloadHash } from "../src/plugins/content-moderation/server/utils/payload-hash"
import { applyToPublished } from "../src/plugins/content-moderation/server/utils/publish-guard"
import { publicArticleProfile } from "../src/utils/article-attribution"
import { articleRevision } from "../src/utils/article-content"
import {
  publicEventMentions,
  pinArticleBase,
} from "../src/utils/article-relations"

const BLOG = "api::blog-article.blog-article"
const SUB = "plugin::content-moderation.submission"
const EVENT = "plugin::events.event"
const id = "article000000000000000001"
const body = (text: string) => [
  {
    __component: "content.rich-text",
    body: [{ type: "paragraph", children: [{ type: "text", text }] }],
  },
]
const base = {
  documentId: id,
  slug: "story",
  locale: "en",
  title: "Story",
  summary: "Summary",
  body: body("Published story"),
  authorProfile: { documentId: "profile00000000000000001" },
}
function harness(
  seed: Record<string, any[]>,
  role: "journal_editor" | "reader" = "journal_editor"
) {
  const fake = makeFakeStrapi({
    "api::user-profile.user-profile": [
      {
        documentId: "profile00000000000000001",
        baUserId: "writer",
        profileVisibility: "private",
      },
    ],
    ...seed,
  })
  const caps = resolveCapabilities({
    signedIn: true,
    grants: role === "reader" ? [] : [{ role, queue: "all", locale: null }],
    claims: [],
  })
  fake.strapi.plugin = (name: string) =>
    name === "i18n"
      ? {
          service: () => ({
            find: async () => [{ code: "en" }],
            getDefaultLocale: async () => "en",
          }),
        }
      : { service: () => ({ loadCapabilities: async () => ({ caps }) }) }

  return fake
}

describe("publication snapshots", () => {
  it.each(["body", "seo", "heroImage", "section"])(
    "does not publish unrelated draft %s",
    async (key) => {
      const published: any = {
        ...base,
        seo: { metaTitle: "Public" },
        heroImage: { id: 1 },
        section: { documentId: "section-one" },
      }
      const changes: any = {
        body: body("Unpublished text"),
        seo: { metaTitle: "Draft" },
        heroImage: { id: 2 },
        section: { documentId: "section-two" },
      }
      const { strapi, store } = harness({
        [BLOG]: [{ ...published, [key]: changes[key], __published: published }],
      })
      const outcome = await applyToPublished(
        strapi,
        BLOG,
        id,
        { title: "Approved title" },
        { locale: "en" }
      )
      expect(outcome.mode).toBe("draft_only")
      expect(store[BLOG][0].__published.title).toBe("Story")
      expect(store[BLOG][0].__published[key]).toEqual(published[key])
    }
  )
  it("ignores body component identity when versions are otherwise equal", async () => {
    const published = { ...base, body: [{ ...body("Same")[0], id: 1 }] }
    const { strapi } = harness({
      [BLOG]: [
        {
          ...published,
          body: [{ ...body("Same")[0], id: 2 }],
          __published: published,
        },
      ],
    })
    expect(
      (await applyToPublished(strapi, BLOG, id, { title: "Approved" })).mode
    ).toBe("published")
  })
})

describe("author and revision safety", () => {
  it.each(["limited", "private"])(
    "never projects %s identity",
    (profileVisibility) => {
      expect(
        publicArticleProfile({
          profileVisibility,
          username: "secret",
          avatar: { url: "/avatar" },
        })
      ).toBeNull()
    }
  )
  it("honours activity suppression without leaking preference or bridge fields", () => {
    expect(
      publicArticleProfile({
        profileVisibility: "public",
        publicPrefs: { showActivity: false },
        username: "writer",
      })
    ).toBeNull()
    expect(
      publicArticleProfile({
        profileVisibility: "public",
        username: "writer",
        baUserId: "private",
      })
    ).toEqual({ username: "writer" })
  })
  it("pins a base revision when an existing-article draft is created", async () => {
    const { strapi } = harness({ [BLOG]: [base] })
    const pinned = await pinArticleBase(strapi, {
      submissionType: "blog_submission",
      targetSlug: "story",
      draftData: { title: "Changed", locale: "en" },
    })
    expect(pinned.draftData.baseRevision).toBe(articleRevision(base))
  })
  it("refuses applying a revision against a newer publication", async () => {
    const { strapi } = harness({
      [BLOG]: [{ ...base, body: body("Newer approved story") }],
    })
    await expect(
      applyArticleSubmission(
        strapi,
        {
          submittedByUserId: "writer",
          targetSlug: "story",
          contentLocale: "en",
          draftData: {
            title: "Old title edit",
            body: base.body,
            baseRevision: articleRevision(base),
          },
        },
        "journal"
      )
    ).rejects.toMatchObject({ reason: "stale_article" })
  })
  it("retains existing images when another editor makes an ordinary revision", async () => {
    const image = {
      __component: "content.image-block",
      image: { id: 77, url: "/existing.png" },
      caption: "Original",
    }
    const { strapi, store } = harness({
      [BLOG]: [{ ...base, body: [...base.body, image] }],
    })
    const outcome = await applyArticleSubmission(
      strapi,
      {
        submittedByUserId: "second-editor",
        targetSlug: "story",
        contentLocale: "en",
        draftData: {
          title: "Revised",
          body: [...body("Revised"), { ...image, image: 77 }],
        },
      },
      "journal"
    )
    expect(outcome).toBe("published")
    expect(store[BLOG][0].body.at(-1).image).toBe(77)
  })
  it("supports clearing the summary", async () => {
    const { strapi, store } = harness({ [BLOG]: [base] })
    await applyArticleSubmission(
      strapi,
      {
        submittedByUserId: "writer",
        targetSlug: "story",
        contentLocale: "en",
        draftData: { title: "Revised", summary: "" },
      },
      "journal"
    )
    expect(store[BLOG][0].summary).toBe("")
  })
  it("requires explicit moderator publication for an ordinary author's revision", async () => {
    const { strapi, store } = harness({ [BLOG]: [base] }, "reader")
    const submission = {
      submittedByUserId: "writer",
      targetSlug: "story",
      contentLocale: "en",
      draftData: { title: "Author revision", body: body("Author edit") },
    }
    expect(await applyArticleSubmission(strapi, submission, "journal")).toBe(
      "drafted"
    )
    expect(
      await applyArticleSubmission(strapi, submission, "journal", {
        publish: true,
      })
    ).toBe("published")
    expect(store[BLOG][0].title).toBe("Author revision")
  })
})

describe("resubmission and durable citations", () => {
  it("retains a pinned base on autosave and changes it only after an explicit verified comparison", async () => {
    const row: any = {
      documentId: "submission00000000000001",
      status: "draft",
      submissionType: "blog_submission",
      targetSlug: "story",
      contentLocale: "en",
      submittedByUserId: "writer",
      fields: {},
      draftData: { title: "My revision", baseRevision: "a".repeat(64) },
      draftRevision: 0,
    }
    const { strapi, store } = harness({ [SUB]: [row], [BLOG]: [base] })
    const service = createSubmission({ strapi })
    await service.saveDraft(
      row.documentId,
      "writer",
      { title: "Still my text", baseRevision: articleRevision(base) },
      1
    )
    expect(store[SUB][0].draftData.baseRevision).toBe("a".repeat(64))
    const refused = await service.saveDraft(
      row.documentId,
      "writer",
      { title: "Keep this", rebaseRevision: "b".repeat(64) },
      1
    )
    expect(refused).toMatchObject({ error: "invalid" })
    await service.saveDraft(
      row.documentId,
      "writer",
      {
        title: "Keep this",
        rebaseRevision: articleRevision(base),
        locale: "en",
      },
      1
    )
    expect(store[SUB][0].draftData).toMatchObject({
      title: "Keep this",
      baseRevision: articleRevision(base),
    })
    expect(store[SUB][0].draftData).not.toHaveProperty("rebaseRevision")
    expect(store["plugin::content-moderation.review-event"][0].note).toContain(
      "explicitly compared"
    )
  })
  it("refuses a relation-only intervening update represented by a changed publication timestamp", async () => {
    const before = { ...base, updatedAt: "2026-10-01T00:00:00.000Z" }
    const { strapi } = harness({
      [BLOG]: [{ ...before, updatedAt: "2026-10-02T00:00:00.000Z" }],
    })
    await expect(
      applyArticleSubmission(
        strapi,
        {
          submittedByUserId: "writer",
          targetSlug: "story",
          contentLocale: "en",
          draftData: {
            title: "My revision",
            baseRevision: articleRevision(before),
          },
        },
        "journal"
      )
    ).rejects.toMatchObject({ reason: "stale_article" })
  })
  it("reopens requested changes privately then records a fresh reviewed snapshot", async () => {
    const row: any = {
      documentId: "submission00000000000001",
      status: "needs_info",
      submissionType: "wiki_edit",
      submittedByUserId: "writer",
      fields: {},
      draftData: { note: "Old" },
      draftRevision: 0,
    }
    row.payloadHash = payloadHash(row)
    const { strapi, store } = harness({ [SUB]: [row] })
    const service = createSubmission({ strapi })
    expect(
      (
        (await service.saveDraft(
          row.documentId,
          "writer",
          { note: "Revised" },
          1
        )) as any
      ).data.status
    ).toBe("draft")
    expect(store[SUB][0].payloadHash).toBeNull()
    await service.finalizeDraft(row.documentId, "writer", {})
    expect(store[SUB][0].status).toBe("pending")
    expect(store[SUB][0].payloadHash).toBe(payloadHash(store[SUB][0]))
    const events = store["plugin::content-moderation.review-event"]
    expect(events.map((event) => [event.fromStatus, event.toStatus])).toEqual([
      ["needs_info", "draft"],
      ["draft", "pending"],
    ])
  })
  it("retains an Event citation and stable key after imported data expires", async () => {
    const { strapi } = harness({ [EVENT]: [] })
    const source = {
      eventDocumentId: "event0000000000000000001",
      title: "Workshop",
      startTime: "2026-10-01T12:00:00Z",
      url: "https://example.org/workshop",
      timezone: "America/Bogota",
    }
    const mention = (await publicEventMentions(strapi, [source]))[0]
    expect(mention.title).toBe("Workshop")
    expect(mention.event).toBeUndefined()
    expect(
      (
        await publicEventMentions(strapi, [
          { ...source, citationId: mention.citationId },
        ])
      )[0].citationId
    ).toBe(mention.citationId)
    expect(mention).not.toHaveProperty("credentialId")
  })
})
