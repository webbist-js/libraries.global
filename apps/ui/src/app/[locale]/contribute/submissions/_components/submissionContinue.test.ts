import { describe, expect, it } from "vitest"

import type { Submission } from "@/hooks/useSubmissions"

import { continueHref, continueLink } from "./submissionContinue"

const submission: Submission = {
  documentId: "saved-story",
  submissionType: "blog_submission",
  status: "needs_info",
  targetSlug: "my-visit",
  draftData: { locale: "fr" },
  createdAt: "",
  updatedAt: "",
}
describe("article moderation recovery links", () => {
  it("continues the exact returned submission and content language for ordinary Journal writers", () => {
    expect(continueLink(submission, () => false)).toEqual({
      href: "/contribute/knowledge/journal/my-visit?draft=saved-story&locale=fr",
      label: "Continue",
    })
  })
  it("keeps Knowledge eligibility and resumes new stories in their saved draft", () => {
    expect(
      continueLink({ ...submission, submissionType: "wiki_edit" }, () => false)
        .label
    ).toBe("Apply to edit")
    expect(
      continueHref({
        ...submission,
        targetSlug: null,
        draftData: { kind: "new_article", locale: "fr" },
      })
    ).toBe("/contribute/knowledge/new?type=journal&draft=saved-story")
  })
})
