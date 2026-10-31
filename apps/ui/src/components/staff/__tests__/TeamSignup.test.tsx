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
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: f.push }),
}))
import { TeamSignup } from "../TeamSignup"

beforeEach(() => {
  sessionStorage.clear()
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
  fireEvent.click(
    screen.getByRole("button", { name: "Choose libraries myself" })
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
  const pay = (await screen.findByRole("button", {
    name: "Continue to payment",
  })) as HTMLButtonElement
  expect(pay.disabled).toBe(true)
  fireEvent.click(screen.getByRole("checkbox", { name: /I accept the/ }))
  f.fetch.mockResolvedValueOnce(
    Response.json({ error: "unavailable" }, { status: 503 })
  )
  fireEvent.click(pay)
  await screen.findByRole("alert")
  f.fetch.mockResolvedValueOnce(
    Response.json({ error: "unavailable" }, { status: 503 })
  )
  fireEvent.click(
    await screen.findByRole("button", { name: "Continue to payment" })
  )
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

it("preserves the estimator API choice through Team creation without including it in the annual charge", async () => {
  f.fetch.mockResolvedValueOnce(Response.json({ teamId: "chosen-api-team" }))
  render(
    <TeamSignup
      available
      verified
      initialSeats={7}
      initialApiAddon
      initialPublicService
      sandbox
      user={{ name: "Organiser", email: "organiser@example.test" }}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Choose libraries myself" })
  )
  const selected = screen.getByRole("checkbox", {
    name: /Add API access after Team payment/,
  }) as HTMLInputElement
  expect(selected.checked).toBe(true)
  expect(
    (
      screen.getByRole("radio", {
        name: /Public library service/,
      }) as HTMLInputElement
    ).checked
  ).toBe(true)
  fireEvent.change(screen.getByPlaceholderText("Bristol Libraries"), {
    target: { value: "Our Team" },
  })
  fireEvent.click(screen.getByRole("button", { name: "Continue to billing" }))
  await screen.findByRole("heading", { name: "Review your billing" })
  expect(
    JSON.parse(sessionStorage.getItem("lg.team-api-next.v1:chosen-api-team")!)
      .selected
  ).toBe(true)
  expect(JSON.parse(f.fetch.mock.calls[0]![1].body)).not.toHaveProperty(
    "apiAddon"
  )
  expect(screen.getByText("API add-on selected")).toBeTruthy()
})
