// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

Object.assign(globalThis, { React })

afterEach(() => {
  cleanup()
})

const { DriveProgress } = await import("../DriveProgress")

const progress = (over = {}) => ({
  total: 251,
  done: 142,
  todo: 109,
  inReview: 9,
  percent: 57,
  goalMet: false,
  ...over,
})

describe("DriveProgress", () => {
  it("is a labelled image of the bar: done, total, the unit, the gap and in review", () => {
    render(
      createElement(DriveProgress, {
        progress: progress(),
        unit: "branch",
        gapPhrase: "have hours",
      })
    )

    const bar = screen.getByRole("img", {
      name: "142 of 251 branches have hours, 9 in review",
    })
    const describedBy = bar.getAttribute("aria-describedby")
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toContain(
      "142 of 251 branches done"
    )
  })

  it("draws the in-review work as its own segment, named in the legend", () => {
    const { container } = render(
      createElement(DriveProgress, {
        progress: progress(),
        unit: "branch",
        gapPhrase: "have hours",
      })
    )

    const done = container.querySelector<HTMLElement>('[data-segment="done"]')
    const review = container.querySelector<HTMLElement>(
      '[data-segment="in-review"]'
    )
    expect(done?.style.width).toBe("56.6%")
    expect(review?.style.width).toBe("3.6%")
    expect(screen.getByText("9 in review")).toBeTruthy()
  })

  it("uses the singular unit for a one-library drive", () => {
    render(
      createElement(DriveProgress, {
        progress: progress({ total: 1, done: 0, todo: 1, inReview: 0 }),
        unit: "library",
        gapPhrase: "have a photo",
      })
    )

    expect(
      screen.getByRole("img", {
        name: "0 of 1 library have a photo, 0 in review",
      })
    ).toBeTruthy()
  })

  it("shows the goal only when it isn't 100%", () => {
    render(
      createElement(DriveProgress, {
        progress: progress(),
        unit: "branch",
        gapPhrase: "have hours",
        goalPercent: 80,
      })
    )
    expect(screen.getByText("Goal 80%")).toBeTruthy()
    cleanup()

    render(
      createElement(DriveProgress, {
        progress: progress(),
        unit: "branch",
        gapPhrase: "have hours",
        goalPercent: 100,
      })
    )
    expect(screen.queryByText(/Goal/)).toBeNull()
  })

  it("draws a sparkline of done work from the progress log", () => {
    render(
      createElement(DriveProgress, {
        progress: progress(),
        unit: "branch",
        gapPhrase: "have hours",
        log: [
          { day: "2026-10-01", total: 251, done: 90, inReview: 0 },
          { day: "2026-10-02", total: 251, done: 120, inReview: 4 },
          { day: "2026-10-03", total: 251, done: 142, inReview: 9 },
        ],
      })
    )

    expect(
      screen.getByRole("img", {
        name: "Done over 3 days: from 90 to 142 branches",
      })
    ).toBeTruthy()
  })

  it("has no sparkline with fewer than two days logged", () => {
    render(
      createElement(DriveProgress, {
        progress: progress(),
        unit: "branch",
        gapPhrase: "have hours",
        log: [{ day: "2026-10-01", total: 251, done: 90, inReview: 0 }],
      })
    )

    expect(screen.queryByRole("img", { name: /Done over/ })).toBeNull()
  })

  it("puts the meta line beside the count", () => {
    render(
      createElement(DriveProgress, {
        progress: progress(),
        unit: "branch",
        gapPhrase: "have hours",
        meta: "57% · 38 people helping",
      })
    )

    expect(screen.getByText("57% · 38 people helping")).toBeTruthy()
  })
})
