// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const refreshMembership = vi.hoisted(() => vi.fn())
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))
vi.mock("@/components/billing/useMembershipRefresh", () => ({
  useMembershipRefresh: () => refreshMembership,
}))
vi.mock("@/components/billing/PlanChangeDialog", () => ({
  PlanChangeDialog: () => null,
}))
vi.mock("@/components/profile-form/FormParts", () => ({
  SectionCard: ({ children }: { children: ReactNode }) => (
    <section>{children}</section>
  ),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
import { MembershipBillingSection } from "../MembershipBillingSection"

const fetcher = vi.fn()
const base = {
  available: true,
  canManage: true,
  membership: null,
  effectivePlan: "free",
  accessSource: "none",
  invoices: [],
}
const member = {
  mode: "sandbox",
  plan: "pro",
  interval: "year",
  status: "active",
  currency: "gbp",
  unitAmount: 5000,
  memberSince: "2026-10-12T00:00:00Z",
  periodEnd: "2099-01-01T00:00:00Z",
  paidThrough: "2099-01-01T00:00:00Z",
  cancelAtPeriodEnd: false,
  revoked: false,
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("fetch", fetcher)
  fetcher.mockReset()
  refreshMembership.mockReset().mockResolvedValue(undefined)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("updates a paid purchase from confirming to Pro access in the same logged-in page", async () => {
  let calls = 0,
    refreshed = false
  refreshMembership.mockImplementation(async () => {
    refreshed = true
  })
  fetcher.mockImplementation(async () => ({
    ok: true,
    json: async () =>
      ++calls === 1
        ? { ...base, confirmationPending: true }
        : {
            ...base,
            confirmationPending: false,
            membership: member,
            effectivePlan: refreshed ? "pro" : "free",
            accessSource: refreshed ? "paid" : "none",
          },
  }))
  render(<MembershipBillingSection />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByRole("heading", { name: "confirming" })).toBeTruthy()
  expect(screen.queryByText("noMembership")).toBeNull()
  await act(() => vi.advanceTimersByTimeAsync(5000))
  expect(screen.getByRole("heading", { name: "pro" })).toBeTruthy()
  expect(screen.getByText(/accessPlans.pro/)).toBeTruthy()
  expect(refreshMembership).toHaveBeenCalledTimes(1)
  expect(
    fetcher.mock.calls.every(([url]) => url === "/api/billing/summary")
  ).toBe(true)
})
it("leaves a normal free account on the free state without payment polling", async () => {
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({
      ...base,
      canManage: false,
      confirmationPending: false,
    }),
  })
  render(<MembershipBillingSection />)
  await act(() => vi.advanceTimersByTimeAsync(20_000))
  expect(screen.getByRole("heading", { name: "noMembership" })).toBeTruthy()
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(refreshMembership).not.toHaveBeenCalled()
})
it("stops confirmation polling when the settings section closes", async () => {
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({ ...base, confirmationPending: true }),
  })
  const page = render(<MembershipBillingSection />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  page.unmount()
  await act(() => vi.advanceTimersByTimeAsync(20_000))
  expect(fetcher).toHaveBeenCalledTimes(1)
})
