"use client"

import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef, type RefObject } from "react"
import * as THREE from "three"

import {
  createCountryPicker,
  type CountryBoundaries,
} from "@/components/about/about-globe-geography"
import type {
  AboutGlobeCountry,
  GlobeHover,
} from "@/components/about/about-globe.types"
import {
  EARTH_RADIUS,
  buildLibraryArcs,
  latLngToVector3,
  type LibraryMarker,
} from "@/components/home/knowledge-globe-data"

export type GlobeProjectionRefs = {
  ring: RefObject<HTMLDivElement | null>
  tooltip: RefObject<HTMLDivElement | null>
  endpoints: readonly [
    RefObject<HTMLDivElement | null>,
    RefObject<HTMLDivElement | null>,
  ]
  connector: RefObject<SVGPathElement | null>
}

function setConnector(
  path: SVGPathElement | null,
  anchor: { x: number; y: number } | null,
  width: number,
  height: number
) {
  if (!path) return
  path.style.visibility = anchor ? "visible" : "hidden"
  if (!anchor) return
  const right = width - Math.max(24, width * 0.03) - 324
  path.setAttribute(
    "d",
    `M ${anchor.x} ${anchor.y} L ${Math.max(anchor.x + 32, right - 80)} ${anchor.y} L ${right} ${height / 2}`
  )
}

function setPreviewPosition(
  element: HTMLElement | null,
  point: { x: number; y: number },
  width: number,
  height: number
) {
  if (!element) return
  element.style.transform = `translate3d(${Math.max(8, Math.min(point.x + 18, width - 220))}px, ${Math.max(8, Math.min(point.y + 18, height - 112))}px, 0)`
}

/** Geographic picking lives only in About. The empty group inherits the exact
 * transforms of the shared globe, without adding any visible scene geometry. */
