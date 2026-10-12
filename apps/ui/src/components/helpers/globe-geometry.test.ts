// @vitest-environment happy-dom

import * as THREE from "three"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createActivitySampler,
  createLandDotsGeometry,
  createSeededRandom,
  type ActivitySource,
} from "@/components/helpers/globe-geometry"

afterEach(() => vi.restoreAllMocks())

describe("globe activity index", () => {
  it("preserves the complete sum and ordering across cell boundaries", () => {
    const random = createSeededRandom(14)
    const sources: ActivitySource[] = Array.from({ length: 400 }, () => ({
      position: new THREE.Vector3(
        random() * 6 - 3,
        random() * 6 - 3,
        random() * 6 - 3
      ),
      radius: 0.2 + random() * 0.5,
      weight: random(),
    }))
    const sample = createActivitySampler(sources)
    for (let i = 0; i < 100; i++) {
      const point = new THREE.Vector3(
        random() * 6 - 3,
        random() * 6 - 3,
        random() * 6 - 3
      )
      const expected = sources.reduce((sum, source) => {
        const influence = Math.max(
          0,
          1 - point.distanceTo(source.position) / source.radius
        )

        return sum + influence * influence * source.weight
      }, 0)
      expect(sample(point)).toBe(expected)
    }
  })

  it("avoids measuring distant sources for every land dot", () => {
    const sources = Array.from({ length: 2000 }, () => ({
      position: new THREE.Vector3(3, 0, 0),
      radius: 0.3,
      weight: 0.1,
    }))
    sources.push({
      position: new THREE.Vector3(0, 0, 0),
      radius: 0.3,
      weight: 0.5,
    })
    const sample = createActivitySampler(sources)
    const point = new THREE.Vector3(0.1, 0, 0)
    const distance = vi.spyOn(point, "distanceToSquared")
    expect(sample(point)).toBeCloseTo((1 - 0.1 / 0.3) ** 2 * 0.5)
    expect(distance).toHaveBeenCalledOnce()
  })
})

describe("globe mask pixels", () => {
  it("reads one mask once across land, ocean and subsequent globe instances", () => {
    const image = new Image()
    image.width = 8
    image.height = 4
    image.src = "/earth.jpg"
    const drawImage = vi.fn()
    const getImageData = vi.fn(() => ({
      data: new Uint8ClampedArray(8 * 4 * 4),
    }))
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(((
      type: string
    ) =>
      type === "2d"
        ? { drawImage, getImageData }
        : null) as typeof HTMLCanvasElement.prototype.getContext)
    const options = {
      maskImage: image,
      radius: 3.2,
      latBounds: [-2, 2] as [number, number],
      lngBounds: [-2, 2] as [number, number],
    }
    const land = createLandDotsGeometry(options)
    const ocean = createLandDotsGeometry({ ...options, invert: true })
    const secondLand = createLandDotsGeometry(options)
    expect(drawImage).toHaveBeenCalledOnce()
    expect(getImageData).toHaveBeenCalledOnce()
    expect(secondLand.getAttribute("position").array).toEqual(
      land.getAttribute("position").array
    )
    land.dispose()
    ocean.dispose()
    secondLand.dispose()
  })
})
