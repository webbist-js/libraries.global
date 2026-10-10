// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { LiveSettingsResponse } from "@/lib/mobile-live/types"

vi.mock("@iconify/react", () => ({ Icon: () => null, addCollection: () => {} }))
vi.mock("@/components/ds", () => ({
  StatusBadge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/lib/staff/use-library-href", () => ({
  useStaffLibraryHref: () => () => "/staff/test",
}))
vi.mock("@/components/mobile/useMobileClock", () => ({
  useMobileClock: () => new Date("2026-10-08T10:00:00Z"),
}))

import { ConsolePreview } from "../ConsolePreview"
import { consolePreviewRoute } from "../preview-route"

const timetable: NonNullable<LiveSettingsResponse["library"]["timetable"]> = {
  version: 1,
  cycle: { weeks: 2, anchor: "2026-10-05" },
  stops: ["Village hall", "School", "Market"].map((name, i) => ({
    id: `s${i}`,
    name,
    where: "",
    location: null,
    areaDocumentId: null,
  })),
  visits: [0, 1, 2].map((i) => ({
    id: `v${i}`,
    stopId: `s${i}`,
    day: "mon",
    arrive: `${9 + i}:00`.padStart(5, "0"),
    depart: `${9 + i}:30`.padStart(5, "0"),
    repeat: { kind: "cycle", weeks: [2] },
    termTimeOnly: false,
    validFrom: null,
    validTo: null,
  })),
}
const initial: LiveSettingsResponse = {
  settings: {
    enabled: false,
    precision: "stops",
    autoStopMinutes: 30,
    enabledAt: null,
  },
  library: {
    id: "test",
    name: "Real mobile library",
    timezone: "Europe/London",
    timetable,
  },
  route: [],
  activeSession: null,
  liveEnabled: true,
}
const preview = (value = initial) =>
  render(
    <ConsolePreview
      initial={value}
      live={null}
      publicPath="/libraries/test"
      firstName="Alex"
    />
  )
const phone = () =>
  within(screen.getByRole("group", { name: "Console preview" }))

afterEach(cleanup)

describe("ConsolePreview", () => {
  it("uses a real saved route on a non-service day and labels its date and cycle week", () => {
    preview()
    expect(
      screen.getByText(/Using the saved timetable for Mon 12 Oct/)
    ).toBeTruthy()
    expect(phone().getAllByText("School")).toHaveLength(2)
    fireEvent.click(screen.getByRole("button", { name: "Entry" }))
    expect(phone().getByText(/Monday, Week 2 · 3 stops/)).toBeTruthy()
    expect(screen.getByText(/Nothing here starts a live session/)).toBeTruthy()
  })
  it("shows a useful empty state without live actions when no timetable route exists", () => {
    preview({
      ...initial,
      library: { ...initial.library, timetable: { ...timetable, visits: [] } },
    })
    expect(
      phone().getByText("No route in the saved timetable to preview.")
    ).toBeTruthy()
    expect(phone().queryByText("Live · check-ins only")).toBeNull()
    expect(phone().queryByRole("button", { name: "+5" })).toBeNull()
  })
  it("advances the demonstration through leaving and arriving, without calling a live API", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    preview()
    fireEvent.click(phone().getByRole("button", { name: "Leaving now" }))
    expect(phone().getByText("On the way to")).toBeTruthy()
    fireEvent.click(phone().getByRole("button", { name: "Arrived" }))
    expect(
      phone().getByRole("button", { name: "Leaving: last stop" })
    ).toBeTruthy()
    fireEvent.click(phone().getByRole("button", { name: "Leaving: last stop" }))
    expect(
      phone().getByText(/No live session was started or published/)
    ).toBeTruthy()
    expect(fetchSpy).not.toHaveBeenCalled()
    fetchSpy.mockRestore()
  })
  it("updates the delay locally and leaves the actual public status alone", () => {
    preview()
    fireEvent.click(phone().getByRole("button", { name: "+15" }))
    expect(phone().getByText(/due to leave 10:30 · now 10:45/)).toBeTruthy()
    expect(
      screen.getByText(
        "The actual public page. Trying the preview doesn’t change this."
      )
    ).toBeTruthy()
    expect(
      phone().getByRole("button", { name: "+15" }).getAttribute("aria-pressed")
    ).toBe("true")
  })
  it("confirms a simulated skip and never marks the skipped stop as current", () => {
    preview()
    fireEvent.click(phone().getByRole("button", { name: "Leaving now" }))
    fireEvent.click(
      phone().getByRole("button", { name: "Skip stop: skip this stop" })
    )
    expect(
      phone().getByText(
        "This only changes the preview. No public update is sent."
      )
    ).toBeTruthy()
    fireEvent.click(phone().getByRole("button", { name: "Skip in preview" }))
    expect(
      phone().getByText(/No live session was started or published/)
    ).toBeTruthy()
  })
  it("does not invent performance statistics on the finished screen", () => {
    preview()
    fireEvent.click(screen.getByRole("button", { name: "Finished" }))
    expect(
      phone().getByText(/No live session was started or published/)
    ).toBeTruthy()
    expect(phone().queryByText(/8 minutes late/)).toBeNull()
  })
})

describe("consolePreviewRoute", () => {
  it("keeps the server's route and excludes cancelled visits", () => {
    const visits = consolePreviewRoute([], timetable, "2026-10-08")
    expect(visits[0]?.date).toBe("2026-10-12")
    expect(
      consolePreviewRoute(
        [{ ...visits[0]!, cancelledBy: "closure" }, visits[1]!],
        timetable,
        "2026-10-08"
      )
    ).toEqual([visits[1]])
  })
  it("waits for the client date and handles missing and expired timetables", () => {
    expect(consolePreviewRoute([], timetable, undefined)).toEqual([])
    expect(consolePreviewRoute([], null, "2026-10-08")).toEqual([])
    expect(
      consolePreviewRoute(
        [],
        {
          ...timetable,
          visits: timetable.visits.map((v) => ({
            ...v,
            validTo: "2026-09-01",
          })),
        },
        "2026-10-08"
      )
    ).toEqual([])
  })
})
