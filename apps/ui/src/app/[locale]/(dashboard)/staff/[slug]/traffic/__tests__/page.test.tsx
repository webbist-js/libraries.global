// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"

import type { TrafficReport } from "@/lib/staff/traffic-source"
import { cleanup, render, screen } from "@/test/render"

const access = vi.hoisted(() => ({ covered: false }))
const traffic = vi.hoisted(() => ({
  report: { status: "unconfigured" } as TrafficReport,
  calls: [] as [string, number][],
}))
vi.mock("@/lib/staff/traffic-report", () => ({
  getTrafficReport: async (documentId: string, range: number) => {
    traffic.calls.push([documentId, range])

    return traffic.report
  },
}))
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))
vi.mock("@/app/[locale]/(dashboard)/staff/_lib/staff-pathname", () => ({
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
  traffic.report = { status: "unconfigured" }
  traffic.calls = []
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
    // Uncovered libraries never reach Google.
    expect(traffic.calls).toEqual([])
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

describe("Traffic page with GA4 connected", () => {
  const ready: TrafficReport = {
    status: "ready",
    summary: {
      range: 7,
      kpis: [
        {
          key: "views",
          label: "Page views",
          value: 1234,
          previous: 1000,
          changePct: 23,
        },
        {
          key: "visitors",
          label: "Visitors",
          value: 800,
          previous: 0,
          changePct: null,
        },
        {
          key: "directions",
          label: "Directions clicks",
          value: 12,
          previous: 8,
          changePct: 50,
        },
        {
          key: "catalogue",
          label: "Catalogue clicks",
          value: 5,
          previous: 10,
          changePct: -50,
        },
      ],
      viewsPerDay: [{ date: "2026-11-02", value: 70 }],
      referrers: [{ label: "Organic Search", pct: 60 }],
      timeZone: "Etc/GMT",
      through: "2026-11-02",
      incomplete: true,
    },
  }

  it("shows measured figures for the requested range with the consent caveat", async () => {
    access.covered = true
    traffic.report = ready
    render(
      await TrafficPage({
        params: Promise.resolve({ locale: "en", slug: "library" }),
        searchParams: Promise.resolve({ range: "7" }),
      })
    )
    expect(traffic.calls).toEqual([["library", 7]])
    expect(screen.getByText("1,234")).toBeTruthy()
    expect(screen.getByText(/\+23% vs previous 7 days/)).toBeTruthy()
    expect(screen.getByText("Organic Search")).toBeTruthy()
    expect(screen.getByText(/accept analytics\s+cookies/)).toBeTruthy()
    expect(screen.getByRole("status").textContent).toMatch(/minimum/)
    expect(
      screen.getByRole("link", { name: "90 days" }).getAttribute("href")
    ).toMatch(/\/library\/traffic\?range=90$/)
    expect(screen.queryByText(/sample/i)).toBeNull()
  })

  it("says why figures are missing instead of showing zeros", async () => {
    access.covered = true
    traffic.report = { status: "unavailable", reason: "quota" }
    render(
      await TrafficPage({
        params: Promise.resolve({ locale: "en", slug: "library" }),
      })
    )
    expect(screen.getByRole("alert").textContent).toMatch(/reporting limit/)
    expect(screen.queryByText("Page views")).toBeNull()
    expect(traffic.calls).toEqual([["library", 30]])
  })
})

vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl")
  const messages = (await import("../../../../../../../../locales/en.json"))
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
