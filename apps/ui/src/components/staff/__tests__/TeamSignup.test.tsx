// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

const f = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/billing/useMembershipRefresh", () => ({
  useMembershipRefresh: () => f.refresh,
}))
vi.mock("@/components/networks/TeamNetworkChoice", () => ({
  TeamNetworkChoice: ({ onChoose }: { onChoose: (v: null) => void }) => (
    <button type="button" onClick={() => onChoose(null)}>
      Choose libraries myself
    </button>
  ),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: f.push }),
}))
import { TeamSignup } from "../TeamSignup"

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", f.fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("creates a free Team with a stable request id and no seat or payment step", async () => {
  f.fetch.mockResolvedValue(Response.json({ teamId: "saved-team" }))
  render(
    <TeamSignup
      verified
      user={{ name: "Organiser", email: "organiser@example.test" }}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Choose libraries myself" })
  )
  fireEvent.change(screen.getByLabelText("Team name"), {
    target: { value: "Our libraries" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Create your Team" }))
  await waitFor(() => expect(f.push).toHaveBeenCalledWith("/staff/teams"))
  const body = JSON.parse(f.fetch.mock.calls[0]![1].body)
  expect(f.fetch.mock.calls[0]![0]).toBe("/api/billing/teams")
  expect(body).toMatchObject({ name: "Our libraries" })
  expect(body.requestId).toMatch(/^[\da-f-]{36}$/)
  expect(body).not.toHaveProperty("seats")
  expect(f.refresh).toHaveBeenCalled()
})

it("explains when the account already belongs to a Team", async () => {
  f.fetch.mockResolvedValue(
    Response.json({ error: "organisation_exists" }, { status: 409 })
  )
  render(
    <TeamSignup
      verified
      user={{ name: "Organiser", email: "organiser@example.test" }}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Choose libraries myself" })
  )
  fireEvent.change(screen.getByLabelText("Team name"), {
    target: { value: "Ours" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Create your Team" }))
  expect((await screen.findByRole("alert")).textContent).toContain(
    "already belongs to a Team"
  )
  expect(f.push).not.toHaveBeenCalled()
})
