// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ProfileAppearance } from "./ProfileAppearance"

vi.mock("@/lib/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
afterEach(() => cleanup())

describe("profile appearance controls", () => {
  it("keeps the palette available and disables cover upload when storage credentials are unavailable", () => {
    render(
      <ProfileAppearance
        background="mint"
        onBackgroundChange={vi.fn()}
        coverUrl=""
        onCoverChange={vi.fn()}
        uploadEnabled={false}
      />
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Upload cover photo",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(screen.getAllByRole("radio")).toHaveLength(6)
    expect(screen.getByText(/Cover uploads are not configured/)).toBeTruthy()
  })
  it("exposes six named keyboard-selectable colours and preserves the cover until explicitly removed", () => {
    const choose = vi.fn()
    render(
      <ProfileAppearance
        background="violet"
        onBackgroundChange={choose}
        coverUrl="/cover.webp"
        onCoverChange={vi.fn()}
      />
    )
    expect(screen.getAllByRole("radio")).toHaveLength(6)
    fireEvent.click(screen.getByRole("radio", { name: "Mint" }))
    expect(choose).toHaveBeenCalledWith("mint")
    expect(
      screen
        .getByLabelText("Profile background preview")
        .querySelector("img")
        ?.getAttribute("src")
    ).toBe("/cover.webp")
    expect(
      screen.getByRole("button", { name: "Remove cover photo" })
    ).toBeTruthy()
  })
})
