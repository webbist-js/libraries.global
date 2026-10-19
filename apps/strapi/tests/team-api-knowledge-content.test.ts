import { describe, expect, it } from "vitest"

import {
  apiOnboardingArticles,
  updateApiGuide,
} from "../scripts/team-api-knowledge-content.mjs"

describe("Team API onboarding publication", () => {
  it("preserves existing blocks and makes its availability notice repeatable", () => {
    const original = {
      slug: "teams-for-library-services",
      body: [
        {
          id: 7,
          __component: "content.rich-text",
          body: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  url: "/staff/team",
                  children: [{ type: "text", text: "Existing guide" }],
                },
              ],
            },
          ],
        },
      ],
    }
    const updated = updateApiGuide(original)
    expect(updated[0].body).toEqual(original.body[0].body)
    expect(updateApiGuide({ ...original, body: updated })).toEqual(updated)
    expect(original.body[0].id).toBe(7)
    expect(updateApiGuide({ slug: "opening-times", body: [] })).toBeNull()
  })
  it("replaces the superseded free-key promise and blanket licence claim", () => {
    const old = {
      slug: "the-public-api",
      body: [
        {
          __component: "content.rich-text",
          body: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "a free key for anyone; everything CC BY-SA 4.0",
                },
              ],
            },
          ],
        },
        { __component: "content.image-block", caption: "Keep editorial media" },
      ],
    }
    const updated = updateApiGuide(old)
    expect(updated[1]).toEqual(old.body[1])
    expect(JSON.stringify(updated)).not.toContain("a free key for anyone")
    expect(JSON.stringify(updated)).toContain("source licences")
    expect(updateApiGuide({ ...old, body: updated })).toEqual(updated)
  })
  it("keeps the signup and reference guides in the existing Data & API section", () => {
    const articles = apiOnboardingArticles("data-section")
    expect(articles).toHaveLength(2)
    for (const article of articles)
      expect(article.section.connect[0].documentId).toBe("data-section")
    const all = JSON.stringify(articles)
    for (const required of [
      "/auth/register",
      "/staff/team/api",
      "search:read",
      "libraries:read",
      "meta.nextCursor",
      "encodeURIComponent",
      "Retry-After",
      "temporarily unavailable",
    ])
      expect(all).toContain(required)
    expect(all).not.toContain("/api/v1/libraries/{documentId}")
  })
})
