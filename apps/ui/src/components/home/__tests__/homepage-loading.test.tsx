// @vitest-environment happy-dom
import { act, cleanup, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

import { LibraryHomePage } from "@/components/home/LibraryHomePage"

const data = vi.hoisted(() => ({
  homepage: Promise.resolve<unknown>(null),
  empty: Promise.resolve({ data: [] }),
  list: Promise.resolve([]),
  nothing: Promise.resolve(null),
}))
vi.mock("@/components/home/HomepageFrame", () => ({
  HomepageFrame: ({ children }: { children: ReactNode }) => (
    <>
      <header>Persistent home toolbar</header>
      {children}
    </>
  ),
  HomepageContentLoading: () => <p role="status">Loading homepage</p>,
}))
vi.mock("@/components/home/HomepageHero", () => ({
  default: () => <h1>Every library, one map.</h1>,
}))
vi.mock("@/components/home/HomepageSections", () => ({ default: () => null }))
vi.mock("@/components/home/HomeFooter", () => ({ HomeFooter: () => null }))
vi.mock("@/components/home/sections/ContributeSection", () => ({
  pickTasks: () => [],
}))
vi.mock(
  "@/components/page-builder/components/seo-utilities/StrapiStructuredData",
  () => ({ default: () => null })
)
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchHomepage: () => data.homepage,
  fetchHomepagePillars: () => data.list,
  fetchHomepageContinents: () => data.empty,
  fetchFooter: () => data.empty,
  fetchLegalDocuments: () => data.empty,
  fetchHomepageStats: () => data.nothing,
  fetchIncompleteLibraries: () => data.list,
}))
vi.mock("@/lib/drives/drive-view-server", () => ({
  fetchHomepageDriveViews: () => data.list,
}))
vi.mock("@/lib/journal-landing", () => ({
  loadJournalTopStories: () => data.list,
}))
vi.mock("@/lib/meilisearch", () => ({
  fetchGlobeMarkers: () => data.list,
  fetchUpcomingEvents: () => data.list,
}))
vi.mock("@/lib/networks/server", () => ({
  publicNetworkList: () => data.nothing,
}))

afterEach(cleanup)

it("keeps the shell available while home data suspends and removes the loader when ready", async () => {
  let ready!: (value: unknown) => void
  data.homepage = new Promise((resolve) => {
    ready = resolve
  })
  await act(async () => {
    render(<LibraryHomePage locale="en" />)
  })
  const toolbar = screen.getByText("Persistent home toolbar")
  expect(screen.getByRole("status").textContent).toBe("Loading homepage")
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull()
  await act(async () => {
    ready(null)
  })
  expect(screen.queryByRole("status")).toBeNull()
  expect(
    screen.getByRole("heading", { name: "Every library, one map." })
  ).toBeTruthy()
  expect(screen.getByText("Persistent home toolbar")).toBe(toolbar)
})
