// @vitest-environment happy-dom
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { PlanStatusBanner } from "@/app/[locale]/contribute/_components/membership/PlanStatusBanner"
import { cleanup, render, screen, within } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

afterEach(cleanup)

it.each([
  [
    "grant",
    /Granted by the Libraries Global team/,
    "Membership settings",
    "/profile/membership",
  ],
  [
    "earned",
    /accepted contributions at Archivist tier/,
    "See your contributions",
    "/contribute/submissions",
  ],
  [
    "verified",
    /verified library staff, a student or charity staff/,
    "Membership settings",
    "/profile/membership",
  ],
  [
    "team",
    /Your Pro access is included with your Team seat/,
    "Open the Staff area",
    "/staff",
  ],
  [
    "paid",
    /Manage your subscription, renewal and invoices/,
    "Manage membership",
    "/profile/membership",
  ],
] as const)(
  "explains %s access and offers the relevant management destination",
  (planSource, detail, action, href) => {
    render(<PlanStatusBanner plan="pro" planSource={planSource} />)
    const summary = within(
      screen.getByRole("region", { name: "Your membership" })
    )
    expect(summary.getByText(detail)).toBeTruthy()
    expect(
      summary.getByRole("link", { name: action }).getAttribute("href")
    ).toBe(href)
    expect(
      summary
        .getByRole("link", { name: "Choose your visibility" })
        .getAttribute("href")
    ).toBe("/profile/membership#recognition")
    expect(summary.queryByRole("checkbox")).toBeNull()
  }
)

it("keeps billing management accessible when complimentary access is combined with a paid membership", () => {
  render(<PlanStatusBanner plan="pro" planSource="earned" hasPaidMembership />)
  expect(screen.getByText("Complimentary")).toBeTruthy()
  expect(
    screen.getByRole("link", { name: "Manage membership" }).getAttribute("href")
  ).toBe("/profile/membership")
})

it("links verified library staff to their staff tools without sending students there", () => {
  render(<PlanStatusBanner plan="pro" planSource="verified" isStaff />)
  expect(
    screen
      .getByRole("link", { name: "Open the Staff area" })
      .getAttribute("href")
  ).toBe("/staff")
})

it("does not invent a source or payment exemption when a member's source is unavailable", () => {
  render(<PlanStatusBanner plan="supporter" planSource="unknown" />)
  expect(
    screen.getByText(
      "See your membership settings for access and billing details."
    )
  ).toBeTruthy()
  expect(screen.queryByText("Complimentary")).toBeNull()
  expect(screen.queryByText("Paid membership")).toBeNull()
  expect(screen.getByRole("link", { name: "Membership settings" })).toBeTruthy()
})

it.each(["public", "free", "unknown", null])(
  "does not show a member summary for %s access",
  (plan) => {
    render(<PlanStatusBanner plan={plan} planSource="grant" />)
    expect(screen.queryByRole("region", { name: "Your membership" })).toBeNull()
  }
)
