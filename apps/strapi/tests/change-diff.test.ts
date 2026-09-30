import { describe, expect, it } from "vitest"

import {
  diffVersions,
  normaliseForDiff,
  stableStringify,
  trackedAttributes,
} from "../src/utils/change-diff"

const schema = {
  attributes: {
    id: { type: "integer" },
    documentId: { type: "string" },
    name: { type: "string" },
    alternateNames: { type: "json" },
    services: {
      type: "relation",
      relation: "manyToMany",
      target: "api::service.service",
    },
    country: {
      type: "relation",
      relation: "manyToOne",
      target: "api::country.country",
    },
    heroImage: { type: "media", multiple: false },
    gallery: { type: "media", multiple: true },
    socialLinks: {
      type: "component",
      component: "shared.social",
      repeatable: true,
    },
    body: { type: "dynamiczone", components: ["blocks.text"] },
    updatedAt: { type: "datetime" },
  },
}
const IGNORE = new Set(["id", "documentId", "updatedAt"])

describe("stableStringify", () => {
  it("is equal for key-reordered objects", () => {
    expect(stableStringify({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(
      stableStringify({ b: { d: [1, 2], c: 2 }, a: 1 })
    )
  })

  it("treats null, undefined and the empty string alike", () => {
    expect(stableStringify(null)).toBe("null")
    expect(stableStringify(undefined)).toBe("null")
    expect(stableStringify("")).toBe("null")
  })
})

describe("trackedAttributes", () => {
  it("groups attributes by kind and skips ignored ones", () => {
    expect(trackedAttributes(schema, IGNORE)).toEqual({
      scalars: ["name", "alternateNames"],
      relations: ["services", "country"],
      components: ["socialLinks", "body"],
      media: ["heroImage", "gallery"],
    })
  })
})

describe("normaliseForDiff / diffVersions", () => {
  const attrs = trackedAttributes(schema, IGNORE)
  const fields = [
    ...attrs.scalars,
    ...attrs.relations,
    ...attrs.components,
    ...attrs.media,
  ]

  it("compares relations as sorted documentId lists", () => {
    const a = normaliseForDiff(
      { services: [{ documentId: "b" }, { documentId: "a" }] },
      attrs
    )
    expect(a.services).toEqual(["a", "b"])
    const b = normaliseForDiff({ services: ["b", "a"] }, attrs)
    expect(diffVersions(a, b, fields)).toEqual([])
  })

  it("normalises a single relation and media to id arrays", () => {
    const n = normaliseForDiff(
      {
        country: { documentId: "gb" },
        heroImage: { id: 7, url: "/x.jpg" },
        gallery: [{ id: 3 }, { id: 1 }],
      },
      attrs
    )
    expect(n.country).toEqual(["gb"])
    expect(n.heroImage).toEqual([7])
    expect(n.gallery).toEqual([1, 3])
  })

  it("does not count an unchanged component as a change", () => {
    const before = normaliseForDiff(
      {
        name: "A",
        socialLinks: [{ id: 1, platform: "x", url: "u" }],
        body: [{ __component: "blocks.text", id: 4, text: "hi" }],
      },
      attrs
    )
    // Published copies get fresh component ids: not a content change.
    const after = normaliseForDiff(
      {
        name: "A",
        socialLinks: [{ id: 9, url: "u", platform: "x" }],
        body: [{ __component: "blocks.text", id: 12, text: "hi" }],
      },
      attrs
    )
    expect(diffVersions(before, after, fields)).toEqual([])
  })

  it("lists a changed field with previous and next", () => {
    const before = normaliseForDiff({ name: "Old" }, attrs)
    const after = normaliseForDiff({ name: "New" }, attrs)
    expect(diffVersions(before, after, fields)).toEqual([
      { field: "name", previous: "Old", next: "New" },
    ])
  })

  it("lists every tracked field when there is no previous version", () => {
    const doc = normaliseForDiff({ name: "A" }, attrs)
    const diff = diffVersions(null, doc, fields)
    expect(diff.map((d) => d.field)).toEqual(fields)
    expect(diff.every((d) => d.previous === null)).toBe(true)
  })
})
