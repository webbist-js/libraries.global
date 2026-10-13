// @vitest-environment happy-dom
import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { search, timetable } = vi.hoisted(() => ({
  search: vi.fn(),
  timetable: vi.fn(),
}))
vi.mock("@/lib/mobile-stop-search", () => ({
  searchMobileViewport: search,
  loadStopTimetable: timetable,
}))
import { useMobileAtlas } from "../useMobileAtlas"

const library = {
  documentId: "mobile",
  name: "Demo",
  timezone: "UTC",
  path: null,
  status: "open",
  updatedAt: "first",
  timetable: null,
  notices: [],
}
const view = {
  lat: 50,
  lng: -5,
  zoom: 10,
  bounds: { west: -6, east: -4, south: 49, north: 51 },
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-10-08T12:00:00Z"))
  search.mockResolvedValue({
    stops: [{ library_document_id: "mobile" }],
    clusters: [],
    total: 1,
    zoomIn: false,
  })
  timetable.mockResolvedValue(library)
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      Response.json(
        url.includes("/routes?")
          ? { routes: [], unavailable: false }
          : { states: [] }
      )
    )
  )
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
it("refreshes an edited timetable after five minutes even when minute updates keep using the cache", async () => {
  const { result, rerender } = renderHook(
    ({ now }) => useMobileAtlas(view, true, "any", now),
    { initialProps: { now: new Date() } }
  )
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
  expect(result.current.routes[0]?.updatedAt).toBe("first")
  for (const minute of [1, 2, 3, 4]) {
    vi.setSystemTime(new Date(`2026-10-08T12:0${minute}:00Z`))
    rerender({ now: new Date() })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300)
    })
  }
  expect(timetable).toHaveBeenCalledTimes(1)
  timetable.mockResolvedValue({ ...library, updatedAt: "edited" })
  vi.setSystemTime(new Date("2026-10-08T12:06:00Z"))
  rerender({ now: new Date() })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
  expect(timetable).toHaveBeenCalledTimes(2)
  expect(result.current.routes[0]?.updatedAt).toBe("edited")
})
