// @vitest-environment happy-dom
import {
  API_REACH_PER_HOUR,
  API_REACH_SERVICE_LIBRARIES,
  CONTRIBUTOR_REACH_PER_WEEK,
} from "@repo/access"
import { useState } from "react"
import { afterEach, expect, it, vi } from "vitest"

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@/test/render"

import { AtlasReachLockDialog } from "../AtlasReachLockDialog"

afterEach(cleanup)

function Harness(
  props: Omit<
    Parameters<typeof AtlasReachLockDialog>[0],
    "open" | "onOpenChange"
  >
) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Use Reach
      </button>
      <AtlasReachLockDialog {...props} open={open} onOpenChange={setOpen} />
    </>
  )
}

function openDialog() {
  const trigger = screen.getByRole("button", { name: "Use Reach" })
  trigger.focus()
  fireEvent.click(trigger)

  return { trigger, dialog: screen.getByRole("dialog") }
}

it("offers both routes with allowances from the access constants", () => {
  expect(CONTRIBUTOR_REACH_PER_WEEK).toBe(2)
  render(<Harness signedIn />)
  const { dialog } = openDialog()
  expect(screen.getByRole("dialog", { name: "Unlock travel-time Reach" })).toBe(
    dialog
  )
  expect(document.activeElement).toBe(
    within(dialog).getByRole("heading", { name: "Unlock travel-time Reach" })
  )
  const contributor = within(dialog).getByRole("region", {
    name: "Contributor",
  })
  expect(
    within(contributor).getByText(
      /Your first accepted contribution unlocks two new Reach calculations a week; reopening results is free/
    )
  ).toBeTruthy()
  expect(
    within(contributor)
      .getByRole("link", { name: "Make your first contribution" })
      .getAttribute("href")
  ).toMatch(/\/contribute$/)
  const api = within(dialog).getByRole("region", { name: "API Access" })
  expect(
    within(api).getByText(
      new RegExp(
        `${API_REACH_PER_HOUR} calculations an hour and Reach for a whole library service of up to ${API_REACH_SERVICE_LIBRARIES} libraries`
      )
    )
  ).toBeTruthy()
  expect(
    within(api)
      .getByRole("link", { name: "See API Access" })
      .getAttribute("href")
  ).toMatch(/\/developers$/)
  expect(within(dialog).queryByText(/free account/)).toBeNull()
})

it("closes on Escape and on Not now, returning focus to the trigger", async () => {
  render(<Harness signedIn />)
  let { trigger, dialog } = openDialog()
  fireEvent.keyDown(dialog, { key: "Escape" })
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
  ;({ trigger, dialog } = openDialog())
  fireEvent.click(within(dialog).getByRole("button", { name: "Not now" }))
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})

it("tells signed-out visitors that contributing needs a free account", () => {
  const onSignIn = vi.fn()
  render(<Harness signedIn={false} onSignIn={onSignIn} />)
  const { dialog } = openDialog()
  expect(
    within(dialog).getByText(/Contributing needs a free account/)
  ).toBeTruthy()
  expect(
    within(dialog)
      .getByRole("link", { name: "create one" })
      .getAttribute("href")
  ).toMatch(/\/auth\/register$/)
  fireEvent.click(within(dialog).getByRole("button", { name: "Sign in" }))
  expect(onSignIn).toHaveBeenCalledOnce()
})

it("offers only API Access for Reach across a whole library service", () => {
  render(<Harness signedIn scope="service" />)
  const { dialog } = openDialog()
  expect(
    screen.getByRole("dialog", { name: "Reach for a whole library service" })
  ).toBe(dialog)
  expect(
    within(dialog).queryByRole("link", { name: "Make your first contribution" })
  ).toBeNull()
  expect(
    within(dialog).getByRole("link", { name: "See API Access" })
  ).toBeTruthy()
})
