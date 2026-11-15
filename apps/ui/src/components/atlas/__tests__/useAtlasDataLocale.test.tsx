// @vitest-environment happy-dom
import { act, renderHook, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { EMPTY_FILTERS } from "../atlas.logic"
import { useAtlasData } from "../useAtlasData"

const language = vi.hoisted(() => ({ current: "en" }))
vi.mock("next-intl", () => ({ useLocale: () => language.current }))
vi.mock("../atlas-data-client", () => ({
  atlasQuery: () => new Promise(() => {}),
  loadAtlasGeneration: () => new Promise(() => {}),
}))
afterEach(() => {
  language.current = "en"
  vi.unstubAllGlobals()
})
it("reloads the same selected library when the route language changes", async () => {
  let resolveJapanese!: (response: Response) => void
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ library: { id: "one", name: "Library" } })
    )
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          resolveJapanese = resolve
        })
    )
  vi.stubGlobal("fetch", fetch)
  // DOM language can lag behind the locale context during navigation.
  document.documentElement.lang = "en"
  const { result, rerender, unmount } = renderHook(() =>
    useAtlasData(
      true,
      EMPTY_FILTERS,
      [],
      [],
      "compare",
      null,
      "",
      "one",
      new Date()
    )
  )
  await waitFor(() => expect(result.current.selected?.name).toBe("Library"))
  language.current = "ja"
  rerender()
  expect(fetch.mock.calls[1]?.[0]).toBe("/api/atlas/library?key=one&locale=ja")
  expect(result.current.selected).toBeNull()
  expect(result.current.selectionLoading).toBe(true)
  await act(async () =>
    resolveJapanese(Response.json({ library: { id: "one", name: "図書館" } }))
  )
  expect(result.current.selected?.name).toBe("図書館")
  expect(result.current.selectionLoading).toBe(false)
  unmount()
})
