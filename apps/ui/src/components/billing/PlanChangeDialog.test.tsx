// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

function translate(key: string) {
  return key
}

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => translate,
}))

import { PlanChangeDialog } from "./PlanChangeDialog"

const fetcher = vi.fn()
const catalogue = {
  available: true,
  sandbox: true,
  prices: [
    { plan: "supporter", interval: "month", currency: "gbp", unitAmount: 300 },
    { plan: "supporter", interval: "year", currency: "gbp", unitAmount: 3000 },
    { plan: "pro", interval: "month", currency: "gbp", unitAmount: 500 },
    { plan: "pro", interval: "year", currency: "gbp", unitAmount: 5000 },
  ],
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetcher)
  fetcher.mockReset().mockResolvedValue(Response.json(catalogue))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

async function openDialog() {
  const trigger = screen.getByRole("button", { name: "changePlan" })
  trigger.focus()
  fireEvent.click(trigger)
  await screen.findByRole("radio", { name: /supporter/ })

  return trigger
}

describe("plan-change dialog controls", () => {
  it("styles only the icon close control and dismisses without changing the plan", async () => {
    render(<PlanChangeDialog plan="pro" interval="year" />)
    const trigger = await openDialog()
    const dialog = screen.getByRole("dialog", { name: "changePlan" })
    const cancel = screen.getByRole("button", { name: "dismiss" })
    const icon = screen.getByRole("button", { name: "close" })

    // Both controls close the dialog, but only the icon gets square sizing.
    expect([...dialog.querySelectorAll(".size-11")]).toEqual([icon])
    expect(cancel.classList.contains("size-11")).toBe(false)
    fireEvent.click(screen.getByRole("radio", { name: /supporter/ }))
    expect(
      (
        screen.getByRole("button", {
          name: "reviewChange",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(false)
    fireEvent.click(cancel)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(trigger)
    expect(
      fetcher.mock.calls.every(([url]) => url === "/api/billing/prices")
    ).toBe(true)
  })

  it("closes with Escape and restores focus to the trigger", async () => {
    render(<PlanChangeDialog plan="supporter" interval="month" />)
    const trigger = await openDialog()
    fireEvent.keyDown(document.activeElement ?? document.body, {
      key: "Escape",
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it("requires a second confirmation for a period-end reduction", async () => {
    const complete = vi.fn()
    const quote = {
      kind: "schedule",
      effectiveAt: 1823342400,
      unitAmount: 3000,
      currency: "gbp",
      scheduled: false,
    }
    let reviews = 0
    fetcher.mockImplementation(async (url: string) =>
      Response.json(
        url === "/api/billing/prices"
          ? catalogue
          : { ...quote, scheduled: ++reviews === 2 }
      )
    )
    render(
      <PlanChangeDialog plan="pro" interval="year" onComplete={complete} />
    )
    await openDialog()
    fireEvent.click(screen.getByRole("radio", { name: /supporter/ }))
    fireEvent.click(screen.getByRole("button", { name: "reviewChange" }))
    const confirm = await screen.findByRole("button", {
      name: "confirmSchedule",
    })
    expect(complete).not.toHaveBeenCalled()
    expect(screen.getByText("scheduledNoCharge")).toBeTruthy()
    fireEvent.click(confirm)
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole("dialog")).toBeNull()
    const changes = fetcher.mock.calls.filter(
      ([url]) => url === "/api/billing/change-plan"
    )
    expect(changes.map(([, options]) => JSON.parse(options.body))).toEqual([
      { plan: "supporter", interval: "year", locale: "en" },
      {
        plan: "supporter",
        interval: "year",
        locale: "en",
        action: "confirm",
        effectiveAt: quote.effectiveAt,
      },
    ])
  })
})
