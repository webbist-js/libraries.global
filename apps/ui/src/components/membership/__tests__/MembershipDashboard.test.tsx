// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import messages from "../../../../locales/en"
import { membershipPropsOf } from "../membership-props"
import {
  MembershipDashboard,
  type MembershipDashboardProps,
} from "../MembershipDashboard"

const { preferences } = vi.hoisted(() => ({ preferences: vi.fn() }))
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

const base: MembershipDashboardProps = {
  acceptedContributions: 37,
  recentlyActive: true,
  staffLibraries: [],
  teams: [],
  apiAccounts: [],
  recognition: { listed: false, badgeVisible: false, visibility: "private" },
}
function show(props: Partial<MembershipDashboardProps> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <MembershipDashboard {...base} {...props} />
    </NextIntlClientProvider>
  )
}
beforeEach(() => preferences.mockClear())
afterEach(cleanup)

it("shows earned standing with the count, progress to Supporter and separate activity", () => {
  show()
  expect(screen.getByText("Contributor")).toBeTruthy()
  expect(screen.getByText("37 accepted contributions")).toBeTruthy()
  expect(screen.getByText("Recently active")).toBeTruthy()
  const bar = screen.getByRole("progressbar", { name: "Progress to Supporter" })
  expect(bar.getAttribute("aria-valuenow")).toBe("37")
  expect(bar.getAttribute("aria-valuemax")).toBe("100")
  expect(
    screen.getByText("63 more accepted contributions to Supporter")
  ).toBeTruthy()
  // Recognition preferences belong to Supporters only.
  expect(preferences).not.toHaveBeenCalled()
})

it("shows Supporter by count only, with no 'since' date", () => {
  show({ acceptedContributions: 140, recentlyActive: false })
  expect(screen.getAllByText("Supporter").length).toBeGreaterThan(0)
  expect(screen.getByText("140 accepted contributions")).toBeTruthy()
  expect(screen.getByText("Not recently active")).toBeTruthy()
  expect(screen.getByText("You’ve reached Supporter.")).toBeTruthy()
  expect(document.body.textContent).not.toMatch(/since/i)
  expect(preferences).toHaveBeenCalledWith(base.recognition)
})

it("reads a revoked recognition as Explorer", () => {
  show({ acceptedContributions: 140, recognitionRevoked: true })
  expect(screen.getByText("Explorer")).toBeTruthy()
  expect(screen.getByText("0 accepted contributions")).toBeTruthy()
})

it("does not invent recognition defaults when the profile lookup fails", () => {
  show({ acceptedContributions: 120, recognition: null })
  expect(screen.getByRole("status").textContent).toContain(
    "couldn’t load your profile preferences"
  )
  expect(preferences).not.toHaveBeenCalled()
})

it("lists verified staff libraries separately from organisations", () => {
  show({
    staffLibraries: [
      {
        id: "lib",
        name: "Northbridge Library",
        slug: "northbridge",
        libraryType: "Public",
        role: "owner",
        canGoLive: false,
      },
    ],
    teams: [
      {
        id: "team",
        name: "Research group",
        slug: "research",
        role: "organiser",
        libraryCount: 0,
      },
    ],
  })
  expect(
    screen
      .getByRole("link", { name: "Northbridge Library" })
      .getAttribute("href")
  ).toBe("/staff/northbridge")
  expect(screen.getByText("Research group")).toBeTruthy()
  expect(
    screen.getByText(/Being in one never grants editing on a library/)
  ).toBeTruthy()
  expect(
    screen
      .getByRole("link", { name: "Open your organisation" })
      .getAttribute("href")
  ).toBe("/staff/teams")
})

it("offers a claim to accounts without staff access", () => {
  show()
  expect(
    screen.getByRole("link", { name: "Claim a library" }).getAttribute("href")
  ).toBe("/contribute/claim")
})

it("links API accounts to Developers with no purchase controls", () => {
  show({
    teams: [
      {
        id: "team",
        name: "Research group",
        slug: "research",
        role: "organiser",
        libraryCount: 0,
      },
    ],
    apiAccounts: [{ teamId: "team", role: "organiser", active: true }],
  })
  expect(screen.getByRole("heading", { name: "API accounts" })).toBeTruthy()
  expect(screen.getByText("Active")).toBeTruthy()
  expect(
    screen.getByRole("link", { name: "Go to Developers" }).getAttribute("href")
  ).toBe("/developers")
  expect(screen.queryByRole("button")).toBeNull()
  expect(document.body.innerHTML).not.toContain("/staff/teams/billing")
})

it("explains how to get API Access when there is no account", () => {
  show()
  expect(screen.getByText(/£100 a month/)).toBeTruthy()
})

it("keeps help links", () => {
  show()
  expect(
    screen
      .getByRole("link", { name: "Cancellation and refunds" })
      .getAttribute("href")
  ).toBe("/legal/cancellation-refunds")
  expect(
    screen.getByRole("link", { name: "Ask a question" }).dataset.contactType
  ).toBe("membership_support")
})

it("derives props from the session without trusting malformed values", () => {
  expect(
    membershipPropsOf({
      standing: "explorer",
      acceptedContributions: 12,
      recentlyActive: "yes",
      staffLibraries: "nope",
      apiAccounts: [{ teamId: "t", role: "organiser", active: true }, {}],
    })
  ).toMatchObject({
    acceptedContributions: 12,
    recognitionRevoked: true,
    recentlyActive: false,
    staffLibraries: [],
    apiAccounts: [{ teamId: "t", role: "organiser", active: true }],
  })
  expect(membershipPropsOf(null).acceptedContributions).toBe(0)
})
