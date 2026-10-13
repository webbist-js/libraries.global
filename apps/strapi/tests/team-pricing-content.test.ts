import { describe, expect, it } from "vitest"

import {
  apiKnowledgeArticle,
  apiKnowledgeBody,
  pricingGuideBody,
  pricingLegalSections,
} from "../scripts/team-pricing-content.mjs"

describe("Team pricing content", () => {
  it("uses entityRef in new API guides and corrects only obsolete endpoint prose", () => {
    const fresh = apiKnowledgeArticle("section-fixture")
    expect(JSON.stringify(fresh.body)).toContain(
      "/api/v1/libraries/{entityRef}"
    )
    expect(JSON.stringify(fresh.body)).not.toContain("{documentId}")
    const original = {
      slug: "team-api-access",
      body: [
        {
          id: 456,
          __component: "content.rich-text",
          body: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  text: "GET /api/v1/libraries/{documentId} returns one published record.",
                },
                {
                  type: "link",
                  url: "/staff/team/api",
                  children: [{ type: "text", text: "Manage API keys" }],
                },
              ],
            },
          ],
        },
      ],
    }
    const corrected = apiKnowledgeBody(original)!
    expect(JSON.stringify(corrected)).toContain("/api/v1/libraries/{entityRef}")
    expect(JSON.stringify(corrected)).toContain("URL-encode")
    expect(corrected[0].body[0].children[1]).toEqual(
      original.body[0]!.body[0]!.children[1]
    )
    expect(apiKnowledgeBody({ ...original, body: corrected })).toEqual(
      corrected
    )
    expect(original.body[0]!.id).toBe(456)
    expect(apiKnowledgeBody({ ...original, slug: "opening-times" })).toBeNull()
  })
  it("preserves existing guidance and links and adds one repeatable pricing section", () => {
    const original = {
      slug: "teams-for-library-services",
      body: [
        {
          id: 123,
          __component: "content.rich-text",
          body: [
            {
              type: "paragraph",
              children: [
                {
                  type: "link",
                  url: "/staff/team",
                  children: [{ type: "text", text: "Existing staff guidance" }],
                },
              ],
            },
          ],
        },
      ],
    }
    const body = pricingGuideBody(original, "en")!
    expect(body[0]).toMatchObject({
      __component: "content.rich-text",
      body: original.body[0]!.body,
    })
    expect(JSON.stringify(body)).toContain("£600/year")
    expect(JSON.stringify(body)).toContain("£480/year")
    expect(JSON.stringify(body)).toContain("£120/year")
    expect(JSON.stringify(body)).toContain("£96/year")
    expect(JSON.stringify(body)).toContain(
      "Beta checkout uses test payments and makes no real charge"
    )
    expect(pricingGuideBody({ ...original, body }, "en")).toEqual(body)
    expect(original.body[0]!.id).toBe(123)
  })

  it("does not edit unrelated articles or locales", () => {
    expect(
      pricingGuideBody({ slug: "opening-times", body: [] }, "en")
    ).toBeNull()
    expect(
      pricingGuideBody({ slug: "plans-and-pro", body: [] }, "de")
    ).toBeNull()
  })

  it("preserves contact and cancellation terms when changing pricing", () => {
    const untouched = {
      heading: "Contact",
      inShort: "Ask us",
      body: [
        {
          type: "paragraph",
          children: [{ type: "text", text: "Existing public postal details" }],
        },
      ],
    }
    const sections = pricingLegalSections({
      slug: "membership",
      sections: [untouched, { heading: "Prices, taxes and renewal", body: [] }],
    })!
    expect(sections[0]).toEqual(untouched)
    expect(
      sections.filter((s) => s.heading === "Prices, taxes and renewal")
    ).toHaveLength(1)
    expect(
      sections.filter((s) => s.heading === "Team API add-on")
    ).toHaveLength(1)
    expect(JSON.stringify(sections)).toContain("£5 monthly or £50 yearly")
  })
})
