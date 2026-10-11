import * as THREE from "three"
import { describe, expect, it, vi } from "vitest"

import {
  LAND_DOT_FRAGMENT_SHADER,
  LAND_DOT_VERTEX_SHADER,
} from "@/components/helpers/globe-shaders"
import { createGlobeNarrative } from "@/components/home/knowledge-globe-narrative"
import {
  addNarrativeIndex,
  applyNarrativeToPoints,
  createNarrativeGuide,
  createNarrativeUniforms,
  narrativeFragmentShader,
  narrativeVertexShader,
} from "@/components/home/knowledge-globe-narrative-renderer"

describe("globe narrative controller", () => {
  it("shares stable values and notifies once for a changed interaction", () => {
    const controller = createGlobeNarrative()
    const current = controller.current
    const listener = vi.fn()
    controller.subscribe(listener)
    controller.set({ progress: 4.5, focus: 2, growth: 0.5 })
    expect(controller.current).toBe(current)
    expect(current).toMatchObject({
      progress: 4.5,
      focus: 2,
      step: 0,
      growth: 0.5,
    })
    expect(listener).toHaveBeenCalledOnce()
    controller.set({ progress: 4.5 })
    expect(listener).toHaveBeenCalledOnce()
  })

  it("bounds scroll and ignores invalid values, including after unsubscribe", () => {
    const controller = createGlobeNarrative({
      progress: -1,
      focus: 20,
      growth: 3,
    })
    expect(controller.current).toMatchObject({
      progress: 0,
      focus: 5,
      step: 0,
      growth: 1,
    })
    const listener = vi.fn()
    const unsubscribe = controller.subscribe(listener)
    controller.set({ progress: Number.NaN, step: Infinity })
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
    controller.set({ progress: 20, step: 2 })
    expect(controller.current.progress).toBe(6)
    expect(controller.current.step).toBe(2)
    expect(listener).not.toHaveBeenCalled()
  })
})

describe("persistent narrative particles", () => {
  it("retains geographic positions when adding its stable particle identity", () => {
    const geometry = new THREE.BufferGeometry()
    const coordinates = new THREE.Float32BufferAttribute([1, 2, 3, -1, 0, 2], 3)
    geometry.setAttribute("position", coordinates)
    expect(addNarrativeIndex(geometry)).toBe(geometry)
    expect(geometry.getAttribute("position")).toBe(coordinates)
    expect([...geometry.getAttribute("aNarrativeIndex").array]).toEqual([0, 1])
    geometry.dispose()
  })

  it("projects custom dots before sizing and preserves the established point shader", () => {
    const vertex = narrativeVertexShader(LAND_DOT_VERTEX_SHADER)
    const projection = vertex.indexOf(
      "mvPosition = narrativeProject(mvPosition, position)"
    )
    expect(projection).toBeGreaterThan(
      vertex.indexOf("vec4 mvPosition = modelViewMatrix")
    )
    expect(projection).toBeLessThan(vertex.indexOf("gl_PointSize ="))
    expect(vertex).toContain("sphereViewPosition")
    expect(vertex).toContain("atan(direction.x, direction.z)")
    expect(narrativeFragmentShader(LAND_DOT_FRAGMENT_SHADER)).toContain(
      "alpha *= vNarrativeWeight"
    )
  })

  it("supports Three's actual points shader and shares mutable uniform objects", () => {
    const uniforms = createNarrativeUniforms(createGlobeNarrative().current)
    const shader = {
      vertexShader: THREE.ShaderLib.points.vertexShader,
      fragmentShader: THREE.ShaderLib.points.fragmentShader,
      uniforms: { ...THREE.ShaderLib.points.uniforms },
    }
    applyNarrativeToPoints(shader, uniforms)
    expect(shader.uniforms.uNarrativeProgress).toBe(uniforms.uNarrativeProgress)
    expect(shader.vertexShader).toContain(
      "mvPosition = narrativeProject(mvPosition, position)"
    )
    expect(shader.fragmentShader).toContain(
      "gl_FragColor.a *= vNarrativeWeight"
    )
  })

  it("builds finite, bounded guides for every chapter", () => {
    for (let chapter = 1; chapter <= 6; chapter++) {
      const geometry = createNarrativeGuide(chapter)
      const positions = geometry.getAttribute("position")
      if (chapter === 1) expect(positions.count).toBe(0)
      else expect(positions.count).toBeGreaterThan(0)
      expect(positions.count % 2).toBe(0)
      for (const value of positions.array) {
        expect(Number.isFinite(value)).toBe(true)
        expect(Math.abs(value)).toBeLessThanOrEqual(3.3)
      }
      geometry.dispose()
    }
  })
})
