// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ProfileAppearance } from "./ProfileAppearance"

afterEach(() => cleanup())

describe("profile appearance controls", () => {
  it("offers avatar colours without a cover preview or cover upload", () => {
    const { container } = render(
      <ProfileAppearance background="mint" onBackgroundChange={vi.fn()} />
    )
    expect(screen.getByRole("heading", { name: "Avatar colour" })).toBeTruthy()
    expect(screen.getAllByRole("radio")).toHaveLength(6)
    expect(screen.getByText(/Used behind your initials/)).toBeTruthy()
    expect(screen.queryByLabelText("Profile background preview")).toBeNull()
    expect(screen.queryByText("A place for your library stories.")).toBeNull()
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })
  it("marks the saved colour and reports the chosen avatar colour", () => {
    const choose = vi.fn()
    render(
      <ProfileAppearance background="violet" onBackgroundChange={choose} />
    )
    expect(
      (screen.getByRole("radio", { name: "Violet" }) as HTMLInputElement)
        .checked
    ).toBe(true)
    fireEvent.click(screen.getByRole("radio", { name: "Mint" }))
    expect(choose).toHaveBeenCalledWith("mint")
  })
})
