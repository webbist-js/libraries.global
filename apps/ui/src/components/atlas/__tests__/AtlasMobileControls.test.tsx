// @vitest-environment happy-dom
import type { AtlasCountsResponse } from "@repo/shared-data"
import type * as NextIntl from "next-intl"
import { useState } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { MobileStopHit } from "@/lib/mobile-stop-search"
import {
  cleanup,
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

import { type AtlasFilters, EMPTY_FILTERS } from "../atlas.logic"
import { AtlasFiltersTab } from "../AtlasFiltersTab"
import { AtlasSearchTab } from "../AtlasSearchTab"

const { multiSearch } = vi.hoisted(() => ({ multiSearch: vi.fn() }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof NextIntl>()),
  useLocale: () => "en",
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))
vi.mock("@/lib/meilisearch", () => ({
  meiliClient: { multiSearch },
  searchLocaleFilter: () => "locale = en",
  buildLibraryPath: () => null,
}))

const stop = {
  id: "library_harbour",
  stop_id: "harbour",
  name: "Harbour Car Park",
  where: "Clare Terrace",
  library_name: "Demo Mobile Library",
  library_document_id: "library",
  timezone: "Europe/London",
  cancelled_dates: [],
  visits: [],
  cycle: { weeks: 2, anchor: "2026-10-05" },
} as unknown as MobileStopHit
const onPickStop = vi.fn()
const onMobilePreset = vi.fn()
function SearchHarness() {
  const [query, setQuery] = useState("Harbour")

  return (
    <AtlasSearchTab
      query={query}
      onQuery={setQuery}
      libraries={[]}
      places={[]}
      filters={EMPTY_FILTERS}
      now={new Date("2026-10-06T10:00:00Z")}
      recent={[]}
      onPickLibrary={() => {}}
      onPickPlace={() => {}}
      onPreset={() => {}}
      onGoLayers={() => {}}
      onPickStop={onPickStop}
      onMobilePreset={onMobilePreset}
    />
  )
}
beforeEach(() => {
  multiSearch.mockResolvedValue({ results: [{ hits: [] }, { hits: [stop] }] })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it("prioritises available access features and retains selected features when closing feature search", () => {
  const search = vi.fn()
  function Fixture() {
    const [filters, setFilters] = useState<AtlasFilters>(EMPTY_FILTERS)

    return (
      <AtlasFiltersTab
        filters={filters}
        onChange={setFilters}
        libraries={[]}
        matchCount={1}
        now={new Date()}
        onShowResults={() => {}}
        onFacilitySearch={search}
        serverCounts={
          {
            typeGroups: {},
            operatorGroups: {},
            foundedRange: null,
            events: 0,
            catalogue: 0,
            facilities: [
              "Book lending",
              "Wi-Fi",
              "Public computers",
              "Accessible toilets",
              "Step-free access",
            ].map((name) => ({ name, count: 1 })),
          } as AtlasCountsResponse
        }
      />
    )
  }
  render(<Fixture />)
  expect(
    screen.getByRole("checkbox", { name: /^Step-free access/ })
  ).toBeTruthy()
  expect(screen.queryByRole("checkbox", { name: /^Book lending/ })).toBeNull()
  expect(screen.queryByRole("searchbox")).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Show 1 more" }))
  fireEvent.click(screen.getByRole("checkbox", { name: /^Book lending/ }))
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Book" } })
  expect(search).toHaveBeenLastCalledWith("Book")
  fireEvent.click(screen.getByRole("button", { name: "Show fewer" }))
  expect(search).toHaveBeenLastCalledWith("")
  expect(
    (
      screen.getByRole("checkbox", {
        name: /^Book lending/,
      }) as HTMLInputElement
    ).checked
  ).toBe(true)
  expect(screen.queryByRole("searchbox")).toBeNull()
})

it("does not report an empty atlas when mobile search fails", async () => {
  multiSearch.mockRejectedValueOnce(new Error("Unavailable"))
  render(<SearchHarness />)
  await screen.findByText(/Mobile stop search is unavailable/)
  expect(screen.queryByText(/Nothing in the atlas matches/)).toBeNull()
})

it("puts selectable stops below the search field without showing a contradictory empty state", async () => {
  render(<SearchHarness />)
  expect(screen.queryByText(/Nothing in the atlas matches/)).toBeNull()
  const result = await screen.findByRole("button", { name: /Harbour Car Park/ })
  const input = screen.getByRole("searchbox")
  expect(
    input.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy()
  expect(screen.queryByText(/Nothing in the atlas matches/)).toBeNull()
  fireEvent.click(result)
  expect(onPickStop).toHaveBeenCalledWith(stop)
})

it("clears stop results and exposes real today and live presets", async () => {
  render(<SearchHarness />)
  await screen.findByRole("button", { name: /Harbour Car Park/ })
  fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
  expect(screen.queryByRole("button", { name: /Harbour Car Park/ })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Stops visited today" }))
  fireEvent.click(screen.getByRole("button", { name: "Live now" }))
  expect(onMobilePreset.mock.calls).toEqual([["today"], ["live"]])
})

it("does not restore stale results after the search text changes", async () => {
  let complete!: (result: unknown) => void
  multiSearch.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve
      })
  )
  multiSearch.mockResolvedValue({
    results: [{ hits: [] }, { hits: [{ ...stop, name: "Market Square" }] }],
  })
  render(<SearchHarness />)
  await waitFor(() => expect(multiSearch).toHaveBeenCalledOnce())
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "Market" },
  })
  await screen.findByRole("button", { name: /Market Square/ })
  await act(async () => {
    complete({ results: [{ hits: [] }, { hits: [stop] }] })
    await Promise.resolve()
  })
  expect(screen.queryByRole("button", { name: /Harbour Car Park/ })).toBeNull()
})

it("lets readers choose the mobile type, recurrence and sharing independently and clear them", () => {
  const enable = vi.fn()
  function Harness() {
    const [filters, setFilters] = useState<AtlasFilters>(EMPTY_FILTERS)

    return (
      <AtlasFiltersTab
        filters={filters}
        onChange={setFilters}
        libraries={[]}
        matchCount={0}
        now={new Date()}
        onShowResults={() => {}}
        mobileEnabled
        onEnableMobile={enable}
        mobileCount={6}
        mobileSharesLiveCount={2}
      />
    )
  }
  render(<Harness />)
  fireEvent.click(
    within(screen.getByRole("group", { name: "Library type" })).getByRole(
      "button",
      { name: /^Mobile\b/ }
    )
  )
  fireEvent.click(screen.getByRole("button", { name: "More filters" }))
  fireEvent.click(screen.getByRole("button", { name: "Mobile library stops" }))
  fireEvent.click(screen.getByRole("button", { name: "Every 2 weeks" }))
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Shares live updates 2" })
  )
  expect(screen.getByText("3 filters active")).toBeTruthy()
  expect(enable).toHaveBeenCalledTimes(3)
  fireEvent.click(screen.getByRole("button", { name: "Mobile library stops" }))
  const closed = screen.getByRole("button", {
    name: "Mobile library stops 2 selected",
  })
  expect(closed.getAttribute("aria-expanded")).toBe("false")
  fireEvent.click(closed)
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Shares live updates 2",
      }) as HTMLInputElement
    ).checked
  ).toBe(true)
  expect(screen.queryByRole("checkbox", { name: /Step-free stop/ })).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "Reset" }))
  expect(screen.queryByText("3 filters active")).toBeNull()
  expect(
    screen
      .getByRole("button", { name: "Every 2 weeks" })
      .getAttribute("aria-pressed")
  ).toBe("false")
})
