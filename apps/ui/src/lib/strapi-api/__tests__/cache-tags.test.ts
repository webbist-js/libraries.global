import { describe, expect, it } from "vitest"

import { cacheTagsFor, isCacheModel, modelFromPath } from "../cache-tags"

describe("modelFromPath", () => {
  it.each([
    ["/libraries", "library"],
    ["libraries", "library"],
    ["/libraries/abc123", "library"],
    ["/countries/slugs", "country"],
    ["/homepage", "homepage"],
    ["/homepage/continents", "homepage"],
    ["/blog-articles", "blog-article"],
    ["/wiki-articles", "wiki-article"],
  ])("maps %s to %s", (path, model) => {
    expect(modelFromPath(path)).toBe(model)
  })

  it("returns null for a path that isn't a known endpoint", () => {
    expect(modelFromPath("/user-profiles")).toBeNull()
  })
})

describe("cacheTagsFor", () => {
  it("tags a collection read with the model", () => {
    expect(cacheTagsFor("/libraries", {})).toEqual(["strapi", "library"])
  })

  it("adds the entry tag for a slug filter", () => {
    expect(
      cacheTagsFor("/libraries", {
        filters: { slug: { $eq: "british-library" } },
      })
    ).toEqual(["strapi", "library", "library:british-library"])
  })

  it("adds the entry tag for a single-type or a documentId path", () => {
    expect(cacheTagsFor("/homepage", {})).toEqual(["strapi", "homepage"])
    expect(cacheTagsFor("/libraries/abc123", {})).toEqual([
      "strapi",
      "library",
      "library:abc123",
    ])
  })

  it("falls back to the generic tag for unknown paths", () => {
    expect(cacheTagsFor("/some/custom", {})).toEqual(["strapi"])
  })
})

describe("isCacheModel", () => {
  it("knows the models that carry tags", () => {
    expect(isCacheModel("library")).toBe(true)
    expect(isCacheModel("country")).toBe(true)
    expect(isCacheModel("submission")).toBe(false)
  })
})
