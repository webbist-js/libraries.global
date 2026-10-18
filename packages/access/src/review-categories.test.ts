import { describe, expect, it } from "vitest"

import { SUBMISSION_TYPES } from "./capabilities"
import {
  isReviewCategory,
  reviewCategoryOf,
  REVIEW_CATEGORY_TYPES,
  reviewCategoriesInScope,
} from "./review-categories"

describe("review categories", () => {
  it("resolves a review's return category without guessing for unknown legacy types", () => {
    expect(reviewCategoryOf("library_claim")).toBe("claims")
    expect(reviewCategoryOf("drive_proposal")).toBe("drives")
    expect(reviewCategoryOf("wiki_edit")).toBe("articles")
    expect(reviewCategoryOf("unknown")).toBeUndefined()
  })

  it("puts every submission type in exactly one presentation category", () => {
    const types = Object.values(REVIEW_CATEGORY_TYPES).flat()
    expect([...types].sort()).toEqual([...SUBMISSION_TYPES].sort())
    expect(new Set(types).size).toBe(types.length)
  })
  it("keeps claims and drive proposals out of library changes", () => {
    expect(REVIEW_CATEGORY_TYPES.libraries).not.toContain("library_claim")
    expect(REVIEW_CATEGORY_TYPES.libraries).not.toContain("drive_proposal")
  })
  it("shows only categories covered by existing queue scopes", () => {
    expect(reviewCategoriesInScope([{ queue: "index", locale: "en" }])).toEqual(
      ["libraries", "claims", "drives"]
    )
    expect(
      reviewCategoriesInScope([{ queue: "journal", locale: "fr" }])
    ).toEqual(["articles"])
    expect(
      reviewCategoriesInScope([{ queue: "discussions", locale: null }])
    ).toEqual([])
    expect(isReviewCategory("__proto__")).toBe(false)
  })
})
