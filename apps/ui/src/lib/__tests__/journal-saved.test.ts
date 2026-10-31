// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { parseSavedJournal, toggleSavedJournal } from "@/lib/journal-saved"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})
it("bounds and validates saved IDs without retaining unexpected metadata", () => {
  expect(parseSavedJournal('{"private":"value"}')).toEqual([])
  expect(
    parseSavedJournal('["article","article","../unsafe","","other",42]')
  ).toEqual(["article", "other"])
  expect(
    parseSavedJournal(
      JSON.stringify(
        Array.from({ length: 120 }, (_, index) => `article-${index}`)
      )
    )
  ).toHaveLength(100)
})
it("persists toggles and notifies the mounted browser views", () => {
  const listener = vi.fn()
  window.addEventListener("journal-saved-changed", listener)
  expect(toggleSavedJournal("story")).toBe(true)
  expect(localStorage.getItem("libraries-global:journal-saved:v1")).toBe(
    '["story"]'
  )
  expect(toggleSavedJournal("story")).toBe(true)
  expect(localStorage.getItem("libraries-global:journal-saved:v1")).toBe("[]")
  expect(listener).toHaveBeenCalledTimes(2)
  window.removeEventListener("journal-saved-changed", listener)
})
it("reports unavailable storage instead of pretending the story was saved", () => {
  vi.stubGlobal("localStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("blocked")
    },
  })
  expect(toggleSavedJournal("story")).toBe(false)
})
