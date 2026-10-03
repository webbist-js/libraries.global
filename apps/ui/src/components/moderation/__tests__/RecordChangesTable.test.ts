// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { RecordChangesTable } = await import("../RecordChangesTable")

const SVC = "svcaaaaaaaaaaaaaaaaaaaaa"
const SVC2 = "svcbbbbbbbbbbbbbbbbbbbbb"

afterEach(cleanup)

const rowOf = (field: string) =>
  screen.getByRole("rowheader", { name: field }).closest("tr") as HTMLElement

describe("RecordChangesTable", () => {
  it("shows the library's live values as Current, not the contributor's", () => {
    render(
      createElement(RecordChangesTable, {
        submissionType: "correction",
        fields: {
          kind: "record",
          website: "https://new.example",
          services: { connect: [SVC2], disconnect: [SVC] },
          previous: { website: "https://stale.example" },
        },
        review: {
          current: { website: "https://live.example", services: [SVC] },
          names: { [SVC]: "Printing", [SVC2]: "Scanning" },
        },
      })
    )
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent)
    expect(headers).toEqual(["Field", "Current", "Proposed"])

    const website = within(rowOf("Website"))
    expect(website.getByText("https://live.example")).toBeTruthy()
    expect(website.queryByText("https://stale.example")).toBeNull()
    expect(website.getByText("https://new.example")).toBeTruthy()

    const services = within(rowOf("Services"))
    expect(services.getByText("Printing")).toBeTruthy()
    expect(services.getByText("+ Add Scanning")).toBeTruthy()
    expect(services.getByText("− Remove Printing")).toBeTruthy()
  })

  it("says when Current is the contributor's own copy", () => {
    render(
      createElement(RecordChangesTable, {
        submissionType: "library_edit",
        fields: { phone: "+44 1", previous: { phone: "+44 0" } },
        review: null,
      })
    )
    expect(within(rowOf("Phone")).getByText("+44 0")).toBeTruthy()
    expect(
      screen.getByText(/current values shown are the contributor/i)
    ).toBeTruthy()
  })

  it("says when nothing changed", () => {
    render(
      createElement(RecordChangesTable, {
        submissionType: "correction",
        fields: { kind: "record" },
        review: null,
      })
    )
    expect(
      screen.getByText("No field changes in this submission.")
    ).toBeTruthy()
  })
})
