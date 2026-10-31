// @vitest-environment happy-dom
import * as React from "react"
import { createElement as h } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

import type { OpeningTimesValue } from "@/components/library/library-page.helpers"
import { cleanup, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })
vi.mock("@iconify/react", () => ({ Icon: () => null }))
const { LibraryHoursTable } = await import("../LibraryHoursTable")
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-06T10:00:00Z"))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})
const hours: OpeningTimesValue = {
  days: [
    {
      day: "tuesday",
      enabled: true,
      timeframes: [
        { startTime: "09:00", endTime: "12:30", staffing: "staffed" },
        {
          startTime: "13:30",
          endTime: "17:00",
          staffing: "self_service",
          note: "Library card required",
        },
      ],
    },
  ],
}

it("keeps split sessions and staffing visible without implying the midday gap is open", () => {
  render(
    h(LibraryHoursTable, {
      compact: true,
      openingTimes: hours,
      timezone: "Europe/London",
    })
  )
  const day = within(screen.getByText("Tuesday").closest("li")!)
  expect(day.getByText("09:00–12:30")).toBeTruthy()
  expect(day.getByText("13:30–17:00")).toBeTruthy()
  expect(day.queryByText("09:00–17:00")).toBeNull()
  expect(day.getByText("Staffed")).toBeTruthy()
  expect(day.getByText("Self-service")).toBeTruthy()
  expect(day.getByText("Library card required")).toBeTruthy()
})
it("shows both calendar-day portions of an overnight session", () => {
  render(
    h(LibraryHoursTable, {
      compact: true,
      timezone: "Europe/London",
      openingTimes: {
        days: [
          {
            day: "tuesday",
            enabled: true,
            timeframes: [
              { startTime: "22:00", endTime: "02:00", overnight: true },
            ],
          },
        ],
      },
    })
  )
  expect(
    within(screen.getByText("Tuesday").closest("li")!).getByText("22:00–24:00")
  ).toBeTruthy()
  expect(
    within(screen.getByText("Wednesday").closest("li")!).getByText(
      "00:00–02:00"
    )
  ).toBeTruthy()
})
it("applies a current closure notice to the compact week", () => {
  render(
    h(LibraryHoursTable, {
      compact: true,
      openingTimes: hours,
      timezone: "Europe/London",
      notices: [
        {
          id: "notice",
          type: "closure",
          scope: "library",
          from: "2026-10-06",
          to: "2026-10-06",
          scopeWeek: null,
          scopeDay: null,
          stopId: null,
          message: "Maintenance",
          reason: "maintenance",
          endedAt: null,
        },
      ],
    })
  )
  const day = within(screen.getByText("Tuesday").closest("li")!)
  expect(day.getByText("Closed")).toBeTruthy()
  expect(day.queryByText("09:00–12:30")).toBeNull()
})

it("keeps split sessions and access notes in the dashboard layout", () => {
  render(
    h(LibraryHoursTable, {
      dashboard: true,
      openingTimes: hours,
      timezone: "Europe/London",
    })
  )
  const day = within(screen.getByText(/Tuesday/).closest("li")!)
  expect(day.queryByText("09:00–17:00")).toBeNull()
  expect(day.getByText("Library card required")).toBeTruthy()
  expect(day.getByText("Self-service")).toBeTruthy()
})
it("shows a simple dashboard session once, with its staffing mode", () => {
  render(
    h(LibraryHoursTable, {
      dashboard: true,
      openingTimes: {
        days: [
          {
            day: "tuesday",
            enabled: true,
            timeframes: [
              { startTime: "09:00", endTime: "17:00", staffing: "staffed" },
            ],
          },
        ],
      },
      timezone: "Europe/London",
    })
  )
  const day = within(screen.getByText(/Tuesday/).closest("li")!)
  expect(day.getAllByText(/09:00–17:00/)).toHaveLength(1)
  expect(day.getByText("Staffed")).toBeTruthy()
})
