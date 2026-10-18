// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
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
      .mockRejectedValueOnce(new Error("Search failed"))
      .mockResolvedValueOnce({ hits: [] })
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
    expect(search).toHaveBeenCalledTimes(2)
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
