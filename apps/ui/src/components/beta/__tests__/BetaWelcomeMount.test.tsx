// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

import { BetaWelcomeMount } from "../BetaWelcomeMount"

const state = vi.hoisted(() => ({ path: "/", id: "reader", pending: false }))
vi.mock("next/navigation", () => ({ usePathname: () => state.path }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: { user: { id: state.id } },
    isPending: state.pending,
    error: null,
  }),
}))
vi.mock("next/dynamic", () => ({
  default: () =>
    function Welcome({ onClose }: { onClose: () => void }) {
      return (
        <div role="dialog" aria-label="Beta welcome">
          <button onClick={onClose}>Dismiss welcome</button>
        </div>
      )
    },
}))

beforeEach(() => {
  sessionStorage.clear()
  state.path = "/"
  state.id = "reader"
  state.pending = false
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
describe("beta welcome lifecycle", () => {
  it("stays dismissed while navigating and welcomes a different signed-in account", async () => {
    const { rerender } = render(<BetaWelcomeMount sandbox />)
    expect(await screen.findByRole("dialog")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Dismiss welcome" }))
    state.path = "/libraries"
    rerender(<BetaWelcomeMount sandbox />)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    state.id = "another-reader"
    rerender(<BetaWelcomeMount sandbox />)
    expect(await screen.findByRole("dialog")).toBeTruthy()
  })
  it("waits for the session and avoids interrupting sign-in or checkout", async () => {
    state.pending = true
    const { rerender } = render(<BetaWelcomeMount sandbox />)
    expect(screen.queryByRole("dialog")).toBeNull()
    state.pending = false
    state.path = "/auth/signin"
    rerender(<BetaWelcomeMount sandbox />)
    expect(sessionStorage.length).toBe(0)
    state.path = "/staff/teams/billing"
    rerender(<BetaWelcomeMount sandbox />)
    expect(screen.queryByRole("dialog")).toBeNull()
    state.path = "/staff/teams"
    rerender(<BetaWelcomeMount sandbox />)
    expect(await screen.findByRole("dialog")).toBeTruthy()
  })
  it("keeps dismissal for the mounted visit when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("disabled")
    })
    const { rerender } = render(<BetaWelcomeMount sandbox />)
    await screen.findByRole("dialog")
    fireEvent.click(screen.getByRole("button", { name: "Dismiss welcome" }))
    state.path = "/libraries"
    rerender(<BetaWelcomeMount sandbox />)
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
