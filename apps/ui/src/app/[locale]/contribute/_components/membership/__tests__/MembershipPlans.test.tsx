// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

vi.mock("@iconify/react", () => ({ Icon: () => null }))

const { translate } = vi.hoisted(() => ({
  translate: (key: string) => key,
}))
vi.mock("next-intl", () => ({
  useTranslations: () => translate,
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/components/billing/CheckoutButton", () => ({
  CheckoutButton: ({ plan, interval }: { plan: string; interval: string }) => (
    <button type="button">
      Checkout {plan} {interval}
    </button>
  ),
}))

import { MembershipPlans } from "../MembershipPlans"

afterEach(cleanup)

it("estimates annual Team seats, scopes the public-service discount and keeps API billing separate", () => {
  render(<MembershipPlans currentPlan="public" />)
  const team = within(screen.getByRole("listitem", { name: "Team" }))
  const remove = team.getByRole("button", { name: "Remove a Team seat" })
  expect((remove as HTMLButtonElement).disabled).toBe(true)
  expect(team.getByText("£600")).toBeTruthy()

  fireEvent.click(team.getByRole("button", { name: "Add a Team seat" }))
  expect(team.getByText("£720")).toBeTruthy()
  expect(team.getByText("6 seats")).toBeTruthy()
  fireEvent.click(team.getByRole("radio", { name: /Public library service/ }))
  expect(team.getByText("£576")).toBeTruthy()
  expect(team.getByText("£480 / year")).toBeTruthy()
  expect(team.getByText("£96 / year")).toBeTruthy()
  expect(team.getByText("£15 / month")).toBeTruthy()

  fireEvent.click(screen.getByRole("radio", { name: /Yearly/ }))
  expect(team.getByText("£576")).toBeTruthy()
  fireEvent.click(remove)
  expect(team.getByText("£480")).toBeTruthy()
  expect((remove as HTMLButtonElement).disabled).toBe(true)
  expect(
    team.getByRole("link", { name: "Talk to us" }).getAttribute("href")
  ).toBe("mailto:info@libraries.global?subject=Team%20plan")
})

it("switches personal prices and checkout intervals with keyboard focus following the selected radio", () => {
  render(
    <MembershipPlans currentPlan="free" billingAvailable supporterApproved />
  )
  expect(
    screen.getByRole("button", { name: "Checkout supporter month" })
  ).toBeTruthy()
  expect(
    screen.getByRole("button", { name: "Checkout pro month" })
  ).toBeTruthy()
  const monthly = screen.getByRole("radio", { name: "Monthly" })
  const yearly = screen.getByRole("radio", { name: /Yearly/ })
  monthly.focus()
  fireEvent.keyDown(monthly, { key: "ArrowRight" })
  expect(document.activeElement).toBe(yearly)
  expect(yearly.getAttribute("aria-checked")).toBe("true")
  expect(screen.getByText("£30")).toBeTruthy()
  expect(screen.getByText("£50")).toBeTruthy()
  expect(screen.getByRole("button", { name: "Checkout pro year" })).toBeTruthy()
  fireEvent.keyDown(yearly, { key: "Home" })
  expect(document.activeElement).toBe(monthly)
  expect(screen.getByText("£5")).toBeTruthy()
})

it("preserves the Supporter release gate without blocking approved Pro checkout", () => {
  render(<MembershipPlans currentPlan="free" billingAvailable />)
  expect(
    screen.getByRole("button", { name: "Checkout pro month" })
  ).toBeTruthy()
  expect(
    (screen.getByRole("button", { name: "Coming soon" }) as HTMLButtonElement)
      .disabled
  ).toBe(true)
})

it("takes existing paid members to management or the Atlas instead of a second checkout", () => {
  render(
    <MembershipPlans
      currentPlan="pro"
      billingAvailable
      supporterApproved
      checkoutUser={{
        email: "member@example.test",
        verified: true,
        complimentaryPro: false,
        hasPaidMembership: true,
      }}
    />
  )
  expect(screen.queryByRole("button", { name: /Checkout/ })).toBeNull()
  expect(
    screen.getByRole("link", { name: "Open the Atlas" }).getAttribute("href")
  ).toBe("/map")
  expect(
    screen.getByRole("link", { name: "Manage membership" }).getAttribute("href")
  ).toBe("/profile/settings#membership")
})

it("keeps Team enquiries available for current Team members", () => {
  render(<MembershipPlans currentPlan="team" />)
  const team = within(screen.getByRole("listitem", { name: "Team" }))
  expect(team.getByText("Your plan")).toBeTruthy()
  expect(team.getByRole("link", { name: "Talk to us" })).toBeTruthy()
})

it("reveals planned features independently without adding them to the included list", () => {
  render(<MembershipPlans currentPlan="free" />)
  const proList = screen
    .getByText("Private notes on any library")
    .closest("ul")!
  const teamList = screen.getByText("A shared service workspace").closest("ul")!
  expect(proList.hidden).toBe(true)
  fireEvent.click(
    screen.getByRole("button", { name: "Show all Pro roadmap features" })
  )
  expect(proList.hidden).toBe(false)
  expect(teamList.hidden).toBe(true)
  fireEvent.click(
    screen.getByRole("button", { name: "Show all Team roadmap features" })
  )
  expect(teamList.hidden).toBe(false)
  fireEvent.click(
    screen.getByRole("button", { name: "Show less Pro roadmap features" })
  )
  expect(proList.hidden).toBe(true)
  expect(teamList.hidden).toBe(false)
})
