// @vitest-environment happy-dom
import { createTranslator } from "next-intl"
import type { AnchorHTMLAttributes } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FeatureAccessLanding } from "@/components/auth/FeatureAccessLanding"
import { FEATURE_ENTRY_PATHS, type AccessFeature } from "@/lib/feature-access"
import { cleanup, render, screen } from "@/test/render"

import messages from "../../../locales/en.json"

vi.mock("next-intl/server", () => ({
  getLocale: async () => "fr",
  getTranslations: async () =>
    createTranslator({ locale: "en", messages, namespace: "featureAccess" }),
}))
vi.mock("@/components/dashboard/WorkspaceHero", () => ({
  WorkspaceHero: ({ title, lead }: { title: string; lead: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{lead}</p>
    </header>
  ),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
afterEach(cleanup)

describe("contextual feature invitation", () => {
  it.each(Object.keys(FEATURE_ENTRY_PATHS) as AccessFeature[])(
    "explains %s with sign-in, registration and a public alternative",
    async (feature) => {
      render(await FeatureAccessLanding({ feature }))
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
        messages.featureAccess[feature].title
      )
      expect(
        screen
          .getByRole("link", { name: "Create a free account" })
          .getAttribute("href")
      ).toBe("/auth/register")
      const action = screen.getByRole("link", {
        name: messages.featureAccess[feature].action,
      })
      expect(
        new URL(
          action.getAttribute("href")!,
          "https://example.test"
        ).searchParams.get("callbackUrl")
      ).toBe(`/fr${FEATURE_ENTRY_PATHS[feature]}`)
      expect(screen.getAllByRole("listitem")).toHaveLength(3)
    }
  )
  it.each(["teams", "widgets", "api"] as const)(
    "offers a relevant next step to a member without %s access",
    async (feature) => {
      render(await FeatureAccessLanding({ feature, signedIn: true }))
      expect(
        screen
          .getByRole("link", { name: "Explore Team plans" })
          .getAttribute("href")
      ).toBe("/plans#plan-team")
      expect(
        screen.getByRole("link", { name: "Set up a Team" }).getAttribute("href")
      ).toBe("/staff/teams/new")
      expect(
        screen.queryByRole("link", { name: "Create a free account" })
      ).toBeNull()
    }
  )
  it("retains selected claim context and explains verification separately from payment", async () => {
    const signInHref =
      "/auth/signin?callbackUrl=%2Ffr%2Fstaff%2Fclaim%3FlibrarySlug%3Dcentral"
    render(await FeatureAccessLanding({ feature: "claim", signInHref }))
    expect(
      screen
        .getByRole("link", { name: "Sign in to claim a library" })
        .getAttribute("href")
    ).toBe(signInHref)
    expect(
      screen.getByText(/A moderator checks your role and evidence/)
    ).toBeTruthy()
  })
})
