import { describe, expect, it, vi } from "vitest"

import { tiptapToDynamicZone } from "../../../ui/src/components/contribute/article-editor/articleBlocks"
import createService from "../../src/plugins/content-moderation/server/services/submission"
import createPolicy from "../../src/plugins/content-moderation/server/services/submission-policy"
import {
  applyArticleSubmission,
  cleanSectionKeys,
  cleanTags,
  isTranslationSubmission,
  slugify,
} from "../../src/plugins/content-moderation/server/utils/article-apply"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })

const WIKI = "api::wiki-article.wiki-article"
const BLOG = "api::blog-article.blog-article"
const BLOG_SECTION = "api::blog-section.blog-section"
const TOPIC = "api::topic.topic"
const LIBRARY = "api::library.library"
const PROFILE = "api::user-profile.user-profile"

const ROLE_GRANT = "api::role-grant.role-grant"
/** A global Role Grant for `role` (none for reader), as the policy reads them. */
const grantsFor = (role: string, baUserId = "u1") =>
  role === "reader"
    ? []
    : [
        {
          documentId: `rg-${role}`,
          baUserId,
          role,
          queue: "all",
          scopeLocale: null,
        },
      ]
const AFF = "api::library-affiliation.library-affiliation"

const body = [
  {
    __component: "content.rich-text",
    id: 4,
    body: [{ type: "paragraph", children: [{ type: "text", text: "Hello" }] }],
  },
]

function harness(seed: Record<string, any[]>, role: string) {
  const { strapi, store, services } = makeFakeStrapi({
    [PROFILE]: [{ documentId: "p1", baUserId: "u1", contributorRole: role }],
    [ROLE_GRANT]: grantsFor(role),
    [AFF]: [],
    [TOPIC]: [],
    [LIBRARY]: [],
    [BLOG_SECTION]: [],
    "plugin::content-moderation.submission-upload": [
      { documentId: "up1", fileId: 77, baUserId: "u1" },
    ],
    ...seed,
  })
  services["content-moderation.submission-policy"] = createPolicy({ strapi })
  // The fake hands out fresh mocks per documents() call; memoise per uid so
  // tests can read `strapi.documents(uid).create.mock.calls` afterwards.
  const perUid = new Map<string, any>()
  const fresh = strapi.documents
  strapi.documents = vi.fn((uid: string) => {
    if (!perUid.has(uid)) perUid.set(uid, fresh(uid))

    return perUid.get(uid)
  })
  strapi.plugin = vi.fn((name: string) =>
    name === "i18n"
      ? { service: () => ({ find: async () => [{ code: "en" }] }) }
      : { service: (s: string) => services[`${name}.${s}`] }
  )

  return { strapi, store }
}

describe("helpers", () => {
  it("slugify makes a safe slug and never an empty one", () => {
    expect(slugify("How we verify Library Records!")).toBe(
      "how-we-verify-library-records"
    )
    expect(slugify("Café résumé")).toBe("cafe-resume")
    expect(slugify("???")).toBe("article")
  })
  it("cleanSectionKeys keeps short slugs only, deduplicated", () => {
    expect(
      cleanSectionKeys(["contributing", "contributing", "Bad Key", 3, "x"])
    ).toEqual(["contributing", "x"])
    expect(cleanSectionKeys("contributing")).toEqual([])
  })
  it("cleanTags drops malformed entries and unknown kinds", () => {
    expect(
      cleanTags([
        { kind: "topic", label: "Opening hours", slug: "opening-hours" },
        { kind: "library", label: "X", documentId: "lib00000000000000000001" },
        { kind: "evil", label: "x" },
        { kind: "topic" },
        "nope",
      ])
    ).toEqual([
      { kind: "topic", label: "Opening hours", slug: "opening-hours" },
      { kind: "library", label: "X", documentId: "lib00000000000000000001" },
    ])
  })
})

