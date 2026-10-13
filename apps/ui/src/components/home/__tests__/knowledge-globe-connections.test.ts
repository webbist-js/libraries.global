import { describe, expect, it } from "vitest"

import {
  buildLibraryArcs,
  latLngToVector3,
} from "@/components/home/knowledge-globe-data"

const markers = [
  { lat: 51.53, lng: -0.13, featured: true, name: "British Library" },
  {
    lat: 48.83,
    lng: 2.38,
    featured: true,
    name: "Bibliothèque nationale de France",
  },
  { lat: 52.52, lng: 13.4, featured: true, name: "Berlin State Library" },
  { lat: 40, lng: 20, featured: false, name: "Ordinary library" },
]

it("keeps names attached to the exact endpoints of the existing arcs", () => {
  for (const route of buildLibraryArcs(markers)) {
    expect(route.endpoints).toHaveLength(2)
    const [a, b] = route.endpoints!
    expect(a.name).toBeTruthy()
    expect(b.name).toBeTruthy()
    expect(a.featured && b.featured).toBe(true)
    expect(
      route.curve
        .getPoint(0)
        .clone()
        .normalize()
        .distanceTo(latLngToVector3(a.lat, a.lng, 1))
    ).toBeLessThan(1e-10)
    expect(
      route.curve
        .getPoint(1)
        .clone()
        .normalize()
        .distanceTo(latLngToVector3(b.lat, b.lng, 1))
    ).toBeLessThan(1e-10)
  }
})

describe("shared globe appearance", () => {
  it("metadata does not change connection curves, colours, phases or order", () => {
    const named = buildLibraryArcs(markers)
    const unnamed = buildLibraryArcs(
      markers.map(({ name: _name, ...marker }) => marker)
    )
    expect(named).toHaveLength(unnamed.length)
    named.forEach((route, index) => {
      expect(route.color).toBe(unnamed[index]!.color)
      expect(route.phase).toBe(unnamed[index]!.phase)
      expect(route.linePoints).toEqual(unnamed[index]!.linePoints)
    })
  })
})
