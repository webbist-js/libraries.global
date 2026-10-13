import * as THREE from "three"
import { describe, expect, it } from "vitest"

import { latLngToVector3 } from "@/components/home/knowledge-globe-data"
import {
  globeHomeAzimuthDelta,
  globeViewAdjustment,
} from "@/components/home/knowledge-globe-motion"

describe("globe geographic shortcuts", () => {
  it.each([
    { lat: 51.5, lng: -0.1 },
    { lat: -15, lng: -60 },
    { lat: 30, lng: 110 },
    { lat: -25, lng: 140 },
    { lat: 0, lng: 179 },
    { lat: 80, lng: -179 },
  ])("faces $lat, $lng exactly with the homepage's tilt", (view) => {
    const framing = { pitch: 20, yaw: 25, tilt: THREE.MathUtils.degToRad(22) }
    const opening = new THREE.Quaternion()
      .setFromEuler(
        new THREE.Euler(
          THREE.MathUtils.degToRad(framing.pitch),
          0,
          framing.tilt
        )
      )
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          THREE.MathUtils.degToRad(framing.yaw)
        )
      )
    const point = latLngToVector3(view.lat, view.lng, 1)
      .applyQuaternion(opening)
      .applyQuaternion(globeViewAdjustment(view, framing))

    expect(point.distanceTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-12)
  })

  it("returns an orbit across the short arc after multiple manual turns", () => {
    for (const azimuth of [-9, -3, -0.5, 0, 0.5, 3, 9]) {
      const delta = globeHomeAzimuthDelta(azimuth)
      expect(Math.abs(delta)).toBeLessThanOrEqual(Math.PI)
      expect(Math.sin(azimuth + delta)).toBeCloseTo(0, 12)
      expect(Math.cos(azimuth + delta)).toBeCloseTo(1, 12)
    }
  })
})
