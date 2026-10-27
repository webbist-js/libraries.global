// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { BillingSummary } from "@/components/billing/types"

import {
  MembershipDashboard,
  type MembershipDashboardProps,
} from "../MembershipDashboard"

import messages from "../../../../locales/en.json"

const { controller, preferences } = vi.hoisted(() => ({
  controller: {
    summary: null as BillingSummary | null,
    error: false,
    busy: false,
    reload: vi.fn(),
    manage: vi.fn(),
    undo: vi.fn(),
  },
  preferences: vi.fn(),
}))
vi.mock("../useMembershipBilling", () => ({
  useMembershipBilling: () => controller,
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string
    children: ReactNode
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
vi.mock("@/components/community/SupporterPreferences", () => ({
  SupporterPreferences: (props: unknown) => {
    preferences(props)

    return <div>Recognition controls</div>
  },
}))
vi.mock("@/components/membership/PersonalBillingPanel", () => ({
  PersonalBillingPanel: () => (
    <section aria-label="Personal billing">Personal billing</section>
  ),
}))

const base: MembershipDashboardProps = {
  asOf: Date.parse("2026-10-27"),
  plan: "pro",
  source: "team",
  staffCount: 0,
  teams: [
    {
      id: "team-id",
      name: "Research group",
      slug: "research",
      role: "organiser",
      libraryCount: 0,
      status: "active",
      expiresAt: "2099-01-01",
    },
  ],
  recognition: { listed: false, badgeVisible: false, visibility: "private" },
}
const summary: BillingSummary = {
  membership: null,
  effectivePlan: "pro",
  accessSource: "team",
  canManage: true,
  available: true,
  invoices: [],
}
function show(props: Partial<MembershipDashboardProps> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <MembershipDashboard {...base} {...props} />
    </NextIntlClientProvider>
  )
}
beforeEach(() => {
  controller.summary = summary
  controller.error = false
  preferences.mockClear()
})
afterEach(cleanup)

it("explains a claim-free Team seat without showing an empty personal subscription", () => {
  show()
  expect(
    screen.getByText(
      /Your Pro tools are included with your seat in Research group/
    )
  ).toBeTruthy()
  expect(screen.getByText("Active access")).toBeTruthy()
  expect(screen.queryByRole("region", { name: "Personal billing" })).toBeNull()
  expect(
    screen
      .getByRole("link", { name: "Manage Team billing" })
      .getAttribute("href")
  ).toBe("/staff/teams/billing")
  expect(screen.getByText(/your membership works without it/)).toBeTruthy()
  expect(
    screen.getByRole("link", { name: "How it works" }).getAttribute("href")
  ).toBe("/plans#library-staff-h")
  expect(
    screen
      .getByRole("link", { name: "Cancellation and refunds" })
      .getAttribute("href")
  ).toBe("/legal/cancellation-refunds")
  expect(
    screen.getByRole("link", { name: "Ask a question" }).dataset.contactType
  ).toBe("membership_support")
  expect(preferences).toHaveBeenCalledWith(base.recognition)
})
it("takes a Team member to their workspace rather than offering Organiser billing controls", () => {
  show({ teams: [{ ...base.teams[0]!, role: "member" }] })
  expect(screen.queryByRole("link", { name: "Manage Team billing" })).toBeNull()
  expect(
    screen.getByText(/Your Organiser manages the Team subscription/)
  ).toBeTruthy()
})
it("retains personal subscription history alongside a Team seat", () => {
  controller.summary = {
    ...summary,
    invoices: [
      {
        id: "invoice",
        number: null,
        created: 0,
        currency: "gbp",
        total: 500,
        status: "paid",
        pdf: null,
      },
    ],
  }
  show()
  expect(screen.getByRole("region", { name: "Personal billing" })).toBeTruthy()
  expect(
    screen.getByRole("region", { name: "Your Team membership" })
  ).toBeTruthy()
})
it("uses settled free access when a previously paid entitlement has ended", () => {
  controller.summary = {
    ...summary,
    effectivePlan: "free",
    accessSource: "none",
    canManage: false,
  }
  show({ teams: [] })
  expect(screen.queryByText("Active access")).toBeNull()
  expect(
    screen.getByRole("link", { name: "Explore plans" }).getAttribute("href")
  ).toBe("/plans")
  expect(preferences).not.toHaveBeenCalled()
  expect(screen.getByText(/no subscription or recurring charge/)).toBeTruthy()
})
it("does not invent recognition defaults when the profile lookup fails", () => {
  show({ recognition: null })
  expect(screen.getByRole("status").textContent).toContain(
    "couldn’t load your profile preferences"
  )
  expect(preferences).not.toHaveBeenCalled()
})
it("keeps inactive Team billing and approved staff access reachable without promising Team tools", () => {
  controller.summary = {
    ...summary,
    effectivePlan: "free",
    accessSource: "none",
    canManage: false,
  }
  show({
    teams: [{ ...base.teams[0]!, status: "lapsed", expiresAt: "2026-01-01" }],
    staffCount: 1,
  })
  expect(screen.getByText("Inactive Team")).toBeTruthy()
  expect(screen.getByText(/This Team membership is inactive/)).toBeTruthy()
  expect(
    screen
      .getByRole("link", { name: "Manage Team billing" })
      .getAttribute("href")
  ).toBe("/staff/teams/billing")
  expect(
    screen
      .getByRole("link", { name: "Manage your libraries" })
      .getAttribute("href")
  ).toBe("/staff")
  expect(screen.queryByRole("heading", { name: "Team data tools" })).toBeNull()
})
it("keeps billing loading and errors actionable without hiding known Team access", () => {
  controller.summary = null
  controller.error = true
  show()
  expect(screen.getByText("Active access")).toBeTruthy()
  expect(screen.getByRole("region", { name: "Personal billing" })).toBeTruthy()
})
