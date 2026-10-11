import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

const schema = (type: string) =>
  JSON.parse(
    readFileSync(`src/api/${type}/content-types/${type}/schema.json`, "utf8")
  )

const copy: Record<string, string[]> = {
  "wiki-section": ["name", "label", "description"],
  "blog-section": ["name", "description"],
  topic: ["name"],
  category: ["name", "description", "tagLabel"],
  "wiki-article": ["title", "summary", "body", "seo"],
  "blog-article": [
    "title",
    "summary",
    "body",
    "authorTitle",
    "authorBio",
    "seo",
  ],
  "wiki-landing": ["heroTitle", "heroText", "heroEyebrow", "quickStartCards"],
  "blog-landing": ["heroTitle", "heroText", "heroEyebrow", "featuredArticle"],
}

describe("editorial locale ownership", () => {
  it.each(Object.entries(copy))(
    "keeps %s display copy localizable",
    (type, fields) => {
      const model = schema(type)
      expect(model.pluginOptions.i18n.localized).toBe(true)
      for (const field of fields)
        expect(
          model.attributes[field].pluginOptions.i18n.localized,
          `${type}.${field}`
        ).toBe(true)
    }
  )

  it.each([
    "wiki-section",
    "blog-section",
    "wiki-article",
    "blog-article",
    "topic",
    "category",
  ])("keeps %s URL slugs independent of translated titles", (type) => {
    expect(schema(type).attributes.slug.pluginOptions.i18n.localized).toBe(
      false
    )
  })

  it("shares section ordering and visual settings", () => {
    for (const [type, fields] of [
      ["wiki-section", ["order", "icon"]],
      ["blog-section", ["icon", "tint"]],
    ] as const)
      for (const field of fields)
        expect(
          schema(type).attributes[field].pluginOptions.i18n.localized
        ).toBe(false)
  })
})
