import type { PublicLiveState, MobileTimetable } from "@repo/shared-data"
import { describe, expect, it } from "vitest"

import { coarseRing, mobileMapData } from "../mobile-map-data"

const tt: MobileTimetable = {
  version: 1,
  cycle: { weeks: 1, anchor: "2026-10-05" },
  stops: [
    {
      id: "aaaaaaaaaa",
      name: "A",
      where: "",
      location: { lat: 51, lng: 0 },
      areaDocumentId: null,
    },
    {
      id: "bbbbbbbbbb",
      name: "B",
      where: "",
      location: { lat: 51.1, lng: 0.1 },
      areaDocumentId: null,
    },
  ],
  visits: [
    {
      id: "cccccccccc",
      stopId: "aaaaaaaaaa",
      day: "tue",
      arrive: "09:00",
      depart: "10:00",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
    {
      id: "dddddddddd",
      stopId: "bbbbbbbbbb",
      day: "tue",
      arrive: "11:00",
      depart: "12:00",
      repeat: { kind: "cycle", weeks: [1] },
      termTimeOnly: false,
      validFrom: null,
      validTo: null,
    },
  ],
}
const library = {
  documentId: "lib",
  name: "Mobile",
  path: null,
  timezone: "Europe/London",
  status: "open",
  updatedAt: "",
  timetable: tt,
  notices: [],
}
const state: PublicLiveState = {
  libraryDocumentId: "lib",
  kind: "road",
  sharesLive: true,
  stopId: "aaaaaaaaaa",
  nextStopId: "bbbbbbbbbb",
  until: null,
  scheduledAt: "11:00",
  expectedAt: "11:00",
  delayMin: 0,
  noticeMessage: null,
  nextService: null,
  position: null,
  skippedStopIds: [],
  updatedAt: "2026-10-06T09:15:00Z",
}
const now = new Date("2026-10-06T09:20:00Z")
describe("mobile map presentation", () => {
  it("bounds route loading and renders check-ins between stops without a location history", () => {
    const data = mobileMapData([], [], [library], { lib: state }, now)
    expect(data.routes.features[0]?.properties?.live).toBe(true)
    expect(data.vehicles.features[0]?.geometry.coordinates[0]).toBeCloseTo(0.05)
    expect(data.vehicles.features[0]?.geometry.coordinates[1]).toBeCloseTo(
      51.05
    )
    expect(data.rings.features).toHaveLength(0)
    expect(
      mobileMapData(
        [],
        [],
        Array.from({ length: 30 }, (_, i) => ({
          ...library,
          documentId: String(i),
        })),
        {},
        now
      ).routes.features
    ).toHaveLength(25)
  })
  it("shows a coarse ring only for a fresh published approximate position", () => {
    const data = mobileMapData(
      [],
      [],
      [library],
      { lib: { ...state, position: { lat: 51.04, lng: 0.04 } } },
      now
    )
    expect(data.rings.features).toHaveLength(1)
    expect(data.rings.features[0]?.geometry.coordinates[0]).toHaveLength(49)
    const stale = mobileMapData(
      [],
      [],
      [library],
      { lib: { ...state, kind: "stale", position: { lat: 51, lng: 0 } } },
      now
    )
    expect(stale.vehicles.features).toHaveLength(0)
    expect(stale.rings.features).toHaveLength(0)
    const ring = coarseRing(51, 0)
    expect(ring[0]?.[0]).toBeCloseTo(
      250 / 111320 / Math.cos((51 * Math.PI) / 180)
    )
    expect(ring[0]?.[1]).toBeCloseTo(ring[48]?.[1] ?? 0)
  })
})
