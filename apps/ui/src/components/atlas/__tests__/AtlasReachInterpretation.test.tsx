// @vitest-environment happy-dom
import type { AtlasNetworkReachResult } from "@repo/shared-data"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, expect, it, vi } from "vitest"

import { AtlasReachInterpretation } from "../AtlasReachInterpretation"

import messages from "../../../../locales/en.json"

afterEach(cleanup)
const result = {
  state: "ready",
  totalResidents: 100,
  contours: [5, 10, 15, 30].map((minutes, i) => ({
    minutes,
    residents: [10, 25, 55, 90][i],
    percent: [10, 25, 55, 90][i],
    outsideResidents: 100 - [10, 25, 55, 90][i]!,
  })),
} as AtlasNetworkReachResult
const show = (value = result, minutes = 15) => {
  const onMinutes = vi.fn()
  const view = render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AtlasReachInterpretation
        result={value}
        minutes={minutes}
        onMinutes={onMinutes}
      />
    </NextIntlClientProvider>
  )

  return { ...view, onMinutes }
}
it("distinguishes exclusive bands from cumulative counts and synchronises the chosen time", () => {
  const { onMinutes } = show()
  expect(screen.getByText(/35 additional residents/)).toBeTruthy()
  expect(screen.getByText("10–15 minutes")).toBeTruthy()
  fireEvent.click(screen.getByRole("radio", { name: "Within each time" }))
  fireEvent.click(screen.getByRole("button", { name: "Within 30 min" }))
  expect(onMinutes).toHaveBeenCalledWith(30)
  expect(
    screen.getByText(/must not be added together/, { selector: "p" })
  ).toBeTruthy()
})
it("shows an honest unavailable comparison rather than reading colours from the map", () => {
  show()
  fireEvent.click(screen.getByRole("radio", { name: "Community context" }))
  expect(screen.getByRole("status").textContent).toContain(
    "map overlay alone cannot provide this comparison"
  )
  expect(screen.queryByText("0.0%")).toBeNull()
})
it("does not produce an exclusive distribution or narrative from incomplete routing", () => {
  show({ ...result, state: "partial" })
  expect(screen.queryByLabelText("What the figures show")).toBeNull()
  expect(screen.getByRole("status").textContent).toContain(
    "needs complete routing and population data"
  )
})
