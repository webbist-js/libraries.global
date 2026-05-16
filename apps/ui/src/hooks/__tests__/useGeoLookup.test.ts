// @vitest-environment happy-dom
// apps/ui/src/hooks/__tests__/useGeoLookup.test.ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockGeocodePlaceName = vi.fn()
vi.mock("@/lib/geo-lookup", () => ({
  geocodePlaceName: mockGeocodePlaceName,
}))

const { useGeoLookup } = await import("@/hooks/useGeoLookup")

beforeEach(() => {
  vi.useFakeTimers()
  mockGeocodePlaceName.mockResolvedValue({
    lat: 51.5,
    lng: -0.1,
    countryCode: "GB",
    countrySlug: "united-kingdom",
    continentSlug: "europe",
    displayName: "London, England, UK",
  })
})

afterEach(() => {
  vi.useRealTimers()
  mockGeocodePlaceName.mockReset()
})

describe("useGeoLookup", () => {
  it("does not call geocoder when query is shorter than minLength", async () => {
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("Lo", onResult))
    await act(() => vi.runAllTimersAsync())
    expect(mockGeocodePlaceName).not.toHaveBeenCalled()
  })

  it("calls geocoder after debounce with query of sufficient length", async () => {
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("London", onResult))
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(mockGeocodePlaceName).toHaveBeenCalledWith("London")
  })

  it("calls onResult with the geocoder result", async () => {
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("London", onResult))
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(onResult).toHaveBeenCalledWith(
      expect.objectContaining({ countrySlug: "united-kingdom" })
    )
  })

  it("does not call onResult when geocoder returns null", async () => {
    mockGeocodePlaceName.mockResolvedValue(null)
    const onResult = vi.fn()
    renderHook(() => useGeoLookup("nowhere", onResult))
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(onResult).not.toHaveBeenCalled()
  })

  it("debounces — only fires once if query changes rapidly", async () => {
    const onResult = vi.fn()
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useGeoLookup(q, onResult),
      { initialProps: { q: "Lon" } }
    )
    rerender({ q: "Lond" })
    rerender({ q: "Londo" })
    rerender({ q: "London" })
    await act(() => vi.advanceTimersByTimeAsync(600))
    expect(mockGeocodePlaceName).toHaveBeenCalledTimes(1)
    expect(mockGeocodePlaceName).toHaveBeenCalledWith("London")
  })
})
