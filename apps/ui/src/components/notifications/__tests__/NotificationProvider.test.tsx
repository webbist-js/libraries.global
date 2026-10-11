// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { NotificationProvider, useNotifications } from "../NotificationProvider"

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "owner" } } }) },
}))
let payload: any
let notes: any[]
let contexts: any[]
function Consumer() {
  const { unread, refresh, previewSound, loading } = useNotifications()

  return (
    <>
      <p>{unread} unread</p>
      <button disabled={loading} onClick={() => void refresh()}>
        Refresh
      </button>
      <button onClick={previewSound}>Preview sound</button>
    </>
  )
}
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <NotificationProvider>
        <Consumer />
        <Consumer />
      </NotificationProvider>
    </QueryClientProvider>
  )
}
beforeEach(() => {
  payload = { data: [], unread: 0, soundOn: true }
  notes = []
  contexts = []
  localStorage.clear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => structuredClone(payload),
    }))
  )
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0
      state = "running"
      destination = {}
      constructor() {
        contexts.push(this)
      }

      resume = vi.fn(async () => {})
      close = vi.fn(async () => {})
      createOscillator() {
        const o = {
          frequency: { value: 0 },
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          disconnect: vi.fn(),
          addEventListener: vi.fn(),
        }
        notes.push(o)

        return o
      }

      createGain() {
        return {
          connect: vi.fn(),
          disconnect: vi.fn(),
          gain: {
            setValueAtTime: vi.fn(),
            exponentialRampToValueAtTime: vi.fn(),
          },
        }
      }
    }
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe("shared notification status and sound", () => {
  it("fetches once for multiple consumers and never chimes for existing unread notifications", async () => {
    payload = {
      data: [{ documentId: "old", createdAt: "2026-10-01", readAt: null }],
      unread: 1,
      soundOn: true,
    }
    mount()
    await waitFor(() => expect(screen.getAllByText("1 unread")).toHaveLength(2))
    expect(fetch).toHaveBeenCalledOnce()
    expect(notes).toHaveLength(0)
    expect(contexts).toHaveLength(0)
  })
  it("plays one quiet chime for the first new notification after an interaction, not for read receipts", async () => {
    mount()
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("button", { name: "Refresh" })[0]!
          .hasAttribute("disabled")
      ).toBe(false)
    )
    await act(async () => {
      fireEvent.pointerDown(document)
    })
    payload = {
      data: [{ documentId: "new", createdAt: "2026-10-11", readAt: null }],
      unread: 1,
      soundOn: true,
    }
    fireEvent.click(screen.getAllByRole("button", { name: "Refresh" })[0]!)
    await waitFor(() => expect(notes).toHaveLength(2))
    expect(contexts).toHaveLength(1)
    payload.data[0].readAt = "2026-10-11"
    payload.unread = 0
    fireEvent.click(screen.getAllByRole("button", { name: "Refresh" })[0]!)
    await waitFor(() => expect(screen.getAllByText("0 unread")).toHaveLength(2))
    expect(notes).toHaveLength(2)
  })
  it("respects the sound setting and leaves the unread count working", async () => {
    payload.soundOn = false
    mount()
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("button", { name: "Refresh" })[0]!
          .hasAttribute("disabled")
      ).toBe(false)
    )
    fireEvent.pointerDown(document)
    payload.data = [
      { documentId: "new", createdAt: "2026-10-11", readAt: null },
    ]
    payload.unread = 1
    fireEvent.click(screen.getAllByRole("button", { name: "Refresh" })[0]!)
    await waitFor(() => expect(screen.getAllByText("1 unread")).toHaveLength(2))
    fireEvent.click(
      screen.getAllByRole("button", { name: "Preview sound" })[0]!
    )
    expect(notes).toHaveLength(0)
    expect(contexts).toHaveLength(0)
  })
})
