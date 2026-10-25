import { expect, it } from "vitest"

import { libraryAccessPlanBlocks } from "../src/utils/library-access-plan-copy"

it("updates only plan copy, keeps edits and links, and does not duplicate the feature", () => {
  const body = [
    {
      type: "paragraph",
      children: [{ type: "text", text: "Two Pro features are live now:" }],
    },
    {
      type: "paragraph",
      children: [
        { type: "text", text: "My unpublished edit." },
        {
          type: "link",
          url: "/contribute/membership",
          children: [
            {
              type: "text",
              text: "on the Atlas: per-capita, deprivation and transit layers;",
            },
          ],
        },
      ],
    },
  ]
  const copy = libraryAccessPlanBlocks(body)
  expect(JSON.stringify(body)).toContain("Two Pro features")
  expect(JSON.stringify(copy)).toContain("Library access compares")
  expect(JSON.stringify(copy)).toContain("Travel-time reach estimates")
  expect(JSON.stringify(copy)).toContain("2020, separately from the 2024")
  expect(JSON.stringify(copy)).toContain("My unpublished edit.")
  expect(JSON.stringify(copy)).toContain("/contribute/membership")
  expect(JSON.stringify(copy)).not.toContain("per-capita, deprivation")
  expect(libraryAccessPlanBlocks(copy)).toEqual(copy)
})
