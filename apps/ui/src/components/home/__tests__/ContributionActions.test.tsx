// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { AnchorHTMLAttributes } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import GlobalLink from "@/components/global/GlobalLink"
import { ContributionActions } from "@/components/home/ContributionActions"
import { installAnalyticsClickTracking } from "@/lib/analytics-events"

import messages from "../../../../locales/en.json"

const actor = vi.hoisted(() => ({ signedIn: false }))
vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({
    data: actor.signedIn ? { user: { id: "private-user" } } : null,
  }),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} onClick={(event) => event.preventDefault()} />
  ),
}))
afterEach(() => {
  cleanup()
  actor.signedIn = false
  delete window.librariesGlobalAnalytics
})

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <ContributionActions
        memberLabel="Start contributing"
        memberHref="/contribute"
        secondaryAction={
          <GlobalLink href="/contribute/index/new">
            Add a missing library
          </GlobalLink>
        }
      />
    </NextIntlClientProvider>
  )

describe("homepage contribution invitation", () => {
  it("offers real registration to visitors and tracks only contribution intent once", () => {
    const track = vi.fn()
    window.librariesGlobalAnalytics = {
      track,
    } as unknown as Window["librariesGlobalAnalytics"]
    const remove = installAnalyticsClickTracking(window)
    try {
      show()
      const register = screen.getByRole("link", {
        name: "Create a free account",
      })
      expect(register.getAttribute("href")).toBe("/auth/register")
      expect(
        screen
          .getByRole("link", { name: "Already a member? Sign in" })
          .getAttribute("href")
      ).toBe("/auth/signin?callbackUrl=%2Fcontribute")
      fireEvent.click(register)
      expect(track.mock.calls).toEqual([
        [
          "navigation_action",
          {
            interaction_source: "home",
            action_type: "open",
            destination: "contribute",
          },
        ],
      ])
      expect(JSON.stringify(track.mock.calls)).not.toContain("private-user")
    } finally {
      remove()
    }
  })
  it("takes existing members directly into contribution rather than registration", () => {
    actor.signedIn = true
    show()
    expect(
      screen
        .getByRole("link", { name: "Start contributing" })
        .getAttribute("href")
    ).toBe("/contribute")
    expect(
      screen.queryByRole("link", { name: "Create a free account" })
    ).toBeNull()
  })
})
