// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { PlanStatusBanner } from "@/app/[locale]/contribute/_components/membership/PlanStatusBanner"
import { cleanup, fireEvent, render, screen, within } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))

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
    team.getByRole("link", { name: "Create your Team" }).getAttribute("href")
  ).toBe("/staff/teams/new?seats=5")
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
  expect(team.getByRole("link", { name: "Create your Team" })).toBeTruthy()
})

it("reveals planned features independently without adding them to the included list", () => {
  render(<MembershipPlans currentPlan="free" />)
  const proList = screen
    .getByText("Private notes on any library")
    .closest("ul")!
  const teamList = screen
    .getByText("Shared Atlas analysis workspace")
    .closest("ul")!
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

it("keeps service choices keyboard accessible and the quote separate from personal billing", () => {
  render(<MembershipPlans currentPlan="free" />)
  const team = within(screen.getByRole("listitem", { name: "Team" }))
  const service = within(team.getByRole("radiogroup", { name: "Team pricing" }))
  const standard = service.getByRole("radio", { name: /^Standard/ })
  const publicService = service.getByRole("radio", {
    name: /^Public library service/,
  })
  standard.focus()
  fireEvent.keyDown(standard, { key: "ArrowRight" })
  expect(document.activeElement).toBe(publicService)
  expect(publicService.getAttribute("aria-checked")).toBe("true")
  const quote = within(team.getByRole("region", { name: "Estimate your Team" }))
  expect(quote.getByText("£480")).toBeTruthy()
  expect(quote.getByText("£15 / month")).toBeTruthy()
  expect(
    quote.getByText(
      /eligibility is confirmed separately before discounted checkout/
    )
  ).toBeTruthy()
  expect(
    quote.getByText(
      /not included in this estimate or the public library service discount/
    )
  ).toBeTruthy()
  fireEvent.keyDown(publicService, { key: "Home" })
  expect(document.activeElement).toBe(standard)
  expect(quote.getByText("£600")).toBeTruthy()
  expect(
    quote.queryByText(
      /eligibility is confirmed separately before discounted checkout/
    )
  ).toBeNull()
})

it("keeps complimentary access in one summary and preserves the option to support the project", () => {
  render(
    <>
      <PlanStatusBanner plan="pro" planSource="grant" />
      <MembershipPlans
        currentPlan="pro"
        billingAvailable
        supporterApproved
        checkoutUser={{
          email: "editor@example.test",
          verified: true,
          complimentaryPro: true,
          hasPaidMembership: false,
        }}
      />
    </>
  )
  expect(
    screen.getAllByText(
      "Granted by the Libraries Global team, with no payment required for this access."
    )
  ).toHaveLength(1)
  expect(
    screen.getAllByRole("region", { name: "Public recognition" })
  ).toHaveLength(1)
  expect(screen.queryByRole("link", { name: /check eligibility/ })).toBeNull()
  expect(screen.getByRole("link", { name: "Open the Atlas" })).toBeTruthy()
  expect(
    screen.getByRole("button", { name: "Checkout supporter month" })
  ).toBeTruthy()
  expect(
    screen.queryByRole("button", { name: "Checkout pro month" })
  ).toBeNull()
})

it("offers Team management to a Pro subscriber who already belongs to a Team", () => {
  render(
    <MembershipPlans
      currentPlan="pro"
      teams={[
        {
          id: "paid-team",
          name: "LibrariesGlobal",
          slug: "librariesglobal",
          role: "organiser",
          libraryCount: 0,
          status: "active",
          expiresAt: null,
        },
      ]}
    />
  )
  expect(
    screen.getByRole("link", { name: "Manage your Team" }).getAttribute("href")
  ).toBe("/staff/teams")
  expect(screen.queryByRole("link", { name: "Create your Team" })).toBeNull()
})
