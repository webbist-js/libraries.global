import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  buildArticlePayload,
  compileArticle,
  inline,
  manifest,
} from "./build-bundle.mjs"

test("links compile to real Blocks links, and unsafe schemes are refused", () => {
  const nodes = inline(
    "Read [the guide](/knowledge/design-system/colour-and-appearance)."
  )
  assert.equal(nodes[1].type, "link")
  assert.equal(nodes[1].url, "/knowledge/design-system/colour-and-appearance")
  assert.throws(() => inline("[bad](javascript:alert)"))
  assert.throws(() => inline("[bad](//untrusted.example)"))
})

test("existing article changes cannot overwrite attribution, section or unrelated metadata", () => {
  const article = compileArticle(manifest.articles[0])
  const payload = buildArticlePayload(article)
  assert.deepEqual(Object.keys(payload).sort(), [
    "body",
    "readingTimeMinutes",
    "summary",
  ])
})

test("Journal payload refuses unresolved media and requires production section identity", () => {
  const article = compileArticle(
    manifest.articles.find((a) => a.model === "blog-article")
  )
  assert.throws(() => buildArticlePayload(article), /Upload required/)
  const assetIds = {
    "journal-dark-implemented": 101,
    "journal-light-implemented": 102,
    "ui-overhaul-home": 103,
  }
  assert.throws(
    () => buildArticlePayload(article, { assetIds }),
    /section document ID/
  )
  const payload = buildArticlePayload(article, {
    assetIds,
    sectionDocumentId: "resolved-in-production",
  })
  assert.equal(
    payload.body.filter((b) => b.__component === "content.image-block").length,
    3
  )
  assert.ok(payload.body.every((b) => !("imageAsset" in b)))
  assert.equal(payload.publicationOrigin, "index")
})

test("all emitted fields and rich text/image blocks exist in the current schemas", () => {
  const cms = new URL("../../../../../strapi/", import.meta.url)
  for (const entry of manifest.articles) {
    const article = compileArticle(entry)
    const payload = buildArticlePayload(article, {
      sectionDocumentId: "production-section",
      assetIds: {
        "journal-dark-implemented": 101,
        "journal-light-implemented": 102,
        "ui-overhaul-home": 103,
      },
    })
    const schema = JSON.parse(
      readFileSync(
        new URL(
          `src/api/${entry.model}/content-types/${entry.model}/schema.json`,
          cms
        )
      )
    )
    for (const key of Object.keys(payload))
      assert.ok(key === "locale" || key in schema.attributes, key)
    for (const block of payload.body) {
      assert.ok(schema.attributes.body.components.includes(block.__component))
      const [category, name] = block.__component.split(".")
      const component = JSON.parse(
        readFileSync(new URL(`src/components/${category}/${name}.json`, cms))
      )
      for (const key of Object.keys(block))
        assert.ok(key === "__component" || key in component.attributes, key)
      if (block.__component === "content.image-block") {
        assert.ok(block.image > 0 && block.alternativeText && block.caption)
      } else {
        for (const node of block.body) {
          assert.ok(["paragraph", "heading"].includes(node.type))
          assert.ok(node.children.length > 0)
        }
      }
    }
  }
})
