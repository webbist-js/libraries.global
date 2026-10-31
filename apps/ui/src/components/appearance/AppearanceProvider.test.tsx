// @vitest-environment happy-dom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  AppearanceProvider,
  useAppearance,
} from "@/components/appearance/AppearanceProvider"
import { APPEARANCE_STORAGE_KEY } from "@/lib/appearance"

let matches = false
const listeners = new Set<(query: { matches: boolean }) => void>()
function Probe() {
  const appearance = useAppearance()!

  return (
    <>
      <output>{`${appearance.preference}:${appearance.resolved}`}</output>
      <button
        disabled={!appearance.ready || !appearance.enabled}
        onClick={() => appearance.choose("dark")}
      >
        Dark
      </button>
      <button
        disabled={!appearance.ready || !appearance.enabled}
        onClick={() => appearance.choose("system")}
      >
        System
      </button>
    </>
  )
}
beforeEach(() => {
  localStorage.clear()
  document.documentElement.className = ""
  matches = false
  listeners.clear()
  vi.stubGlobal("matchMedia", () => ({
    get matches() {
      return matches
    },
    media: "(prefers-color-scheme: dark)",
    addListener: (fn: (query: { matches: boolean }) => void) => {
      listeners.add(fn)
    },
    removeListener: (fn: (query: { matches: boolean }) => void) => {
      listeners.delete(fn)
    },
  }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe("real next-themes appearance integration", () => {
  it("updates the document and persists the selected preference", async () => {
    render(
      <AppearanceProvider>
        <Probe />
      </AppearanceProvider>
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Dark" }).hasAttribute("disabled")
      ).toBe(false)
    )
    fireEvent.click(screen.getByRole("button", { name: "Dark" }))
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    )
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("dark")
    expect(document.documentElement.style.colorScheme).toBe("dark")
  })
  it("keeps System persisted while following live browser preference changes", async () => {
    render(
      <AppearanceProvider>
        <Probe />
      </AppearanceProvider>
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "System" }).hasAttribute("disabled")
      ).toBe(false)
    )
    fireEvent.click(screen.getByRole("button", { name: "System" }))
    await act(async () => {
      matches = true
      for (const listener of listeners) listener({ matches: true })
    })
    await waitFor(() =>
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    )
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("system")
    await act(async () => {
      matches = false
      for (const listener of listeners) listener({ matches: false })
    })
    await waitFor(() =>
      expect(document.documentElement.classList.contains("light")).toBe(true)
    )
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("system")
  })
  it("forces the rollback appearance without overwriting a stored choice", async () => {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, "dark")
    render(
      <AppearanceProvider enabled={false}>
        <Probe />
      </AppearanceProvider>
    )
    await waitFor(() =>
      expect(document.documentElement.classList.contains("light")).toBe(true)
    )
    expect(
      screen.getByRole("button", { name: "Dark" }).hasAttribute("disabled")
    ).toBe(true)
    expect(localStorage.getItem(APPEARANCE_STORAGE_KEY)).toBe("dark")
  })
})