describe("applyArticleSubmission: new articles", () => {
  const draft = {
    kind: "new_article",
    locale: "en",
    title: "  How we verify records  ",
    summary: "A short summary",
    body,
    sections: ["data-api", "contributing"],
    tags: [
      { kind: "topic", label: "Opening hours", slug: "opening-hours" },
      { kind: "topic", label: "Pending one", slug: "pending-topic" },
      { kind: "library", label: "Lib", documentId: "lib00000000000000000001" },
      { kind: "library", label: "Gone", documentId: "lib00000000000000000009" },
      { kind: "free", label: "Something new" },
    ],
  }
  const seed = {
    [TOPIC]: [
      { documentId: "t1", slug: "opening-hours", status: "approved" },
      { documentId: "t2", slug: "pending-topic", status: "pending" },
    ],
    [LIBRARY]: [{ documentId: "lib00000000000000000001", slug: "lib" }],
  }

  it("a reader's article is created as a draft, credited, with approved topics and existing libraries", async () => {
    const { strapi, store } = harness(seed, "reader")
    const outcome = await applyArticleSubmission(
      strapi,
      {
        documentId: "s1",
        submittedByUserId: "u1",
        submittedByName: "Ada",
        draftData: draft,
      },
      "wiki"
    )
    expect(outcome).toBe("created_draft")
    const created = store[WIKI]![0]!
    expect(created.title).toBe("How we verify records")
    expect(created.slug).toBe("how-we-verify-records")
    expect(created.summary).toBe("A short summary")
    expect(created.author).toBe("Community member")
    expect(created.docsSections).toEqual(["data-api", "contributing"])
    expect(created.body).toEqual([
      { __component: "content.rich-text", body: body[0]!.body },
    ])
    expect(created.topics).toEqual({ set: [{ documentId: "t1" }] })
    expect(created.libraries).toEqual({
      set: [{ documentId: "lib00000000000000000001" }],
    })
    expect(created.contributors).toEqual({ connect: [{ documentId: "p1" }] })
    const call = strapi.documents(WIKI).create.mock.calls[0]?.[0]
    expect(call?.status).toBe("draft")
  })

  it("a wiki_editor's article is published", async () => {
    const { strapi } = harness(seed, "wiki_editor")
    const outcome = await applyArticleSubmission(
      strapi,
      { documentId: "s1", submittedByUserId: "u1", draftData: draft },
      "wiki"
    )
    expect(outcome).toBe("created_published")
    expect(strapi.documents(WIKI).create.mock.calls[0]?.[0]?.status).toBe(
      "published"
    )
  })

  it("a journal_editor publishes Journal articles but not Knowledge ones", async () => {
    const { strapi } = harness(
      { ...seed, [BLOG_SECTION]: [{ documentId: "bs1", slug: "feature" }] },
      "journal_editor"
    )
    const journal = await applyArticleSubmission(
      strapi,
      {
        documentId: "s1",
        submittedByUserId: "u1",
        draftData: { ...draft, sections: ["feature"] },
      },
      "journal"
    )
    expect(journal).toBe("created_published")
    const created = strapi.documents(BLOG).create.mock.calls[0]?.[0]
    expect(created?.status).toBe("published")
    expect(created?.data.section).toEqual({ set: [{ documentId: "bs1" }] })
    expect(created?.data.docsSections).toBeUndefined()

    const knowledge = await applyArticleSubmission(
      strapi,
      { documentId: "s2", submittedByUserId: "u1", draftData: draft },
      "wiki"
    )
    expect(knowledge).toBe("created_draft")
  })

  it("publishes reviewed Journal sources as fresh components in their authored order", async () => {
    const { strapi } = harness(
      { ...seed, [BLOG_SECTION]: [{ documentId: "bs1", slug: "feature" }] },
      "journal_editor"
    )
    const sources = [
      {
        id: 999,
        title: "Annual report",
        url: "https://example.org/report",
        publisher: "Library",
      },
      { title: "Printed catalogue", notes: "Page 42" },
    ]
    expect(
      await applyArticleSubmission(
        strapi,
        {
          documentId: "s-sources",
          submittedByUserId: "u1",
          draftData: { ...draft, sections: ["feature"], sources },
        },
        "journal"
      )
    ).toBe("created_published")
    const created = strapi.documents(BLOG).create.mock.calls[0]?.[0]
    expect(created.data.sources).toEqual([
      {
        title: "Annual report",
        url: "https://example.org/report",
        publisher: "Library",
        accessedAt: null,
        notes: null,
      },
      {
        title: "Printed catalogue",
        url: null,
        publisher: null,
        accessedAt: null,
        notes: "Page 42",
      },
    ])
  })
  it("refuses unsafe source links before creating a published Journal article", async () => {
    const { strapi } = harness(
      { ...seed, [BLOG_SECTION]: [{ documentId: "bs1", slug: "feature" }] },
      "journal_editor"
    )
    await expect(
      applyArticleSubmission(
        strapi,
        {
          documentId: "s-unsafe-source",
          submittedByUserId: "u1",
          draftData: {
            ...draft,
            sections: ["feature"],
            // eslint-disable-next-line sonarjs/code-eval -- Unsafe fixture is rejected before publication.
            sources: [{ title: "Reference", url: "javascript:alert(1)" }],
          },
        },
        "journal"
      )
    ).rejects.toThrow()
    expect(strapi.documents(BLOG).create).not.toHaveBeenCalled()
  })

  it("never overwrites an existing article even when a slug is smuggled in", async () => {
    const { strapi, store } = harness(
      {
        ...seed,
        [WIKI]: [{ documentId: "w1", slug: "existing", title: "Old" }],
      },
      "reader"
    )
    await applyArticleSubmission(
      strapi,
      {
        documentId: "s1",
        submittedByUserId: "u1",
        targetSlug: "existing",
        draftData: { ...draft, title: "Existing", targetSlug: "existing" },
      },
      "wiki"
    )
    expect(store[WIKI]!.find((a) => a.documentId === "w1")!.title).toBe("Old")
    expect(store[WIKI]).toHaveLength(2)
    expect(strapi.documents(WIKI).update).not.toHaveBeenCalled()
  })

  it("refuses unowned image blocks without silently changing the submitted article", async () => {
    const { strapi, store } = harness(seed, "reader")
    await expect(
      applyArticleSubmission(
        strapi,
        {
          documentId: "s1",
          submittedByUserId: "u1",
          draftData: {
            ...draft,
            body: [
              ...body,
              {
                __component: "content.image-block",
                image: 77,
                caption: "mine",
              },
              {
                __component: "content.image-block",
                image: 78,
                caption: "theirs",
              },
            ],
          },
        },
        "wiki"
      )
    ).rejects.toMatchObject({ reason: "invalid_media" })
    expect(store[WIKI]).toEqual(seed[WIKI])
  })

  it("is a noop without a title", async () => {
    const { strapi } = harness(seed, "reader")
    expect(
      await applyArticleSubmission(
        strapi,
        {
          documentId: "s1",
          submittedByUserId: "u1",
          draftData: { kind: "new_article", body },
        },
        "wiki"
      )
    ).toBe("noop")
  })
})

