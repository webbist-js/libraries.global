import { describe, expect, it } from "vitest"

import { contactSubmissionSchema } from "../schema"

const feedback = {
  mode: "feedback",
  topic: "idea",
  task: "compare_areas",
  outcome: "partly",
  ease: 3,
  message: "A filter for quiet study spaces would help.",
  context: { page: "/atlas?search=private#comparison", locale: "en" },
  atlas: {
    features: ["filters", "area_comparison"],
    clarity: 4,
    wishlist: "  Compare the number of quiet study spaces.  ",
  },
}

describe("Atlas feedback validation", () => {
  it("preserves feature answers and trims the wishlist alongside safe page context", () => {
    expect(contactSubmissionSchema.parse(feedback)).toMatchObject({
      task: "compare_areas",
      context: { page: "/atlas", locale: "en" },
      atlas: {
        features: ["filters", "area_comparison"],
        clarity: 4,
        wishlist: "Compare the number of quiet study spaces.",
      },
    })
  })

  it.each(["check_accessibility", "export_data"])(
    "accepts the Atlas task %s without requiring optional scores or a wishlist",
    (task) => {
      expect(
        contactSubmissionSchema.safeParse({
          ...feedback,
          task,
          atlas: { features: ["accessibility"] },
        }).success
      ).toBe(true)
    }
  )

  it.each([
    { features: [] },
    { features: ["search", "search"] },
    { features: ["unknown"] },
    { features: Array.from({ length: 10 }, () => "search") },
    { features: ["search"], clarity: 0 },
    { features: ["search"], clarity: 6 },
    { features: ["search"], clarity: 2.5 },
    { features: ["search"], clarity: "4" },
    { features: ["search"], wishlist: "x".repeat(2001) },
    { features: ["search"], to: "injected@example.org" },
  ])("rejects invalid Atlas answers %j", (atlas) => {
    expect(
      contactSubmissionSchema.safeParse({ ...feedback, atlas }).success
    ).toBe(false)
  })

  it("retains compatibility with generic feedback tasks and payloads", () => {
    const { atlas: _atlas, ...generic } = feedback
    expect(
      contactSubmissionSchema.parse({ ...generic, task: "manage_library" })
    ).toEqual({
      ...generic,
      task: "manage_library",
      context: { page: "/atlas", locale: "en" },
    })
  })
})
