// @vitest-environment happy-dom
import { useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen } from "@/test/render"

import { AccountGuard } from "./AccountGuard"

const viewer = vi.hoisted(() => ({
  id: "a",
  pending: false,
  error: null as null | Error,
}))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: viewer.id ? { user: { id: viewer.id } } : null,
    isPending: viewer.pending,
    error: viewer.error,
  }),
}))
vi.mock("@/lib/navigation", () => ({
  usePathname: () => "/profile/settings",
  useRouter: () => ({ refresh: vi.fn() }),
}))
beforeEach(() => {
  viewer.error = null
  viewer.pending = false
  viewer.id = "a"
})
afterEach(cleanup)
function PrivateForm({ seed = "A private draft" }: { seed?: string }) {
  const [name, setName] = useState(seed)

  return (
    <input
      aria-label="Display name"
      value={name}
      onChange={(event) => setName(event.target.value)}
    />
  )
}

describe("private profile account boundary", () => {
  it("hides private fields when account verification fails", () => {
    viewer.id = "a"
    viewer.pending = false
    viewer.error = new Error("offline")
    render(
      <AccountGuard mode="identity" expectedScope="a">
        <PrivateForm />
      </AccountGuard>
    )
    expect(screen.queryByRole("textbox")).toBeNull()
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy()
    viewer.error = null
  })
  it("hides the previous account's form during pending readiness and on another identity, then mounts fresh state", () => {
    viewer.id = "a"
    viewer.pending = false
    const view = render(
      <AccountGuard mode="identity" expectedScope="a">
        <PrivateForm />
      </AccountGuard>
    )
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Unsaved A-only detail" },
    })
    viewer.pending = true
    view.rerender(
      <AccountGuard mode="identity" expectedScope="a">
        <PrivateForm />
      </AccountGuard>
    )
    expect(screen.queryByRole("textbox")).toBeNull()
    viewer.id = "b"
    viewer.pending = false
    view.rerender(
      <AccountGuard mode="identity" expectedScope="a">
        <PrivateForm />
      </AccountGuard>
    )
    expect(screen.queryByRole("textbox")).toBeNull()
    view.rerender(
      <AccountGuard mode="identity" expectedScope="b">
        <PrivateForm seed="B private draft" />
      </AccountGuard>
    )
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe(
      "B private draft"
    )
    expect(screen.queryByDisplayValue("Unsaved A-only detail")).toBeNull()
  })
})
