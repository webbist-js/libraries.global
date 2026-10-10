// @vitest-environment happy-dom
import type { PublicLiveState } from "@repo/shared-data"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { PublicMobileTimetable } from "@/lib/mobile/types"
import { loadStopTimetable, type MobileStopHit } from "@/lib/mobile-stop-search"

import { AtlasStopPanel } from "../AtlasStopPanel"

vi.mock("@/lib/mobile-stop-search", () => ({ loadStopTimetable: vi.fn() }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
  }: {
    href: string
    children: React.ReactNode
  }) => <a href={href}>{children}</a>,
}))
vi.mock("@/components/mobile/StopDrawer", () => ({
  StopDrawer: ({ stopId }: { stopId: string | null }) =>
    stopId ? <div role="dialog">Timetable for {stopId}</div> : null,
}))

const stop = {
  id: "library-hilton",
  stop_id: "hilton",
  name: "Hilton St Mary",
  where: "School, term time only",
  library_document_id: "library",
  library_name: "Westmere Mobile Library",
  library_path: "/westmere",
  _geo: { lat: 50.15, lng: -5.07 },
} as MobileStopHit
const timetable: PublicMobileTimetable = {
  documentId: "library",
  name: stop.library_name,
  path: stop.library_path,
  timezone: "Europe/London",
  status: "open",
  updatedAt: "2026-10-06T10:00:00Z",
  notices: [],
  timetable: {
    version: 1,
    cycle: { weeks: 2, anchor: "2026-10-05" },
    stops: [
      {
        id: "hilton",
        name: stop.name,
        where: stop.where,
        location: stop._geo!,
        areaDocumentId: null,
      },
      {
        id: "ford",
        name: "Ford Cross",
        where: "Village green",
        location: null,
        areaDocumentId: null,
      },
    ],
    visits: [
      {
        id: "hilton-visit",
        stopId: "hilton",
        day: "tue",
        arrive: "11:00",
        depart: "12:30",
        repeat: { kind: "cycle", weeks: [1] },
        termTimeOnly: true,
        validFrom: null,
        validTo: null,
      },
      {
        id: "ford-visit",
        stopId: "ford",
        day: "tue",
        arrive: "10:00",
        depart: "10:45",
        repeat: { kind: "cycle", weeks: [1] },
        termTimeOnly: false,
        validFrom: null,
        validTo: null,
      },
    ],
  },
}
const live: PublicLiveState = {
  libraryDocumentId: "library",
  kind: "here",
  sharesLive: true,
  stopId: "ford",
  nextStopId: "hilton",
  until: "10:45",
  scheduledAt: null,
  expectedAt: null,
  delayMin: 0,
  noticeMessage: null,
  nextService: null,
  position: null,
  skippedStopIds: [],
  updatedAt: "2026-10-06T10:29:00Z",
}

beforeEach(() => vi.mocked(loadStopTimetable).mockResolvedValue(timetable))
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

it("shows the selected stop's visits and upcoming dates, with service status and working actions", async () => {
  const onClose = vi.fn()
  render(
    <AtlasStopPanel
      stop={stop}
      live={live}
      now={new Date("2026-10-06T10:30:00Z")}
      onClose={onClose}
    />
  )
  const visits = await screen.findByRole("table", {
    name: "Regular visits to Hilton St Mary",
  })
  expect(
    within(visits).getByRole("rowheader", { name: "Tuesday" })
  ).toBeTruthy()
  expect(within(visits).queryByText("10:00–10:45")).toBeNull()
  expect(screen.queryByRole("heading", { name: "Today’s route" })).toBeNull()
  expect(screen.getByText("Today, 11:00–12:30")).toBeTruthy()
  expect(screen.getByText("In two weeks")).toBeTruthy()
  expect(screen.getByText("Same time")).toBeTruthy()
  expect(screen.getByText("Here now")).toBeTruthy()
  expect(screen.getByText("At Ford Cross until 10:45.")).toBeTruthy()
  expect(screen.getByText("Updated 1 minute ago by the crew")).toBeTruthy()
  expect(
    screen
      .getByRole("link", { name: "Served by Westmere Mobile Library" })
      .getAttribute("href")
  ).toBe("/westmere")
  expect(
    screen.getByRole("link", { name: "Directions" }).getAttribute("href")
  ).toBe("https://www.google.com/maps/dir/?api=1&destination=50.15,-5.07")
  fireEvent.click(screen.getByRole("button", { name: "View timetable" }))
  expect(screen.getByRole("dialog").textContent).toBe("Timetable for hilton")
  fireEvent.click(screen.getByRole("button", { name: "Close stop panel" }))
  expect(onClose).toHaveBeenCalledOnce()
})

it("keeps cancelled visits visible with their notice instead of describing them as scheduled", async () => {
  vi.mocked(loadStopTimetable).mockResolvedValue({
    ...timetable,
    notices: [
      {
        id: "cancel",
        type: "not_running",
        scope: "stop",
        scopeWeek: null,
        scopeDay: null,
        stopId: "hilton",
        from: "2026-10-06",
        to: "2026-10-06",
        endedAt: null,
        message: "School closed",
        reason: null,
      },
    ],
  })
  render(
    <AtlasStopPanel
      stop={stop}
      now={new Date("2026-10-06T10:30:00Z")}
      onClose={() => {}}
    />
  )
  expect(await screen.findByText("Not stopping · School closed")).toBeTruthy()
  expect(screen.getByText("Today, 11:00–12:30").tagName).toBe("DEL")
  expect(screen.queryByText("Same time")).toBeNull()
})

it("omits today's completed visit from the upcoming list", async () => {
  render(
    <AtlasStopPanel
      stop={stop}
      now={new Date("2026-10-06T12:30:00Z")}
      onClose={() => {}}
    />
  )
  await screen.findByRole("table")
  expect(screen.queryByText("Today, 11:00–12:30")).toBeNull()
  expect(screen.getByText("In two weeks, 11:00–12:30")).toBeTruthy()
})

it("uses the service's local date for upcoming visits", async () => {
  vi.mocked(loadStopTimetable).mockResolvedValue({
    ...timetable,
    timezone: "America/Los_Angeles",
  })
  render(
    <AtlasStopPanel
      stop={stop}
      now={new Date("2026-10-06T00:15:00Z")}
      onClose={() => {}}
    />
  )
  expect(await screen.findByText("Tomorrow, 11:00–12:30")).toBeTruthy()
  expect(screen.queryByText("Today, 11:00–12:30")).toBeNull()
})
