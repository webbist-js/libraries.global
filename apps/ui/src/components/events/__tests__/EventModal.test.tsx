// @vitest-environment happy-dom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { EventModal } from "../EventModal"
import { EventModalProvider, useEventModal } from "../EventModalContext"

vi.mock("@iconify/react", () => ({ Icon: () => null }))

function OpenEvent() {
  const { openModal } = useEventModal()

  return <button onClick={() => openModal("event-123")}>Open event</button>
}

function openEvent() {
  render(
    <EventModalProvider>
      <OpenEvent />
      <EventModal />
    </EventModalProvider>
  )
  const trigger = screen.getByRole("button", { name: "Open event" })
  trigger.focus()
  fireEvent.click(trigger)

  return trigger
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("Event details drawer", () => {
  it("keeps fetched event details and links, then restores focus on Escape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () =>
          url === "/api/saved-events"
            ? []
            : {
                documentId: "event-123",
                title: "Book club",
                description: "Bring your latest read.",
                startTime: "2026-10-08T17:00:00Z",
                allDay: false,
                eventType: "book_club",
                isFree: true,
                url: "https://library.example/events/book-club",
                registrationUrl: "https://library.example/register",
              },
      }))
    )
    const trigger = openEvent()
    const dialog = await screen.findByRole("dialog", { name: "Book club" })
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(screen.getByText("Bring your latest read.")).toBeTruthy()
    expect(
      screen.getByRole("link", { name: "Register" }).getAttribute("href")
    ).toBe("https://library.example/register")
    expect(
      screen.getByRole("link", { name: "Full details" }).getAttribute("href")
    ).toBe("/events/event-123")
    fireEvent.keyDown(screen.getByRole("button", { name: "Close" }), {
      key: "Escape",
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(trigger))
    expect(Object.hasOwn(document.body.dataset, "scrollLocked")).toBe(false)
  })

  it("keeps a failed event request honest and the drawer dismissible", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false }))
    )
    openEvent()
    expect(await screen.findByText("Event not found.")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Register" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
  })
})
