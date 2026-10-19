// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { refreshMembership, openContact } = vi.hoisted(() => ({
  refreshMembership: vi.fn(),
  openContact: vi.fn(),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/contact/ContactModalProvider", () => ({
  useContactModal: () => ({ openContact }),
}))
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
  openContact.mockReset()
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
  fireEvent.click(
    screen.getByRole("button", { name: "types.membership_support" })
  )
  expect(openContact).toHaveBeenCalledWith("membership_support")
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
  expect(
    screen.queryByRole("button", { name: "types.membership_support" })
  ).toBeNull()
})
it.each(["supporter", "pro", "team"])(
  "offers support for %s access without a personal paid subscription",
  async (effectivePlan) => {
    fetcher.mockResolvedValue({
      ok: true,
      json: async () => ({ ...base, canManage: false, effectivePlan }),
    })
    render(<MembershipBillingSection />)
    await act(() => vi.advanceTimersByTimeAsync(0))
    fireEvent.click(
      screen.getByRole("button", { name: "types.membership_support" })
    )
    expect(openContact).toHaveBeenCalledWith("membership_support")
  }
)
it("keeps billing support available when payment problems remove membership access", async () => {
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({
      ...base,
      membership: { ...member, status: "past_due", graceExpired: true },
    }),
  })
  render(<MembershipBillingSection />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  fireEvent.click(
    screen.getByRole("button", { name: "types.membership_support" })
  )
  expect(openContact).toHaveBeenCalledWith("membership_support")
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

it("keeps payment details, invoice downloads and scheduled-change actions available", async () => {
  fetcher.mockResolvedValue({
    ok: true,
    json: async () => ({
      ...base,
      membership: member,
      effectivePlan: "pro",
      accessSource: "paid",
      paymentMethod: {
        brand: "visa",
        last4: "4242",
        expiryMonth: 12,
        expiryYear: 2030,
        wallet: null,
      },
      billingDetails: {
        name: "Library Reader",
        email: "reader@example.org",
        postalCode: "LS1",
      },
      scheduledChange: {
        plan: "supporter",
        interval: "month",
        date: 4070908800,
        unitAmount: 500,
        currency: "gbp",
        canUndo: true,
      },
      invoices: [
        {
          id: "inv-1",
          number: "INV-001",
          created: 1791763200,
          currency: "gbp",
          total: 5000,
          status: "paid",
          pdf: "https://billing.stripe.com/invoice.pdf",
        },
      ],
    }),
  })
  render(<MembershipBillingSection />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByText("VISA")).toBeTruthy()
  expect(screen.getByText(/Library Reader/)).toBeTruthy()
  expect(screen.getByRole("region", { name: "invoices" })).toBeTruthy()
  const download = screen.getByRole("link", { name: "download INV-001" })
  expect(download.getAttribute("href")).toBe(
    "https://billing.stripe.com/invoice.pdf"
  )
  expect(download.getAttribute("rel")).toBe("noopener noreferrer")
  fireEvent.click(screen.getByRole("button", { name: "undoScheduledChange" }))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(fetcher).toHaveBeenCalledWith(
    "/api/billing/undo-change",
    expect.objectContaining({ method: "POST" })
  )
})

it("shows a loading status while membership details are pending", () => {
  fetcher.mockReturnValue(new Promise(() => {}))
  render(<MembershipBillingSection />)
  expect(screen.getByRole("status").textContent).toBe("loading")
})

it("lets the member retry a failed summary without opening a payment flow", async () => {
  fetcher.mockResolvedValueOnce({ ok: false })
  render(<MembershipBillingSection />)
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.getByRole("alert").textContent).toContain("error")
  fetcher.mockResolvedValue({ ok: true, json: async () => base })
  fireEvent.click(screen.getByRole("button", { name: "retry" }))
  await act(() => vi.advanceTimersByTimeAsync(0))
  expect(screen.queryByRole("alert")).toBeNull()
  expect(screen.getByRole("heading", { name: "noMembership" })).toBeTruthy()
  expect(
    fetcher.mock.calls.every(([url]) => url === "/api/billing/summary")
  ).toBe(true)
})
