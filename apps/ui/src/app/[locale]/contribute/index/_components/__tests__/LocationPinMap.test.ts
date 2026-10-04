// @vitest-environment happy-dom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import * as React from "react"
import { createElement } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// vitest.config has no JSX runtime, so .tsx compiles to React.createElement.
Object.assign(globalThis, { React })

// A stand-in MapLibre: records what the component asks of the map and pin,
// and lets a test fire the map's and pin's events.
const fake = vi.hoisted(() => {
  type Handler = (event?: unknown) => void
  const lngLat = (lng: number, lat: number) => ({
    lng,
    lat,
    wrap: () => ({ lng, lat }),
  })
  const state = {
    webgl: true,
    maps: [] as FakeMap[],
    markers: [] as FakeMarker[],
  }

  class FakeMap {
    handlers = new Map<string, Handler>()
    flyTo = vi.fn()
    jumpTo = vi.fn()
    addControl = vi.fn()
    resize = vi.fn()
    remove = vi.fn()
    touchZoomRotate = { disableRotation: vi.fn() }
    keyboard = { disableRotation: vi.fn() }
    constructor() {
      if (!state.webgl) throw new Error("WebGL unavailable")
      state.maps.push(this)
    }

    on(event: string, handler: Handler) {
      this.handlers.set(event, handler)

      return this
    }

    fire(event: string, payload?: unknown) {
      this.handlers.get(event)?.(payload)
    }
  }

  class FakeMarker {
    handlers = new Map<string, Handler>()
    at: [number, number] | null = null
    shown = false
    constructor() {
      state.markers.push(this)
    }

    setLngLat(at: [number, number] | { lng: number; lat: number }) {
      this.at = Array.isArray(at) ? at : [at.lng, at.lat]

      return this
    }

    addTo() {
      this.shown = true

      return this
    }

    remove() {
      this.shown = false

      return this
    }

    getLngLat() {
      const [lng, lat] = this.at ?? [0, 0]

      return lngLat(lng, lat)
    }

    on(event: string, handler: Handler) {
      this.handlers.set(event, handler)

      return this
    }
  }

  return { state, lngLat, FakeMap, FakeMarker }
})

vi.mock("maplibre-gl", () => ({
  default: {
    Map: fake.FakeMap,
    Marker: fake.FakeMarker,
    NavigationControl: class {},
  },
}))

const { LocationPinMap } = await import("../LocationPinMap")

const onMove = vi.fn()
const props = (lat = "", lng = "", precise = false) => ({
  lat,
  lng,
  precise,
  onMove,
})

async function loaded() {
  await waitFor(() => expect(fake.state.maps).toHaveLength(1))
  const map = fake.state.maps[0]!
  act(() => map.fire("load"))

  return { map, marker: fake.state.markers[0]! }
}

beforeEach(() => {
  vi.clearAllMocks()
  fake.state.webgl = true
  fake.state.maps.length = 0
  fake.state.markers.length = 0
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    }
  )
})
afterEach(cleanup)

describe("LocationPinMap", () => {
  it("drops the pin where the map is clicked", async () => {
    render(createElement(LocationPinMap, props()))
    const { map, marker } = await loaded()
    act(() => map.fire("click", { lngLat: fake.lngLat(-1.9574, 53.8312) }))
    expect(onMove).toHaveBeenCalledWith(53.8312, -1.9574)
    expect(marker.shown).toBe(true)
  })

  it("reports a dragged pin", async () => {
    render(createElement(LocationPinMap, props("53.83", "-1.95")))
    const { marker } = await loaded()
    marker.setLngLat([-1.96, 53.84])
    act(() => marker.handlers.get("dragend")?.())
    expect(onMove).toHaveBeenCalledWith(53.84, -1.96)
  })

  it("follows coordinates set elsewhere: jumps first, then flies", async () => {
    const view = render(createElement(LocationPinMap, props()))
    const { map, marker } = await loaded()

    view.rerender(
      createElement(LocationPinMap, props("51.529912", "-0.127692", true))
    )
    expect(map.jumpTo).toHaveBeenCalledWith({
      center: [-0.127692, 51.529912],
      zoom: 17,
    })
    expect(marker.at).toEqual([-0.127692, 51.529912])

    view.rerender(
      createElement(LocationPinMap, props("53.8312", "-1.9485", false))
    )
    expect(map.flyTo).toHaveBeenCalledWith({
      center: [-1.9485, 53.8312],
      zoom: 14,
    })
  })

  it("doesn't fly to a pin it placed itself", async () => {
    const view = render(createElement(LocationPinMap, props("53", "-1", true)))
    const { map } = await loaded()
    act(() =>
      map.fire("click", { lngLat: fake.lngLat(-1.9574451, 53.8311966) })
    )
    view.rerender(
      createElement(LocationPinMap, props("53.831197", "-1.957445", true))
    )
    expect(map.flyTo).not.toHaveBeenCalled()
  })

  it("asks for a pin only while there are no coordinates", async () => {
    const view = render(createElement(LocationPinMap, props()))
    expect(screen.getByText(/click the map to drop a pin/)).toBeTruthy()
    view.rerender(createElement(LocationPinMap, props("53.83", "-1.95")))
    expect(screen.queryByText(/click the map to drop a pin/)).toBeNull()
  })

  it("falls back to a note without WebGL", async () => {
    fake.state.webgl = false
    render(createElement(LocationPinMap, props()))
    expect(await screen.findByText(/can’t load in this browser/)).toBeTruthy()
  })

  it("turns rotation and pitch off for touch and keyboard", async () => {
    render(createElement(LocationPinMap, props()))
    const { map } = await loaded()
    expect(map.touchZoomRotate.disableRotation).toHaveBeenCalled()
    expect(map.keyboard.disableRotation).toHaveBeenCalled()
  })
})