describe("article points come from draftData and the target, never from fields", () => {
  const SUB = "plugin::content-moderation.submission"
  const article = {
    documentId: "w1",
    slug: "existing",
    title: "Old",
    locale: "en",
  }

  function approve(sub: Record<string, unknown>, role = "editorial_board") {
    const { strapi, store } = harness({ [WIKI]: [article], [SUB]: [sub] }, role)
    const award = vi.fn(async () => {})
    strapi.plugin = vi.fn((name: string) =>
      name === "i18n"
        ? {
            service: () => ({
              find: async () => [{ code: "en" }, { code: "fr" }],
            }),
          }
        : name === "rewards"
          ? { service: () => ({ award }) }
          : {
              service: () => createPolicy({ strapi }),
            }
    )
    strapi.service = vi.fn(() => ({ computeAndSave: vi.fn(async () => {}) }))

    return { strapi, store, award, svc: createService({ strapi }) }
  }

  it("a wiki_edit claiming fields.kind new_article but editing a target takes the edit path and edit points", async () => {
    const sub = {
      documentId: "s0000000000000000000050",
      submissionType: "wiki_edit",
      status: "pending",
      submittedByUserId: "u1",
      targetSlug: "existing",
      fields: { kind: "new_article", isTranslation: true, title: "Sneaky" },
      draftData: { locale: "en", title: "Renamed" },
    }
    const { store, award, svc } = approve(sub)
    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    expect("data" in result).toBe(true)
    expect(store[WIKI]).toHaveLength(1)
    expect(store[WIKI]![0]!.title).toBe("Renamed")
    expect(award).toHaveBeenCalledTimes(1)
    expect(award.mock.calls[0]!.slice(0, 3)).toEqual([
      "u1",
      "knowledge_edit_accepted",
      8,
    ])
  })

  it("an approved new_article stores the created article as resultDocumentId", async () => {
    const sub = {
      documentId: "s0000000000000000000052",
      submissionType: "wiki_edit",
      status: "pending",
      submittedByUserId: "u1",
      fields: {},
      draftData: { kind: "new_article", locale: "en", title: "Brand new" },
    }
    const { store, svc } = approve(sub)
    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    const created = store[WIKI]!.find((a: any) => a.title === "Brand new")
    expect(created?.documentId).toBeTruthy()
    const stored = store["plugin::content-moderation.submission"]!.find(
      (s: any) => s.documentId === sub.documentId
    )
    expect(stored?.resultDocumentId).toBe(created!.documentId)
    expect((result as any).data.resultDocumentId).toBe(created!.documentId)
  })

  it("preserves uploaded Journal images, alt text and credit when a moderator approves and publishes", async () => {
    const sub = {
      documentId: "s0000000000000000000053",
      submissionType: "blog_submission",
      status: "pending",
      submittedByUserId: "u1",
      fields: {},
      draftData: {
        kind: "new_article",
        locale: "en",
        title: "An illustrated story",
        body: tiptapToDynamicZone({
          type: "doc",
          content: [
            {
              type: "image",
              attrs: {
                imageId: 77,
                src: "/uploads/reading-room.webp",
                alt: "Readers sharing books",
                caption: "Photo by Ada",
              },
            },
            {
              type: "paragraph",
              content: [{ type: "text", text: "A story." }],
            },
          ],
        }),
      },
    }
    const { strapi, store, svc } = approve(sub, "reader")
    const result = await svc.updateStatus(
      sub.documentId,
      "approved",
      REVIEWER,
      undefined,
      { publish: true }
    )
    expect(result).toHaveProperty("data.status", "approved")
    expect(store[BLOG][0].body[0]).toEqual({
      __component: "content.image-block",
      image: 77,
      alternativeText: "Readers sharing books",
      caption: "Photo by Ada",
      fullWidth: false,
    })
    expect(strapi.documents(BLOG).create).toHaveBeenCalledWith(
      expect.objectContaining({ status: "published" })
    )
  })

  it("a translation is one whose locale has no version yet", async () => {
    const sub = {
      documentId: "s0000000000000000000051",
      submissionType: "wiki_edit",
      status: "pending",
      submittedByUserId: "u1",
      targetSlug: "existing",
      fields: {},
      draftData: { locale: "fr", proposedBody: body, proposedTitle: "Ancien" },
    }
    const { award, svc } = approve(sub, "reader")
    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    expect("data" in result).toBe(true)
    expect(award.mock.calls[0]!.slice(0, 3)).toEqual([
      "u1",
      "wiki_translated",
      15,
    ])
  })

  it("a locale Strapi doesn't know is not a translation: it is a default-locale edit", async () => {
    const sub = {
      documentId: "s0000000000000000000052",
      submissionType: "wiki_edit",
      status: "pending",
      submittedByUserId: "u1",
      targetSlug: "existing",
      fields: {},
      draftData: { locale: "xx", proposedBody: body, proposedTitle: "Forged" },
    }
    const { strapi, store, award, svc } = approve(sub, "reader")
    expect(
      await isTranslationSubmission(
        strapi,
        {
          documentId: sub.documentId,
          targetSlug: "existing",
          draftData: sub.draftData,
        },
        "wiki"
      )
    ).toBe(false)
    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    expect("data" in result).toBe(true)
    expect(store[WIKI]).toHaveLength(1)
    // Written to the default (en) draft, never to an unknown locale.
    const update = strapi.documents(WIKI).update.mock.calls[0]![0]
    expect(update).toMatchObject({ locale: "en", status: "draft" })
    expect(award.mock.calls.map((c: unknown[]) => c[1])).toEqual([
      "knowledge_edit_accepted",
    ])
  })

  it("no points for a direct edit that is only a suggestion (skipped_suggestion)", async () => {
    const sub = {
      documentId: "s0000000000000000000053",
      submissionType: "wiki_edit",
      status: "pending",
      submittedByUserId: "u1",
      targetSlug: "existing",
      fields: {},
      draftData: { locale: "en", body },
    }
    const { award, svc } = approve(sub, "reader")
    const result = await svc.updateStatus(sub.documentId, "approved", REVIEWER)
    expect("data" in result).toBe(true)
    expect(award).not.toHaveBeenCalled()
  })
})

