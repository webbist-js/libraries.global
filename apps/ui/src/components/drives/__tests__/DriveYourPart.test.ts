// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { DriveYourPart } = await import("../DriveYourPart")

afterEach(() => {
  cleanup()
})

describe("DriveYourPart", () => {
  it("shows what you sent, what's in review and what was accepted", () => {
    render(
      h(DriveYourPart, {
        mine: { sent: 6, inReview: 3, accepted: 2 },
        quota: { pendingCount: 3, pendingLimit: 5 },
        toArchivist: 340,
      })
    )
    const part = screen.getByRole("region", { name: "Your part" })
    expect(part.textContent).toContain("6Sent")
    expect(part.textContent).toContain("3In review")
    expect(part.textContent).toContain("2Accepted")
    expect(screen.getByText("3 of 5 waiting for review")).toBeTruthy()
    expect(
      screen.getByText(
        "Drive work counts toward earned Pro: 340 points to Archivist."
      )
    ).toBeTruthy()
  })

  it("leaves out the quota and earned Pro when there's nothing to say", () => {
    render(
      h(DriveYourPart, {
        mine: { sent: 0, inReview: 0, accepted: 0 },
        quota: null,
        toArchivist: null,
      })
    )
    expect(screen.queryByText(/waiting for review/)).toBeNull()
    expect(screen.queryByText(/earned Pro/)).toBeNull()
    expect(screen.getByText("Nothing sent for this drive yet.")).toBeTruthy()
  })

  it("says the counts are loading until they arrive", () => {
    render(h(DriveYourPart, { mine: null, quota: null, toArchivist: null }))
    expect(
      screen.getByRole("region", { name: "Your part" }).textContent
    ).toContain("Loading your part…")
  })
})
