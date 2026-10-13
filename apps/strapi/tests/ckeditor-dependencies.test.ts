import { realpathSync } from "node:fs"
import { createRequire } from "node:module"

import { describe, expect, it } from "vitest"

const cmsRequire = createRequire(new URL("../package.json", import.meta.url))
const pluginRequire = createRequire(
  cmsRequire.resolve("@_sh/strapi-plugin-ckeditor/package.json")
)

describe("CMS editor integration", () => {
  it("shares one CKEditor installation between custom presets and the Strapi plugin", () => {
    const cmsEditor = realpathSync(cmsRequire.resolve("ckeditor5/package.json"))
    const pluginEditor = realpathSync(
      pluginRequire.resolve("ckeditor5/package.json")
    )
    // Different installations can load incompatible editor classes and cause
    // ckeditor-duplicated-modules before an editor opens in the CMS.
    expect(pluginEditor).toBe(cmsEditor)
  })
})
