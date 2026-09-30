import { describe, expect, it } from "vitest"

import contentTypes from "../../src/plugins/rewards/server/content-types"

describe("rewards content types", () => {
  it("hides every rewards collection from the Content Manager", () => {
    for (const [name, { schema }] of Object.entries(contentTypes)) {
      expect(
        (schema as any).pluginOptions?.["content-manager"]?.visible,
        name
      ).toBe(false)
    }
  })
})
