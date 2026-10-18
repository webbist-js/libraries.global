// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { PublicSubmission } from "@/app/api/profile/[username]/contributions/route"
import { cleanup, render, screen } from "@/test/render"

import { ContributionHeatmap } from "./ContributionHeatmap"

const submission = (createdAt: string): PublicSubmission => ({
  documentId: createdAt,
  submissionType: "blog_submission",
  status: "approved",
  targetEntityType: "blog",
  targetSlug: "story",
  targetLabel: "Story",
  editSummary: null,
  createdAt,
  updatedAt: createdAt,
  reviewedAt: createdAt,
})
beforeEach(() => vi.stubEnv("TZ", "Europe/London"))
afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

it("places a same-day accepted story on the visible local calendar day", () => {
  render(
    <ContributionHeatmap
      submissions={[submission("2026-10-16T16:00:00Z")]}
      now={Date.parse("2026-10-16T18:00:00Z")}
    />
  )
  expect(screen.getByTitle("16 Oct 2026: 1 contribution")).toBeTruthy()
})

it("counts only visible days in its text alternative", () => {
  render(
    <ContributionHeatmap
      submissions={[
        submission("2025-01-01T12:00:00Z"),
        submission("2026-10-16T16:00:00Z"),
        submission("2026-10-20T12:00:00Z"),
      ]}
      now={Date.parse("2026-10-16T18:00:00Z")}
    />
  )
  expect(
    screen.getByText(
      "1 contribution recorded in the last 26 weeks across 1 active day."
    )
  ).toBeTruthy()
})