export function AboutGlobePickingLayer({
  countries,
  boundaries,
  markers,
  selected,
  hover,
  projections,
  onHover,
  onPin,
  allowRotation,
}: {
  readonly countries: readonly AboutGlobeCountry[]
  readonly boundaries: CountryBoundaries
  readonly markers: readonly LibraryMarker[]
  readonly selected: Extract<GlobeHover, { kind: "country" }> | null
  readonly hover: GlobeHover
  readonly projections: GlobeProjectionRefs
  readonly onHover: (hover: GlobeHover) => void
  readonly allowRotation: boolean
  readonly onPin: (country: Extract<GlobeHover, { kind: "country" }>) => void
}) {
  const group = useRef<THREE.Group>(null)
  const { gl, camera, size, invalidate } = useThree()
  const pickCountry = useMemo(
    () => createCountryPicker(boundaries, countries),
    [boundaries, countries]
  )
  const arcs = useMemo(() => buildLibraryArcs(markers), [markers])
  const latest = useRef({ onHover, onPin })
  useEffect(() => {
    latest.current = { onHover, onPin }
  }, [onHover, onPin])
  const hoverKey = useRef("")
  useEffect(() => {
    if (!hover) hoverKey.current = ""
  }, [hover])
  const canvasElement = useRef(gl.domElement)
  const scratch = useMemo(
    () => ({
      world: new THREE.Vector3(),
      camera: new THREE.Vector3(),
      local: new THREE.Vector3(),
    }),
    []
  )

  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const inverse = new THREE.Matrix4()
    const localRay = new THREE.Ray()
    const sphere = new THREE.Sphere(new THREE.Vector3(), EARTH_RADIUS)
    const surface = new THREE.Vector3()
    const rayPoint = new THREE.Vector3()
    const segmentPoint = new THREE.Vector3()
    let down: { x: number; y: number } | null = null

    const hit = (event: PointerEvent): GlobeHover => {
      const object = group.current
      if (!object) return null
      const rect = canvas.getBoundingClientRect()
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(pointer, camera)
      object.updateWorldMatrix(true, false)
      inverse.copy(object.matrixWorld).invert()
      localRay.copy(raycaster.ray).applyMatrix4(inverse)
      const intersection = localRay.intersectSphere(sphere, surface)
      const surfaceDistance = intersection
        ? localRay.origin.distanceTo(surface)
        : Infinity
      // A consistent seven-pixel hit area around the existing thin arcs.
      const scale = object.getWorldScale(scratch.world).x
      const distance = camera.position.distanceTo(
        object.getWorldPosition(scratch.world)
      )
      const threshold =
        (14 *
          distance *
          Math.tan(
            THREE.MathUtils.degToRad(
              (camera as THREE.PerspectiveCamera).fov / 2
            )
          )) /
        (rect.height * scale)
      let best = threshold * threshold
      let routeIndex = -1
      arcs.forEach((route, index) => {
        if (!route.endpoints?.every((endpoint) => endpoint.name)) return
        for (let i = 1; i < route.linePoints.length; i++) {
          const distanceSq = localRay.distanceSqToSegment(
            route.linePoints[i - 1]!,
            route.linePoints[i]!,
            rayPoint,
            segmentPoint
          )
          if (
            distanceSq < best &&
            localRay.origin.distanceTo(rayPoint) < surfaceDistance + 0.015
          ) {
            best = distanceSq
            routeIndex = index
          }
        }
      })
      if (routeIndex >= 0) {
        const endpoints = arcs[routeIndex]!.endpoints!

        return {
          kind: "connection",
          index: routeIndex,
          names: [endpoints[0].name!, endpoints[1].name!],
        }
      }
      if (!intersection) return null
      const lat = THREE.MathUtils.radToDeg(Math.asin(surface.y / EARTH_RADIUS))
      const lng = THREE.MathUtils.radToDeg(Math.atan2(surface.x, surface.z))
      const country = pickCountry(lat, lng)

      return country ? { kind: "country", country, lat, lng } : null
    }
    const publish = (target: GlobeHover) => {
      const key =
        target?.kind === "country"
          ? target.country.slug
          : target?.kind === "connection"
            ? `arc-${target.index}`
            : ""
      if (key === hoverKey.current) return
      hoverKey.current = key
      latest.current.onHover(target)
      invalidate()
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.buttons || down) {
        publish(null)

        return
      }
      publish(hit(event))
    }
    const leave = () => publish(null)
    const start = (event: PointerEvent) => {
      down = { x: event.clientX, y: event.clientY }
      publish(null)
    }
    const end = (event: PointerEvent) => {
      if (
        down &&
        Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6
      ) {
        const target = hit(event)
        if (target?.kind === "country") latest.current.onPin(target)
      }
      if (
        down &&
        Math.hypot(event.clientX - down.x, event.clientY - down.y) < 6
      )
        publish(hit(event))
      down = null
    }
    const cancel = () => {
      down = null
      publish(null)
    }
    canvas.addEventListener("pointermove", move)
    canvas.addEventListener("pointerleave", leave)
    canvas.addEventListener("pointerdown", start)
    window.addEventListener("pointerup", end)
    window.addEventListener("pointercancel", cancel)

    return () => {
      canvas.removeEventListener("pointermove", move)
      canvas.removeEventListener("pointerleave", leave)
      canvas.removeEventListener("pointerdown", start)
      window.removeEventListener("pointerup", end)
      window.removeEventListener("pointercancel", cancel)
    }
  }, [arcs, camera, gl, invalidate, pickCountry, scratch])

  const projectionRefs = useRef(projections)
  useEffect(() => {
    projectionRefs.current = projections
  }, [projections])

  useFrame(() => {
    const dom = projectionRefs.current
    const touchAction = allowRotation ? "none" : "pan-y"
    if (canvasElement.current.style.touchAction !== touchAction)
      canvasElement.current.style.touchAction = touchAction
    const object = group.current
    if (!object) return
    object.updateWorldMatrix(true, false)
    scratch.camera.copy(camera.position)
    object.worldToLocal(scratch.camera)
    const project = (
      lat: number,
      lng: number,
      element: HTMLElement | null,
      offsetX = 0,
      offsetY = 0
    ) => {
      if (!element) return null
      scratch.local.copy(latLngToVector3(lat, lng))
      const visible =
        scratch.local.dot(scratch.camera) > EARTH_RADIUS * EARTH_RADIUS
      object.localToWorld(scratch.world.copy(scratch.local)).project(camera)
      const x = ((scratch.world.x + 1) * size.width) / 2
      const y = ((1 - scratch.world.y) * size.height) / 2
      element.style.visibility = visible ? "visible" : "hidden"
      element.style.transform = `translate3d(${x + offsetX}px, ${y + offsetY}px, 0)`

      return visible ? { x, y } : null
    }
    const anchor = selected
      ? project(selected.lat, selected.lng, dom.ring.current)
      : null
    setConnector(dom.connector.current, anchor, size.width, size.height)
    if (hover?.kind === "country") {
      // Keep the compact preview inside the canvas at every pointer position.
      const point = project(hover.lat, hover.lng, dom.tooltip.current, 18, 18)
      if (point)
        setPreviewPosition(dom.tooltip.current, point, size.width, size.height)
    }
    if (hover?.kind === "connection") {
      arcs[hover.index]?.endpoints?.forEach((endpoint, index) =>
        project(
          endpoint.lat,
          endpoint.lng,
          dom.endpoints[index]!.current,
          0,
          -16
        )
      )
    }
  })

  return <group ref={group} />
}
