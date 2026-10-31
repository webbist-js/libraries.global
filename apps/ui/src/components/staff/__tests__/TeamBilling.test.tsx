// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { TeamBillingDashboard } from "@/lib/team-billing/types"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

const f = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/billing/useMembershipRefresh", () => ({
  useMembershipRefresh: () => f.refresh,
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useRouter: () => ({ push: f.push, replace: f.replace }),
}))
import { TeamBilling } from "../TeamBilling"

const initial: TeamBillingDashboard = {
  teamId: "team00000000000000000001",
  name: "Test Team",
  organiser: true,
  source: "checkout",
  active: false,
  used: 1,
  seats: 5,
  purchasing: true,
  discounted: false,
  mode: "sandbox",
  pending: false,
  synced: true,
  membership: null,
}
beforeEach(() => {
  sessionStorage.clear()
  vi.clearAllMocks()
  vi.stubGlobal("fetch", f.fetch)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe("Team billing controls", () => {
  it("requires consent and sends only seats, locale and terms to checkout", async () => {
    render(
      <TeamBilling initial={initial} initialSeats={6} confirming={false} />
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Set up annual billing" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Continue to billing" }))
    const subscribe = screen.getByRole("button", {
      name: "Continue to payment",
    }) as HTMLButtonElement
    expect(subscribe.disabled).toBe(true)
    expect(screen.getByText(/Then £720 a year/)).toBeTruthy()
    fireEvent.click(screen.getByRole("checkbox", { name: /I accept the/ }))
    expect(subscribe.disabled).toBe(false)
    f.fetch.mockResolvedValueOnce(
      Response.json(
        { error: "team_payment_confirmation_pending" },
        { status: 409 }
      )
    )
    fireEvent.click(subscribe)
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Payment confirmation is pending"
      )
    )
    expect(JSON.parse(f.fetch.mock.calls[0]![1].body)).toEqual({
      action: "checkout",
      seats: 6,
      locale: "en",
      termsVersion: "1.2",
    })
  })
  it("keeps member billing read-only and preserves the purchase gate", () => {
    const { unmount } = render(
      <TeamBilling
        initial={{ ...initial, organiser: false }}
        initialSeats={5}
        confirming={false}
      />
    )
    expect(
      screen.queryByRole("button", { name: "Set up annual billing" })
    ).toBeNull()
    unmount()
    render(
      <TeamBilling
        initial={{ ...initial, purchasing: false }}
        initialSeats={5}
        confirming={false}
      />
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Set up annual billing",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })
  it("does not recheck an already settled checkout or show a pending warning", async () => {
    render(
      <TeamBilling
        initial={{ ...initial, active: true }}
        initialSeats={5}
        confirming
      />
    )
    await waitFor(() => expect(f.refresh).toHaveBeenCalledOnce())
    expect(f.fetch).not.toHaveBeenCalled()
    expect(screen.getByRole("status").textContent).toContain(
      "Your Team is active"
    )
    expect(screen.queryByRole("alert")).toBeNull()
  })
  it("still reconciles a Portal return when the previous snapshot is active", async () => {
    f.fetch.mockResolvedValueOnce(Response.json({ ...initial, active: true }))
    render(
      <TeamBilling
        initial={{ ...initial, active: true }}
        initialSeats={5}
        confirming
        refreshRequired
      />
    )
    await waitFor(() => expect(f.fetch).toHaveBeenCalledOnce())
    expect(JSON.parse(f.fetch.mock.calls[0]![1].body)).toEqual({
      action: "refresh",
    })
    await waitFor(() => expect(f.refresh).toHaveBeenCalledOnce())
  })
  it("clears a delayed confirmation warning when the dashboard settles", async () => {
    vi.useFakeTimers()
    try {
      f.fetch.mockResolvedValueOnce(
        Response.json({ error: "confirmation_delayed" }, { status: 503 })
      )
      f.fetch.mockResolvedValueOnce(Response.json({ ...initial, active: true }))
      render(
        <TeamBilling
          initial={{ ...initial, pending: true }}
          initialSeats={5}
          confirming
        />
      )
      await act(async () => {
        await Promise.resolve()
      })
      expect(screen.getByRole("alert").textContent).toContain(
        "still being checked"
      )
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      expect(screen.queryByRole("alert")).toBeNull()
      expect(screen.getByRole("status").textContent).toContain(
        "Your Team is active"
      )
      expect(f.refresh).toHaveBeenCalledOnce()
    } finally {
      cleanup()
      vi.useRealTimers()
    }
  })
})

it("offers the separate API purchase path after Team activation", () => {
  render(
    <TeamBilling
      initial={{ ...initial, active: true }}
      initialSeats={5}
      confirming={false}
    />
  )
  expect(
    screen
      .getByRole("link", { name: "API access and usage" })
      .getAttribute("href")
  ).toBe("/developers")
  expect(f.fetch).not.toHaveBeenCalled()
})

it("waits for verified Team activation before the optional API step and lets the organiser skip it", () => {
  sessionStorage.setItem(
    "lg.team-api-next.v1:" + initial.teamId,
    JSON.stringify({ selected: true, expires: Date.now() + 3_600_000 })
  )
  const view = render(
    <TeamBilling initial={initial} initialSeats={5} confirming={false} />
  )
  expect(
    (
      screen.getByRole("button", {
        name: "Waiting for Team activation",
      }) as HTMLButtonElement
    ).disabled
  ).toBe(true)
  expect(
    screen.queryByRole("link", { name: "Continue to API checkout" })
  ).toBeNull()
  view.unmount()
  render(
    <TeamBilling
      initial={{ ...initial, active: true }}
      initialSeats={5}
      confirming={false}
    />
  )
  expect(
    screen
      .getByRole("link", { name: "Continue to API checkout" })
      .getAttribute("href")
  ).toBe("/developers?setup=1")
  fireEvent.click(screen.getByRole("button", { name: "Skip API for now" }))
  expect(
    sessionStorage.getItem("lg.team-api-next.v1:" + initial.teamId)
  ).toBeNull()
  expect(
    screen.queryByRole("link", { name: "Continue to API checkout" })
  ).toBeNull()
})
