// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
import { CheckoutFlow } from "./CheckoutFlow"

const buyer = {
  email: "owner@example.org",
  verified: true,
  complimentaryPro: false,
}
const catalogue = {
  available: true,
  sandbox: true,
  prices: [
    { plan: "supporter", interval: "month", currency: "gbp", unitAmount: 300 },
    { plan: "supporter", interval: "year", currency: "gbp", unitAmount: 3000 },
    { plan: "pro", interval: "month", currency: "gbp", unitAmount: 500 },
    { plan: "pro", interval: "year", currency: "gbp", unitAmount: 5000 },
  ],
}
const fetcher = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetcher)
  fetcher
    .mockReset()
    .mockResolvedValue({ ok: true, json: async () => catalogue })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe("checkout account and payment handoff", () => {
  it.each([
    ["supporter", "month"],
    ["supporter", "year"],
    ["pro", "month"],
    ["pro", "year"],
  ] as const)(
    "hands off %s/%s only after consent, without public-credit opt-in",
    async (plan, interval) => {
      fetcher.mockImplementation(async (url: string) => ({
        ok: url !== "/api/billing/checkout",
        json: async () => catalogue,
      }))
      render(
        <CheckoutFlow
          user={buyer}
          initialPlan={plan}
          initialInterval={interval}
        />
      )
      fireEvent.click(await screen.findByRole("button", { name: "join" }))
      const pay = screen.getByRole("button", {
        name: "continueStripe",
      }) as HTMLButtonElement
      expect(pay.disabled).toBe(true)
      expect(
        fetcher.mock.calls.some(([url]) => url === "/api/billing/checkout")
      ).toBe(false)
      fireEvent.click(screen.getByRole("checkbox", { name: /termsConsent/ }))
      fireEvent.click(pay)
      await screen.findByRole("alert")
      const calls = fetcher.mock.calls
      expect(
        JSON.parse(
          calls.find(([url]) => url === "/api/billing/checkout")![1].body
        )
      ).toMatchObject({ plan, interval, locale: "en" })
      expect(
        JSON.parse(calls.find(([url]) => url === "/api/profile/me")![1].body)
      ).toEqual({ supporterListed: false, supporterBadgeVisible: true })
      expect(pay.disabled).toBe(false)
    }
  )
  it("uses the annual choice from the summary and returns focus when changing steps", async () => {
    render(<CheckoutFlow user={buyer} initialPlan="supporter" />)
    fireEvent.click(await screen.findByRole("button", { name: /switchYearly/ }))
    expect(
      (screen.getByRole("radio", { name: /year/ }) as HTMLInputElement).checked
    ).toBe(true)
    expect(screen.getAllByText(/£30.00/).length).toBeGreaterThan(0)
    expect(screen.queryByRole("button", { name: /switchYearly/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "join" }))
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "yourDetails" })
    )
    fireEvent.click(screen.getByRole("button", { name: "back" }))
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { name: "choose" })
    )
  })
  it("shows the full annual amount and requires recurring terms before payment", async () => {
    render(<CheckoutFlow user={buyer} initialInterval="year" />)
    await screen.findAllByText(/£50.00/)
    fireEvent.click(screen.getByRole("button", { name: "join" }))
    const pay = screen.getByRole("button", {
      name: "continueStripe",
    }) as HTMLButtonElement
    expect(pay.disabled).toBe(true)
    fireEvent.click(screen.getByRole("checkbox", { name: /termsConsent/ }))
    expect(pay.disabled).toBe(false)
    expect(
      (screen.getByRole("checkbox", { name: /credit/ }) as HTMLInputElement)
        .checked
    ).toBe(false)
    expect(screen.queryByLabelText(/card number/i)).toBeNull()
  })
  it("preserves an owned return attempt through sign-in", async () => {
    render(<CheckoutFlow user={null} attempt="owned-attempt" />)
    expect(
      screen.getByRole("link", { name: "signIn" }).getAttribute("href")
    ).toContain("attempt%3Downed-attempt")
    expect(screen.queryByText("thankYou")).toBeNull()
    await waitFor(() => expect(fetcher).toHaveBeenCalled())
  })
  it("allows a canceled hosted checkout to return to plan selection", async () => {
    render(<CheckoutFlow user={buyer} attempt="owned-attempt" cancelled />)
    await screen.findByRole("button", { name: "join" })
    expect(
      fetcher.mock.calls.every(([url]) => !String(url).includes("/status"))
    ).toBe(true)
  })
  it("does not show Thank you while access is awaiting backend sync", async () => {
    fetcher.mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        url.includes("/status") ? { state: "sync_pending" } : catalogue,
    }))
    render(<CheckoutFlow user={buyer} attempt="owned-attempt" />)
    await waitFor(() =>
      expect(fetcher).toHaveBeenCalledWith(
        expect.stringContaining("/status?attempt=owned-attempt"),
        expect.anything()
      )
    )
    expect(screen.queryByText("thankYou")).toBeNull()
    expect(screen.getByText("confirming")).toBeTruthy()
  })
})
