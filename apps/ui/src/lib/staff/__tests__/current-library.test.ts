// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { setCurrentLibrary, useCurrentLibrary } from "../current-library"

afterEach(() => {
  setCurrentLibrary(null)
})

describe("current library store", () => {
  it("starts empty and follows the page's library", () => {
    const { result } = renderHook(() => useCurrentLibrary())
    expect(result.current).toBeNull()
    act(() => setCurrentLibrary("lib000000000000000000001"))
    expect(result.current).toBe("lib000000000000000000001")
    act(() => setCurrentLibrary(null))
    expect(result.current).toBeNull()
  })

  it("shares one value between readers and ignores repeats", () => {
    const a = renderHook(() => useCurrentLibrary())
    const b = renderHook(() => useCurrentLibrary())
    act(() => setCurrentLibrary("libA"))
    act(() => setCurrentLibrary("libA"))
    expect(a.result.current).toBe("libA")
    expect(b.result.current).toBe("libA")
    a.unmount()
    act(() => setCurrentLibrary("libB"))
    expect(b.result.current).toBe("libB")
  })
})
