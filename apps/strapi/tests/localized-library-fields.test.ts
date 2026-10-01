import { readFileSync } from "node:fs"
import path from "node:path"

import { LOCALIZED_LIBRARY_FIELDS } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

const schema = JSON.parse(
  readFileSync(
    path.join(
      __dirname,
      "../src/api/library/content-types/library/schema.json"
    ),
    "utf8"
  )
) as {
  attributes: Record<
    string,
    { type: string; pluginOptions?: { i18n?: { localized?: boolean } } }
  >
}

describe("LOCALIZED_LIBRARY_FIELDS", () => {
  it("is exactly the library's localized string, text and blocks attributes", () => {
    const localized = Object.entries(schema.attributes)
      .filter(
        ([name, a]) =>
          name !== "seo" &&
          ["string", "text", "blocks"].includes(a.type) &&
          a.pluginOptions?.i18n?.localized === true
      )
      .map(([name]) => name)

    expect([...LOCALIZED_LIBRARY_FIELDS].sort()).toEqual(localized.sort())
  })
})
