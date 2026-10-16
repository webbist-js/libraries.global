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
  it("shows the saved avatar only after the server validates the upload", async () => {
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
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(
      screen.getByRole("button", { name: "Upload new photo" })
    ).toBeTruthy()
  })

  it("keeps the current image while unverified file bytes are awaiting validation", async () => {
    let finish!: (response: Response) => void
    const pending = new Promise<Response>((resolve) => {
      finish = resolve
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(() => pending)
    )
    const onUpload = vi.fn()
    const { container } = render(
      <AvatarUpload
        currentUrl="/api/asset/uploads/current.webp"
        initials="LA"
        onUpload={onUpload}
      />
    )
    fireEvent.change(container.querySelector("input[type=file]")!, {
      target: {
        files: [
          new File(["<svg onload='alert(1)'></svg>"], "claimed.png", {
            type: "image/png",
          }),
        ],
      },
    })
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/asset/uploads/current.webp"
    )
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    finish(Response.json({ error: "Invalid image data" }, { status: 400 }))
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Upload new photo" })
      ).toBeTruthy()
    )
    expect(onUpload).not.toHaveBeenCalled()
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "/api/asset/uploads/current.webp"
    )
  })
})
