// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

const access = vi.hoisted(() => ({ covered: false }))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/app/[locale]/staff/_lib/staff-pathname", () => ({
  staffPathname: async () => "/staff/library/traffic",
}))
vi.mock("@/lib/staff/server", () => ({
  loadStaffPage: async () => ({ user: {}, documentId: "library" }),
}))
vi.mock("@/lib/access-server", () => ({
  requireEntitlementForLibrary: () => (access.covered ? null : "upgrade"),
}))
vi.mock("@/lib/seo/metadata", () => ({ privateMetadata: () => ({}) }))
vi.mock("@/components/staff/LearnMoreLink", () => ({
  LearnMoreLink: () => null,
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))

import TrafficPage from "../page"

afterEach(() => {
  cleanup()
  access.covered = false
})

describe("Traffic page without a connected analytics provider", () => {
  it("shows the free Team gate with an inert illustration and no report controls", async () => {
    render(
      await TrafficPage({
        params: Promise.resolve({ locale: "en", slug: "library" }),
      })
    )
    expect(
      screen.getByRole("heading", { name: "See how people find your library" })
    ).toBeTruthy()
    expect(screen.getByRole("link", { name: "Compare plans" })).toBeTruthy()
    expect(
      screen.getByText("Visitors").closest('[aria-hidden="true"]')
    ).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
    expect(
      screen.queryByRole("navigation", { name: "Report period" })
    ).toBeNull()
  })

  it("tells covered staff there are no figures and never substitutes sample numbers", async () => {
    access.covered = true
    render(
      await TrafficPage({
        params: Promise.resolve({ locale: "en", slug: "library" }),
      })
    )
    expect(screen.getByRole("heading", { name: "Page traffic" })).toBeTruthy()
    expect(
      screen.getByText(/Traffic reporting is not connected yet/)
    ).toBeTruthy()
    expect(screen.queryByText("Visitors")).toBeNull()
    expect(screen.queryByText(/sample data/i)).toBeNull()
    expect(screen.queryByRole("link", { name: "Compare plans" })).toBeNull()
    expect(
      screen.queryByRole("navigation", { name: "Report period" })
    ).toBeNull()
  })
})

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const messages = (await import("../../../../../../../locales/en.json"))
    .default

  return {
    getTranslations: async (config: string | { namespace?: string }) =>
      createTranslator({
        locale: "en",
        messages,
        namespace: (typeof config === "string" ? config : config.namespace) as
          | keyof typeof messages
          | undefined,
      }),
  }
})
