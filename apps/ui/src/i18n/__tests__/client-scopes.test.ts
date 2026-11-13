import fs from "node:fs"

import { describe, expect, it } from "vitest"

import {
  generate,
  MANIFEST,
  ROOT_SCOPE,
} from "../../../scripts/i18n-scopes.mjs"
import { mergeMessages, pickMessages } from "../pick-messages"

import manifest from "../client-scopes.generated.json"

describe("client message scopes", () => {
  it("match the import graph (run `pnpm --filter @repo/ui i18n:scopes`)", () => {
    const { manifest: fresh, errors } = generate()
    expect(errors).toEqual([])
    expect(fs.readFileSync(MANIFEST, "utf8")).toBe(
      JSON.stringify(fresh, null, 2) + "\n"
    )
  })

  it("keep feature copy out of the shell every page loads", () => {
    const shell = manifest.scopes[ROOT_SCOPE as keyof typeof manifest.scopes]
    expect(shell).toContain("ui")
    for (const unit of [
      "staticUi.atlas",
      "staticUi.library",
      "membershipContent",
      "discussions",
    ])
      expect(shell).not.toContain(unit)
    expect(manifest.deferred["profile-drawer"]).toContain("membershipContent")
  })
})

describe("pickMessages", () => {
  const catalogue = {
    ui: { save: "Save" },
    errors: { oops: "Oops" },
    staticUi: { atlas: { map: "Map" }, home: { title: "Home" } },
  }

  it("copies whole namespaces and staticUi sub-namespaces", () => {
    expect(
      pickMessages(catalogue, ["ui", "staticUi.atlas", "missing"])
    ).toEqual({ ui: { save: "Save" }, staticUi: { atlas: { map: "Map" } } })
  })

  it("adds a scope to the messages already in context", () => {
    const shell = pickMessages(catalogue, ["ui", "staticUi.home"])
    const page = pickMessages(catalogue, ["errors", "staticUi.atlas"])
    expect(mergeMessages(shell, page)).toEqual(catalogue)
    expect(shell).toEqual({
      ui: { save: "Save" },
      staticUi: { home: { title: "Home" } },
    })
  })
})
