import { readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

import {
  AREA_SHAPES,
  CONTINENT_SHAPES,
  COUNTRY_SHAPES,
  LIBRARY_SHAPES,
  REGION_SHAPES,
  type ShapeSet,
} from "../src/utils/populate-shapes"

/**
 * Every server-owned populate shape is validated by Strapi against the
 * target's schema at request time, and a field that doesn't exist on its
 * target (a `slug` on an option, say) turns the whole core route into a 400.
 * This checks the shapes against the schema JSON files instead, so the
 * mistake fails here.
 */

const ROOT = path.resolve(__dirname, "..")

// Strapi adds these to every type; `fields` may name them.
const BUILT_IN = new Set([
  "id",
  "documentId",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "locale",
])

// plugin::upload.file, as the populate shapes are allowed to ask for it.
const MEDIA_ATTRIBUTES = new Set([
  "name",
  "alternativeText",
  "caption",
  "width",
  "height",
  "formats",
  "hash",
  "ext",
  "mime",
  "size",
  "url",
  "previewUrl",
  "provider",
])

type Attribute = {
  type: string
  target?: string
  component?: string
  components?: string[]
  repeatable?: boolean
}
type Schema = { attributes: Record<string, Attribute> }

const readJson = (file: string): Schema =>
  JSON.parse(readFileSync(path.join(ROOT, file), "utf8")) as Schema

/** `api::library.library` → its schema.json. */
function contentTypeSchema(uid: string): Schema {
  const m = /^api::([\w-]+)\.([\w-]+)$/.exec(uid)
  if (!m) throw new Error(`unsupported uid ${uid}`)

  return readJson(`src/api/${m[1]}/content-types/${m[2]}/schema.json`)
}

/** `shared.seo` → src/components/shared/seo.json. */
function componentSchema(name: string): Schema {
  const [category, file] = name.split(".")

  return readJson(`src/components/${category}/${file}.json`)
}

type Node = { fields?: string[]; populate?: Record<string, unknown> }

/** Every (path, field) that is not an attribute of the node's target. */
function unknownFields(
  node: Node,
  attributes: Set<string>,
  resolveChild: (key: string) => Set<string> | Record<string, unknown> | null,
  at: string
): string[] {
  const bad: string[] = []
  for (const field of node.fields ?? []) {
    if (!attributes.has(field) && !BUILT_IN.has(field)) {
      bad.push(`${at}.fields: ${field}`)
    }
  }
  for (const [key, child] of Object.entries(node.populate ?? {})) {
    if (!attributes.has(key)) {
      bad.push(`${at}.populate: ${key}`)
      continue
    }
    const target = resolveChild(key)
    if (target === null) continue // media or a scalar: nothing more to check
    const childNode = (child === true ? {} : child) as Node
    if (target instanceof Set) {
      bad.push(...unknownFields(childNode, target, () => null, `${at}.${key}`))
    }
  }

  return bad
}

/** The attribute names of a schema plus a resolver for its relations. */
function inspect(schema: Schema) {
  const attributes = new Set(Object.keys(schema.attributes))
  const resolveChild = (key: string) => {
    const attr = schema.attributes[key]
    if (!attr) return null
    if (attr.type === "media") return MEDIA_ATTRIBUTES
    if (attr.type === "relation" && attr.target?.startsWith("api::")) {
      return new Set(Object.keys(contentTypeSchema(attr.target).attributes))
    }
    if (attr.type === "component" && attr.component) {
      return new Set(Object.keys(componentSchema(attr.component).attributes))
    }

    return null
  }

  return { attributes, resolveChild }
}

const SHAPES: [string, ShapeSet][] = [
  ["api::library.library", LIBRARY_SHAPES],
  ["api::continent.continent", CONTINENT_SHAPES],
  ["api::country.country", COUNTRY_SHAPES],
  ["api::region.region", REGION_SHAPES],
  ["api::area.area", AREA_SHAPES],
]

describe.each(SHAPES)("populate shape for %s", (uid, shapes) => {
  const { attributes, resolveChild } = inspect(contentTypeSchema(uid))

  it.each(["list", "detail"] as const)(
    "%s names only fields that exist on their targets",
    (view) => {
      expect(
        unknownFields(shapes[view], attributes, resolveChild, view)
      ).toEqual([])
    }
  )
})

describe("library list shape serves the ingest scripts", () => {
  // StrapiClient.librariesBySourceRecord() reads `/api/libraries` with
  // `populate=sourceRecords` to skip outlets an ingest already created. The
  // route swaps that populate for LIBRARY_SHAPES.list, so without the source
  // records there every re-run would create the whole dataset again.
  it("populates each library's source records", () => {
    const sourceRecords = LIBRARY_SHAPES.list.populate.sourceRecords as
      | { fields?: string[] }
      | undefined
    expect(sourceRecords?.fields).toEqual(
      expect.arrayContaining(["dataset", "recordId"])
    )
  })
})
