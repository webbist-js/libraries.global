// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import { DriveProgressSummary } from "../DriveProgressSummary"
import { driveHeroTitle, publishedThisWeek } from "../progress-summary"

Object.assign(globalThis, { React })
afterEach(cleanup)

describe("Drive progress summary", () => {
  it("counts the goal from published work without double-counting pending tasks", () => {
    render(
      h(DriveProgressSummary, {
        progress: { total: 1237, done: 184, inReview: 23 },
        unit: "library",
        gapPhrase: "have hours",
        goalPercent: 25,
        helpers: 14,
      })
    )
    expect(screen.getByText("Goal 25% · 310")).toBeTruthy()
    expect(screen.getByText("126 to go to reach the goal")).toBeTruthy()
    expect(screen.getByText("To do 1,030")).toBeTruthy()
    expect(screen.getByText("14.9%")).toBeTruthy()
    expect(screen.getByRole("img").getAttribute("aria-label")).toBe(
      "184 of 1,237 libraries have hours, 23 in review"
    )
  })

  it("doesn't claim a goal has been reached before any libraries are counted", () => {
    render(
      h(DriveProgressSummary, {
        progress: { total: 0, done: 0, inReview: 0 },
        unit: "library",
        gapPhrase: "have hours",
        goalPercent: 25,
        helpers: null,
      })
    )
    expect(screen.getByText("No libraries counted yet")).toBeTruthy()
    expect(screen.queryByText("Goal reached")).toBeNull()
  })

  it("calculates this week from Sunday, and omits unknown or stale baselines", () => {
    const now = new Date("2026-10-17T12:00:00Z")
    const entry = (day: string, done: number) => ({
      day,
      done,
      total: 100,
      inReview: 0,
    })
    expect(
      publishedThisWeek(
        [entry("2026-10-11", 10), entry("2026-10-12", 15)],
        51,
        now
      )
    ).toBe(41)
    expect(publishedThisWeek([entry("2026-10-12", 15)], 51, now)).toBeNull()
    expect(publishedThisWeek([entry("2026-09-30", 0)], 51, now)).toBeNull()
  })

  it("preserves authored markup and custom titles while breaking the drive title pattern", () => {
    expect(driveHeroTitle("Opening hours for every Californian library")).toBe(
      "Opening hours\nfor every\n*Californian library*"
    )
    expect(
      driveHeroTitle("Opening hours for every *Californian library.*")
    ).toBe("Opening hours\nfor every\n*Californian library.*")
    expect(driveHeroTitle("A custom drive title")).toBe("A custom drive title")
  })
})
