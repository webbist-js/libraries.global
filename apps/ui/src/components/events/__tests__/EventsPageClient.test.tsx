// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import type * as NextIntl from "next-intl"
import type { ComponentProps } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { EventsAgenda } from "../EventsAgenda"
import { EventsPageClient } from "../EventsPageClient"

import messages from "../../../../locales/en.json"

const search = vi.hoisted(() => vi.fn())
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/meilisearch", () => ({ searchEvents: search }))
vi.mock("next-intl", async (original) => {
  const actual = await original<typeof NextIntl>()

  return {
    ...actual,
    useLocale: () => "en",
    useTranslations: (namespace: "ui" | "eventListing") =>
      actual.createTranslator({ locale: "en", messages, namespace }),
  }
})
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ children, ...props }: ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
  usePathname: () => "/events",
  routing: { locales: ["en", "fr", "cs"], defaultLocale: "en" },
}))

beforeEach(() => {
  search.mockReset()
  localStorage.clear()
  window.history.replaceState(null, "", "/events")
})
afterEach(cleanup)

describe("events loading outcomes", () => {
  it("invites the first feed contribution when a calendar loads with no events", async () => {
    search.mockResolvedValue({ hits: [] })
    render(<EventsPageClient />)
    expect(
      await screen.findByRole("heading", {
        name: "Be the first to share what’s on",
      })
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "How to connect an event feed" })
        .getAttribute("href")
    ).toBe("/knowledge/events/event-feeds")
    expect(
      screen
        .getByRole("link", { name: "Contribute to the index" })
        .getAttribute("href")
    ).toBe("/contribute")
    expect(screen.queryByRole("alert")).toBeNull()
    expect(screen.queryByText("Subscribe to this calendar (.ics)")).toBeNull()
  })
  it("keeps real failures visible and can retry successfully", async () => {
    search
      .mockResolvedValue({ hits: [] })
      .mockRejectedValueOnce(new Error("Search failed"))
    render(<EventsPageClient />)
    expect(await screen.findByRole("alert")).toBeTruthy()
    expect(
      screen.queryByRole("heading", { name: "Be the first to share what’s on" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(
      await screen.findByRole("heading", {
        name: "Be the first to share what’s on",
      })
    ).toBeTruthy()
    expect(search).toHaveBeenCalledTimes(8)
  })
  it("offers filter reset rather than a first-feed prompt for filtered-out events", () => {
    const reset = vi.fn()
    render(
      <EventsAgenda
        events={[]}
        loading={false}
        now={new Date("2026-10-18T12:00:00Z")}
        totalUnfiltered={2}
        onReset={reset}
      />
    )
    expect(
      screen.getByRole("heading", { name: "No events match these filters" })
    ).toBeTruthy()
    expect(
      screen.queryByRole("link", { name: "How to connect an event feed" })
    ).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Clear event filters" }))
    expect(reset).toHaveBeenCalledOnce()
  })
})

it("restores shareable filters and requests results beyond the first 300 from the server", async () => {
  window.history.replaceState(
    null,
    "",
    "/events?q=archives&type=talk&time=evening&free=1&page=12"
  )
  search.mockResolvedValue({
    hits: [],
    totalHits: 400,
    totalPages: 14,
    facetDistribution: {},
  })
  render(<EventsPageClient />)
  await screen.findByText("Page 12 of 14")
  expect(search).toHaveBeenCalledWith(
    expect.objectContaining({
      query: "archives",
      eventTypes: ["talk"],
      timeSlots: ["evening"],
      isFree: true,
      page: 11,
      hitsPerPage: 30,
      statuses: ["upcoming", "ongoing"],
    })
  )
  fireEvent.click(screen.getByRole("button", { name: "Next" }))
  await screen.findByText("Page 13 of 14")
  expect(window.location.search).toContain("page=13")
  window.history.replaceState(null, "", "/events?q=maps&page=2")
  fireEvent.popState(window)
  await waitFor(() =>
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ query: "maps", page: 1, hitsPerPage: 30 })
    )
  )
})
