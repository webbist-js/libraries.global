import { expect, it } from "vitest"

import { stripComponentIds } from "../scripts/cms-component-ids.mjs"

it("strips component ids without mutating the original", () => {
  const original = [{ id: 1, body: [{ id: 2, text: "x" }] }]
  expect(stripComponentIds(original)).toEqual([{ body: [{ text: "x" }] }])
  expect(original[0]!.id).toBe(1)
})
