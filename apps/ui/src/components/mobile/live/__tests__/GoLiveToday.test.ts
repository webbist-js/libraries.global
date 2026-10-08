// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { LiveSettingsResponse } from "@/lib/mobile-live/types"

Object.assign(globalThis, { React })

const state = vi.hoisted(() => ({
  ready: true,
  goLive: true,
  now: null as Date | null,
}))

vi.mock("@/lib/access-client", () => ({
  useStaff: () => ({
    ready: state.ready,
    libraries: [],
    can: (action: string) => action === "goLive" && state.goLive,
  }),
}))
vi.mock("@/components/mobile/useMobileClock", () => ({
  useMobileClock: () => state.now,
}))
vi.mock("@/components/mobile/live/ConfirmIdentity", () => ({
  liveRequest: vi.fn(),
}))
vi.mock("@/components/ds/QrCode", () => ({ QrCode: () => null }))
vi.mock("@iconify/react", () => ({ Icon: () => null, addCollection: () => {} }))

const { GoLiveToday } = await import("../GoLiveToday")

const ID = "mob000000000000000000001"
const DATE = "2026-10-07"
const initial: LiveSettingsResponse = {
  settings: {
    enabled: true,
    precision: "stops",
    autoStopMinutes: 30,
    enabledAt: null,
  },
  library: {
    id: ID,
    name: "Kent Mobile Library",
    timezone: "Europe/London",
    timetable: {
      cycle: 1,
      cycleStart: "2026-01-05",
      stops: [
        {
          id: "s1",
          name: "Village hall",
          where: "",
          location: null,
          areaDocumentId: null,
        },
        {
          id: "s2",
          name: "Shop",
          where: "",
          location: null,
          areaDocumentId: null,
        },
      ],
      visits: [],
      notices: [],
    } as unknown as LiveSettingsResponse["library"]["timetable"],
  },
  route: [
    {
      date: DATE,
      visitId: "v1",
      stopId: "s1",
      arrive: "09:00",
      depart: "09:30",
      cancelledBy: null,
    },
    {
      date: DATE,
      visitId: "v2",
      stopId: "s2",
      arrive: "12:00",
      depart: "12:30",
      cancelledBy: null,
    },
  ],
  activeSession: null,
  liveEnabled: true,
}
const today = (over: Partial<Parameters<typeof GoLiveToday>[0]> = {}) =>
  createElement(GoLiveToday, {
    initial,
    live: null,
    locale: "en",
    consoleUrl: `https://libraries.global/live/${ID}`,
    today: DATE,
    ...over,
  })

afterEach(() => {
  cleanup()
  state.ready = true
  state.goLive = true
  state.now = null
})

describe("GoLiveToday", () => {
  it("marks a stop Done once its departure has passed on the library's clock", () => {
    // 11:00 in London (BST): the 09:30 departure is over, the 12:00 stop is not.
    state.now = new Date("2026-10-07T10:00:00Z")
    render(today())
    const [first, second] = screen.getAllByRole("listitem")
    expect(within(first!).getByText("Done")).toBeTruthy()
    expect(within(second!).queryByText("Done")).toBeNull()
    expect(screen.getByText(/2 stops · 09:00–12:30/)).toBeTruthy()
  })

  it("marks nothing Done before the clock ticks", () => {
    render(today())
    expect(screen.queryByText("Done")).toBeNull()
  })

  it("follows the live state for Here now and skipped stops", () => {
    render(
      today({
        live: {
          libraryDocumentId: ID,
          kind: "here",
          sharesLive: true,
          stopId: "s2",
          nextStopId: null,
          until: null,
          scheduledAt: null,
          expectedAt: null,
          delayMin: 0,
          noticeMessage: null,
          nextService: null,
          position: null,
          skippedStopIds: ["s1"],
        } as unknown as Parameters<typeof GoLiveToday>[0]["live"],
      })
    )
    const [first, second] = screen.getAllByRole("listitem")
    expect(within(first!).getByText("Not stopping today")).toBeTruthy()
    expect(within(second!).getByText("Here now")).toBeTruthy()
  })

  it("opens the console only for staff who may go live", () => {
    const { unmount } = render(today())
    expect(
      screen
        .getByRole("link", { name: "Open the live console" })
        .getAttribute("href")
    ).toBe(`https://libraries.global/live/${ID}`)
    expect(
      screen.getByRole("button", { name: "Email me the link" })
    ).toBeTruthy()
    unmount()

    state.goLive = false
    render(today())
    expect(
      screen.queryByRole("link", { name: "Open the live console" })
    ).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Email me the link" })
    ).toBeNull()
    expect(screen.getByText(/Ask an owner to let you go live/)).toBeTruthy()
  })

  it("holds the action row's space until the session is known", () => {
    state.ready = false
    render(today())
    expect(
      screen.queryByRole("link", { name: "Open the live console" })
    ).toBeNull()
    expect(screen.queryByText(/Ask an owner/)).toBeNull()
    expect(document.querySelector('[aria-hidden="true"] .h-11')).toBeTruthy()
  })
})
