// @vitest-environment happy-dom
import {
  emptyWidgetSelection,
  type WidgetLibrary,
  type WidgetSelectionSpec,
} from "@repo/shared-data"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WidgetComparisonGroups } from "@/components/widgets/WidgetComparisonGroups"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next-intl", () => ({ useTranslations: () => String }))
afterEach(cleanup)
const rows = [
  { documentId: "one", name: "Central Library", city: "City" },
  { documentId: "two", name: "Village Library", city: "Village" },
] as WidgetLibrary[]
function Editor({
  initial = emptyWidgetSelection(),
  disabled = false,
}: {
  initial?: WidgetSelectionSpec
  disabled?: boolean
}) {
  const [spec, setSpec] = useState(initial)

  return (
    <>
      <WidgetComparisonGroups
        spec={spec}
        rows={rows}
        disabled={disabled}
        update={setSpec}
      />
      <output data-testid="spec">{JSON.stringify(spec)}</output>
    </>
  )
}
const value = () =>
  JSON.parse(screen.getByTestId("spec").textContent!) as WidgetSelectionSpec

describe("comparison setup", () => {
  it("waits for the initial library data instead of showing false zero counts", () => {
    render(
      <WidgetComparisonGroups
        spec={{
          ...emptyWidgetSelection(),
          groups: [{ id: "a", name: "City", libraryIds: ["one"] }],
        }}
        rows={[]}
        loading
        disabled={false}
        update={vi.fn()}
      />
    )
    expect(screen.getByRole("status").textContent).toBe(
      "Loading selected libraries…"
    )
    expect(screen.queryByText("0 of 0 libraries assigned")).toBeNull()
    expect(screen.queryByRole("button", { name: "Remove group" })).toBeNull()
  })
  it("walks from an empty comparison into named, searchable groups", () => {
    render(<Editor />)
    expect(screen.getByText(/Without groups/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Create first group" }))
    fireEvent.change(screen.getByLabelText("Group name"), {
      target: { value: "City branches" },
    })
    fireEvent.click(screen.getByLabelText(/Central Library/))
    fireEvent.change(
      screen.getByPlaceholderText("Find libraries to add to this group"),
      { target: { value: "Village" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Select matches" }))
    expect(value().groups[0]).toMatchObject({
      name: "City branches",
      libraryIds: ["one", "two"],
    })
    fireEvent.click(screen.getByRole("button", { name: "Add group" }))
    expect(value().groups).toHaveLength(2)
    expect(screen.getByText("0 of 2 libraries assigned")).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Village Library/))
    expect(value().groups[1]?.libraryIds).toEqual(["two"])
    // Overlap is allowed, and creating a new group preserves the first.
    expect(value().groups[0]?.libraryIds).toEqual(["one", "two"])
  })
  it("reorders and removes groups without changing their library membership", () => {
    const initial = {
      ...emptyWidgetSelection(),
      groups: [
        { id: "a", name: "City", libraryIds: ["one"] },
        { id: "b", name: "Rural", libraryIds: ["two"] },
      ],
    }
    render(<Editor initial={initial} />)
    fireEvent.click(screen.getByRole("button", { name: "Move group later" }))
    expect(value().groups.map((group) => group.id)).toEqual(["b", "a"])
    expect(value().groups[1]?.libraryIds).toEqual(["one"])
    fireEvent.click(screen.getByRole("button", { name: "Remove group" }))
    expect(value().groups).toEqual([initial.groups[1]])
    expect(
      (screen.getByLabelText("Group name") as HTMLInputElement).value
    ).toBe("Rural")
  })
  it("keeps unresolved assignments while counting only the current selection", () => {
    render(
      <Editor
        initial={{
          ...emptyWidgetSelection(),
          groups: [
            { id: "a", name: "City", libraryIds: ["one", "unpublished"] },
          ],
        }}
      />
    )
    expect(screen.getByText("1 of 2 libraries assigned")).toBeTruthy()
    expect(screen.getByText(/outside the current selection/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Select all" }))
    expect(value().groups[0]?.libraryIds).toEqual(["one", "unpublished", "two"])
  })
  it("prevents inactive Teams from creating a group", () => {
    render(<Editor disabled />)
    expect(
      (
        screen.getByRole("button", {
          name: "Create first group",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
})
