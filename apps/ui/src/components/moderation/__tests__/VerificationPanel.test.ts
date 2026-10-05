// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { VerificationPanel } = await import("../VerificationPanel")

const hours = {
  days: [
    {
      day: "monday",
      enabled: true,
      timeframes: [{ startTime: "09:00", endTime: "17:00" }],
    },
  ],
}

afterEach(cleanup)

const sectionOf = (name: string) =>
  screen.getByRole("heading", { name }).closest("li") as HTMLElement

describe("VerificationPanel", () => {
  it("lists each confirmed section with its live value and last check", () => {
    render(
      createElement(VerificationPanel, {
        fields: { kind: "verify", sections: ["hours", "contact"] },
        review: {
          sections: ["hours", "contact"],
          current: { website: "https://x", openingTimes: hours },
          verifiedSections: { hours: "2025-01-01T00:00:00.000Z" },
        },
      })
    )
    expect(
      screen.getByRole("heading", { name: "Confirms these are still right" })
    ).toBeTruthy()

    const opening = within(sectionOf("Opening hours"))
    expect(opening.getByText("Mon 09:00–17:00")).toBeTruthy()
    expect(opening.getByText("Previously checked 1 Jan 2025")).toBeTruthy()

    const contact = within(sectionOf("Contact details"))
    const link = contact.getByText("https://x").closest("a")
    expect(link?.getAttribute("href")).toBe("https://x")
    expect(contact.getByText("Not checked before")).toBeTruthy()
  })

  it("shows how the contributor checked", () => {
    render(
      createElement(VerificationPanel, {
        fields: { kind: "verify", sections: ["status"] },
        review: {
          sections: ["status"],
          current: { operationalStatus: "open" },
          verifiedSections: {},
        },
        evidenceType: "on_site_visit",
        evidenceUrl: null,
      })
    )
    expect(screen.getByText("Checked in person")).toBeTruthy()
    expect(within(sectionOf("Open or closed")).getByText("Open")).toBeTruthy()
  })

  it("says when the library can't be found", () => {
    render(
      createElement(VerificationPanel, {
        fields: { kind: "verify", sections: ["address"] },
        review: null,
      })
    )
    expect(screen.getByText(/library could not be found/i)).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Address" })).toBeTruthy()
  })
})
