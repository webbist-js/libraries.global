// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

const f = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}))
vi.mock("@/components/billing/useMembershipRefresh", () => ({
  useMembershipRefresh: () => f.refresh,
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

it("saves a Team before billing, requires consent, and retries payment without another signup", async () => {
  f.fetch.mockResolvedValueOnce(Response.json({ teamId: "saved-team" }))
  render(
    <TeamSignup
      available
      verified
      initialSeats={5}
      sandbox
      user={{ name: "Organiser", email: "organiser@example.test" }}
    />
  )
  fireEvent.change(screen.getByPlaceholderText("Bristol Libraries"), {
    target: { value: "Our libraries" },
  })
  fireEvent.click(screen.getByRole("radio", { name: /Public library service/ }))
  expect(screen.getByText(/Then £600 a year/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Continue to billing" }))
  await screen.findByRole("heading", { name: "Review your billing" })
  expect(f.fetch).toHaveBeenCalledOnce()
  expect(JSON.parse(f.fetch.mock.calls[0]![1].body)).toMatchObject({
    name: "Our libraries",
    publicServiceRequested: true,
  })
  const pay = screen.getByRole("button", {
    name: "Continue to payment",
  }) as HTMLButtonElement
  expect(pay.disabled).toBe(true)
  fireEvent.click(screen.getByRole("checkbox"))
  f.fetch.mockResolvedValueOnce(
    Response.json({ error: "unavailable" }, { status: 503 })
  )
  fireEvent.click(pay)
  await screen.findByRole("alert")
  f.fetch.mockResolvedValueOnce(
    Response.json({ error: "unavailable" }, { status: 503 })
  )
  fireEvent.click(screen.getByRole("button", { name: "Continue to payment" }))
  await waitFor(() => expect(f.fetch).toHaveBeenCalledTimes(3))
  expect(f.fetch.mock.calls.slice(1).map(([url]) => url)).toEqual([
    "/api/staff/team/saved-team/billing",
    "/api/staff/team/saved-team/billing",
  ])
  expect(JSON.parse(f.fetch.mock.calls[2]![1].body)).toEqual({
    action: "checkout",
    seats: 5,
    locale: "en",
    termsVersion: "1.2",
  })
})
