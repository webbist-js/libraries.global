import { describe, expect, it } from "vitest"

import type { ArticleDraft } from "./article.types"
import { articleDraftData, restoreArticleDraft } from "./articleDraft"

const draft: ArticleDraft = {
  title: "My visit",
  summary: "A story",
  sections: ["culture"],
  tags: [],
  editSummary: "Updated",
  doc: {
    type: "doc",
    content: [
      {
        type: "image",
        attrs: {
          imageId: 77,
          src: "/uploads/a.jpg",
          alt: "Reading room",
          caption: "At the library",
          fullWidth: true,
        },
      },
    ],
  },
}

describe("article draft persistence", () => {
  it("restores a new Journal byline and origin without sending attribution during edits", () => {
    const story = { ...draft, byline: "Pen name", origin: "index" as const }
    const saved = articleDraftData(story, {
      mode: "new",
      journal: true,
      direct: true,
      locale: "en",
      sourceLocale: "en",
    })
    expect(restoreArticleDraft(saved, (url) => url)).toMatchObject({
      byline: "Pen name",
      origin: "index",
    })
    const edit = articleDraftData(story, {
      mode: "edit",
      journal: true,
      direct: true,
      locale: "fr",
      sourceLocale: "en",
      baseRevision: "source",
    })
    expect(edit).not.toHaveProperty("byline")
    expect(edit).not.toHaveProperty("publicationOrigin")
  })

  it("restores saved images without changing the numeric references used for approval", () => {
    const saved = articleDraftData(draft, {
      mode: "new",
      direct: false,
      locale: "fr",
      sourceLocale: "en",
    })
    expect((saved.body as { image: number }[])[0]?.image).toBe(77)
    expect(saved.editorMedia).toEqual([
      { id: 77, url: "/uploads/a.jpg", alternativeText: "Reading room" },
    ])
    const wireData = JSON.stringify(saved)
    const resumed = restoreArticleDraft(
      JSON.parse(wireData),
      (url) => `https://cms.example${url}`
    )
    expect(resumed.doc?.content[0]?.attrs).toEqual({
      imageId: 77,
      src: "https://cms.example/uploads/a.jpg",
      alt: "Reading room",
      caption: "At the library",
      fullWidth: true,
    })
  })

  it("restores legacy numeric-ID drafts using server-projected media", () => {
    const resumed = restoreArticleDraft(
      {
        proposedBody: [{ __component: "content.image-block", image: 12 }],
        editorMedia: [
          { id: 12, url: "/legacy.jpg", alternativeText: "Legacy" },
        ],
      },
      (url) => url
    )
    expect(resumed.doc?.content[0]?.attrs?.src).toBe("/legacy.jpg")
    expect(resumed.doc?.content[0]?.attrs?.alt).toBe("Legacy")
  })

  it("keeps a legacy image reference even when its display metadata is unavailable", () => {
    const resumed = restoreArticleDraft(
      {
        body: [
          {
            __component: "content.image-block",
            image: 99,
            caption: "Preserve me",
          },
        ],
      },
      (url) => url
    )
    expect(resumed.doc?.content[0]?.attrs).toMatchObject({
      imageId: 99,
      src: "",
      caption: "Preserve me",
    })
  })

  it("pins the revision across saves and resumes and retains an empty summary", () => {
    const saved = articleDraftData(
      { ...draft, summary: "" },
      {
        mode: "edit",
        direct: true,
        locale: "en",
        sourceLocale: "en",
        targetSlug: "story",
        baseRevision: "revision-before-writing",
      }
    )
    expect(saved.baseRevision).toBe("revision-before-writing")
    expect(restoreArticleDraft(saved, (url) => url)).toMatchObject({
      summary: "",
      baseRevision: "revision-before-writing",
    })
  })
})
