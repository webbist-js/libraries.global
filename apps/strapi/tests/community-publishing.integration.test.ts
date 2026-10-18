import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { setupStrapi, teardownStrapi } from "./helpers/strapi"
import { backfillArticleDiscovery } from "../src/documentMiddlewares/article-discovery"
import { applyArticleSubmission } from "../src/plugins/content-moderation/server/utils/article-apply"
import { applyToPublished } from "../src/plugins/content-moderation/server/utils/publish-guard"
import {
  articleRevision,
  ARTICLE_BODY_POPULATE,
} from "../src/utils/article-content"
import { publicEventMentions } from "../src/utils/article-relations"

const run = process.env.COMMUNITY_PUBLISHING_INTEGRATION === "1"
const BLOG = "api::blog-article.blog-article"
const WIKI = "api::wiki-article.wiki-article"
const body = (text: string) => [
  {
    __component: "content.rich-text",
    body: [{ type: "paragraph", children: [{ type: "text", text }] }],
  },
]
let cms: any
const created: { uid: string; documentId: string }[] = []

describe.skipIf(!run)("community publishing on isolated PostgreSQL", () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_NAME?.startsWith("community_publishing_"))
      throw new Error(
        "Use an explicitly disposable community_publishing_* database"
      )
    cms = (await setupStrapi()).instance
  }, 60000)
  afterAll(async () => {
    for (const entry of created.toReversed())
      await cms.documents(entry.uid).delete({ documentId: entry.documentId })
    await teardownStrapi()
  }, 30000)
  const create = async (uid: string, data: any, status?: string) => {
    const row = await cms
      .documents(uid)
      .create({ data, ...(status ? { status } : {}) })
    created.push({ uid, documentId: row.documentId })

    return row
  }

  it("retains legacy Journal and Knowledge content while filling derived fields", async () => {
    for (const uid of [BLOG, WIKI]) {
      const original = await create(
        uid,
        {
          title: "Legacy content",
          slug: `acceptance-legacy-${uid === BLOG ? "journal" : "knowledge"}`,
          summary: "Preserved summary",
          body: body("Original reference content"),
        },
        "published"
      )
      // Model the state of an existing row before the additive backfill.
      await cms.db.query(uid).update({
        where: { id: original.id },
        data: {
          readingTimeMinutes: null,
          geographyFacet: null,
          ...(uid === BLOG ? { publicationOrigin: null } : {}),
        },
      })
      await backfillArticleDiscovery(cms)
      const retained = await cms.documents(uid).findOne({
        documentId: original.documentId,
        status: "published",
        populate: { body: ARTICLE_BODY_POPULATE },
      })
      expect(retained.title).toBe(original.title)
      expect(retained.summary).toBe(original.summary)
      expect(retained.body[0].body).toEqual(
        body("Original reference content")[0].body
      )
      expect(retained.slug).toBe(original.slug)
      expect(retained.readingTimeMinutes).toBe(1)
      expect(retained.geographyFacet).toEqual({
        continents: [],
        countries: [],
        regions: [],
        areas: [],
      })
      if (uid === BLOG) expect(retained.publicationOrigin).toBe("index")
    }
  })

  it("does not publish an unrelated admin body when approving a title-only change", async () => {
    const article = await create(
      BLOG,
      {
        title: "Published original",
        slug: "acceptance-publish-guard",
        body: body("Published original body"),
      },
      "published"
    )
    await cms.documents(BLOG).update({
      documentId: article.documentId,
      data: { body: body("Unreviewed admin draft") },
    })
    const result = await applyToPublished(
      cms,
      BLOG,
      article.documentId,
      { title: "Reviewed title" },
      { locale: "en" }
    )
    expect(result.mode).toBe("draft_only")
    const published = await cms.documents(BLOG).findOne({
      documentId: article.documentId,
      status: "published",
      populate: { body: ARTICLE_BODY_POPULATE },
    })
    expect(published.title).toBe("Published original")
    expect(published.body[0].body).toEqual(
      body("Published original body")[0].body
    )
  })

  it("keeps an existing image for a second editor and rejects the losing concurrent revision", async () => {
    await create("api::user-profile.user-profile", {
      baUserId: "acceptance-second-editor",
      username: "acceptance_second_editor",
      profileVisibility: "public",
    })
    await create("api::role-grant.role-grant", {
      baUserId: "acceptance-second-editor",
      role: "journal_editor",
      queue: "journal",
      scopeLocale: "en",
      source: "admin",
    })
    const file = await cms.db.query("plugin::upload.file").create({
      data: {
        name: "acceptance-original.png",
        hash: "acceptance-original",
        ext: ".png",
        mime: "image/png",
        size: 1,
        url: "/uploads/acceptance-original.png",
        provider: "local",
      },
    })
    const article = await create(
      BLOG,
      {
        title: "Photo story",
        slug: "acceptance-photo-story",
        body: [
          ...body("Published photo story"),
          {
            __component: "content.image-block",
            image: file.id,
            alternativeText: "An existing library photo",
          },
        ],
      },
      "published"
    )
    const published = await cms.documents(BLOG).findOne({
      documentId: article.documentId,
      status: "published",
      populate: { body: ARTICLE_BODY_POPULATE },
    })
    const submission = {
      documentId: "acceptance-submission",
      submittedByUserId: "acceptance-second-editor",
      targetSlug: article.slug,
      contentLocale: "en",
      draftData: {
        title: "Reviewed photo story",
        summary: "",
        baseRevision: articleRevision(published),
        body: [
          ...body("Updated approved wording"),
          {
            __component: "content.image-block",
            image: file.id,
            alternativeText: "Retained photo",
          },
        ],
      },
    }
    const results = await Promise.allSettled([
      applyArticleSubmission(cms, submission, "journal"),
      applyArticleSubmission(
        cms,
        {
          ...submission,
          documentId: "acceptance-other-submission",
          draftData: {
            ...submission.draftData,
            title: "Concurrent stale story",
          },
        },
        "journal"
      ),
    ])
    if (results.every((result) => result.status === "rejected"))
      throw new AggregateError(
        results.map((result) =>
          result.status === "rejected" ? result.reason : null
        ),
        "Both article revisions were refused"
      )
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1)
    expect(
      results.find((result) => result.status === "rejected")
    ).toMatchObject({ reason: { reason: "stale_article" } })
    const retained = await cms.documents(BLOG).findOne({
      documentId: article.documentId,
      status: "published",
      populate: { body: ARTICLE_BODY_POPULATE },
    })
    expect(retained.body.at(-1).image.id).toBe(file.id)
    expect(retained.body.at(-1).alternativeText).toBe("Retained photo")
    await cms.db.query("plugin::upload.file").delete({ where: { id: file.id } })
  })

  it("keeps the public Event citation when an imported Event is purged", async () => {
    const now = new Date().toISOString()
    const event = await create("plugin::events.event", {
      externalId: "acceptance-event",
      sourceProvider: "ical",
      credentialId: 999999,
      syncHash: "acceptance",
      title: "Library workshop in Colombia",
      url: "https://example.test/workshop",
      startTime: now,
      timezone: "America/Bogota",
      importedAt: now,
      lastSeenAt: now,
    })
    const mentions = await publicEventMentions(cms, [
      { eventDocumentId: event.documentId },
    ])
    const article = await create(
      BLOG,
      {
        title: "Workshop report",
        slug: "acceptance-event-report",
        body: body("The library workshop"),
        eventMentions: mentions,
      },
      "published"
    )
    await cms
      .documents("plugin::events.event")
      .delete({ documentId: event.documentId })
    const retained = await cms.documents(BLOG).findOne({
      documentId: article.documentId,
      status: "published",
      populate: { eventMentions: { populate: { event: true } } },
    })
    expect(retained.eventMentions[0]).toMatchObject({
      title: "Library workshop in Colombia",
      timezone: "America/Bogota",
      url: "https://example.test/workshop",
      citationId: mentions[0].citationId,
      event: null,
    })
  })
})
