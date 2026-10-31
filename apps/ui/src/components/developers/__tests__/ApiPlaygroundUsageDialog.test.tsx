// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { ApiPlayground } from "@/components/developers/ApiPlayground"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("opens on every visit by default and continuing sends no requests", async () => {
  const fetch = vi.fn()
  vi.stubGlobal("fetch", fetch)
  const view = render(<ApiPlayground teamName="Library service" />)
  expect(screen.getByRole("dialog").textContent).toContain(
    "Library service’s shared monthly allowance"
  )
  expect(screen.getByRole("checkbox").getAttribute("checked")).toBeNull()
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to playground" })
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(fetch).not.toHaveBeenCalled()
  view.unmount()
  render(<ApiPlayground teamName="Library service" />)
  expect(screen.getByRole("dialog")).toBeTruthy()
})

it("saves only the explicit opt-out and keeps the inline notice visible", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }))
  vi.stubGlobal("fetch", fetch)
  render(<ApiPlayground teamName="Library service" />)
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Don’t show this again" })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to playground" })
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(fetch).toHaveBeenCalledExactlyOnceWith(
    "/api/profile/me/prompts",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify({ prompt: "api-playground-usage", dismissed: true }),
    })
  )
  expect(
    screen.getByText("This playground uses your Team’s API allowance.")
  ).toBeTruthy()
})

it("allows continuing without saving if persistence fails", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}, { status: 503 }))
  vi.stubGlobal("fetch", fetch)
  render(<ApiPlayground teamName="Library service" />)
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Don’t show this again" })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to playground" })
  )
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Couldn’t save your preference"
  )
  expect(screen.getByRole("dialog")).toBeTruthy()
  fireEvent.click(
    screen.getByRole("checkbox", { name: "Don’t show this again" })
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to playground" })
  )
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  expect(fetch).toHaveBeenCalledTimes(1)
})

it("leaves the inline notice visible when the saved preference hides the modal", () => {
  render(<ApiPlayground teamName="Library service" showUsageWarning={false} />)
  expect(screen.queryByRole("dialog")).toBeNull()
  expect(
    screen.getByText("This playground uses your Team’s API allowance.")
  ).toBeTruthy()
})