describe("applyArticleSubmission: existing articles", () => {
  const article = { documentId: "w1", slug: "existing", title: "Old" }

  it("a reader's proposedBody lands on the draft version only", async () => {
    const { strapi } = harness({ [WIKI]: [article] }, "reader")
    const outcome = await applyArticleSubmission(
      strapi,
      {
        documentId: "s1",
        submittedByUserId: "u1",
        targetSlug: "existing",
        draftData: { locale: "en", proposedBody: body, proposedTitle: "New" },
      },
      "wiki"
    )
    expect(outcome).toBe("drafted")
    const calls = strapi.documents(WIKI).update.mock.calls.map((c: any) => c[0])
    expect(calls.every((c: any) => c.status === "draft")).toBe(true)
    expect(calls[0].data.title).toBe("New")
    expect(calls[0].data.body).toEqual([
      { __component: "content.rich-text", body: body[0]!.body },
    ])
  })

  it("a reader's direct body is skipped, an editor's is published with taxonomy", async () => {
    const draftData = {
      locale: "en",
      body,
      sections: ["governance"],
      tags: [{ kind: "topic", label: "T", slug: "t" }],
    }
    const reader = harness({ [WIKI]: [article] }, "reader")
    expect(
      await applyArticleSubmission(
        reader.strapi,
        {
          documentId: "s1",
          submittedByUserId: "u1",
          targetSlug: "existing",
          draftData,
        },
        "wiki"
      )
    ).toBe("skipped_suggestion")
    expect(reader.strapi.documents(WIKI).update).not.toHaveBeenCalled()

    const editor = harness(
      {
        [WIKI]: [article],
        [TOPIC]: [{ documentId: "t1", slug: "t", status: "approved" }],
      },
      "editorial_board"
    )
    expect(
      await applyArticleSubmission(
        editor.strapi,
        {
          documentId: "s1",
          submittedByUserId: "u1",
          targetSlug: "existing",
          draftData,
        },
        "wiki"
      )
    ).toBe("published")
    const call = editor.strapi.documents(WIKI).update.mock.calls[0]?.[0]
    expect(call?.status).toBe("published")
    expect(call?.data.docsSections).toEqual(["governance"])
    expect(call?.data.topics).toEqual({ set: [{ documentId: "t1" }] })
    expect(call?.data.contributors).toEqual({ connect: [{ documentId: "p1" }] })
  })

  it("is a noop for an unknown slug; an unknown locale means the default", async () => {
    const { strapi } = harness({ [WIKI]: [article] }, "editorial_board")
    expect(
      await applyArticleSubmission(
        strapi,
        {
          documentId: "s1",
          submittedByUserId: "u1",
          targetSlug: "missing",
          draftData: { body },
        },
        "wiki"
      )
    ).toBe("noop")
    expect(
      await applyArticleSubmission(
        strapi,
        {
          documentId: "s1",
          submittedByUserId: "u1",
          targetSlug: "existing",
          draftData: { body, locale: "xx" },
        },
        "wiki"
      )
    ).toBe("published")
    expect(strapi.documents(WIKI).update.mock.calls[0]![0]).toMatchObject({
      locale: "en",
    })
  })
})
