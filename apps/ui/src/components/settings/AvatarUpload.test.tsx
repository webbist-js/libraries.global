// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AvatarUpload } from "./AvatarUpload"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
beforeEach(() => {
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:local-preview")
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {})
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ url: "/api/asset/uploads/avatar.webp" })
      )
  )
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("avatar upload preview", () => {
  it("uses the saved URL after success instead of displaying a revoked temporary blob", async () => {
    const onUpload = vi.fn()
    const { container } = render(
      <AvatarUpload initials="LA" onUpload={onUpload} />
    )
    const input = container.querySelector("input[type=file]")!
    fireEvent.change(input, {
      target: {
        files: [new File(["png"], "avatar.png", { type: "image/png" })],
      },
    })
    await waitFor(() =>
      expect(onUpload).toHaveBeenCalledWith("/api/asset/uploads/avatar.webp")
    )
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/asset/uploads/avatar.webp"
    )
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:local-preview")
    expect(
      screen.getByRole("button", { name: "Upload new photo" })
    ).toBeTruthy()
  })
})
