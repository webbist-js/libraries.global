import { useFrame } from "@react-three/fiber"
import { useLayoutEffect, useRef, useSyncExternalStore } from "react"
import * as THREE from "three"

import type { GlobeView } from "@/components/home/KnowledgeGlobeCanvas"

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(onChange: () => void) {
  const media = window.matchMedia(REDUCED_MOTION_QUERY)
  media.addEventListener("change", onChange)

  return () => media.removeEventListener("change", onChange)
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function readServerReducedMotion() {
  return false
}

export function useGlobeReducedMotion() {
  return useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    readServerReducedMotion
  )
}

/** A shared animation clock: pausing preserves phase, and resuming never jumps
 * ahead to real time. Keep it separate from the canvas's manual rendering. */
export function useGlobeMotionClock(motionPaused: boolean, active = true) {
  const reducedMotion = useGlobeReducedMotion()
  const paused = motionPaused || reducedMotion
  const time = useRef(0)
  const frameDelta = useRef(0)
  const previousActive = useRef(active)
  const previousPaused = useRef(paused)
  const skipResumedFrame = useRef(false)
  const skipAmbientFrame = useRef(false)
  useLayoutEffect(() => {
    if (previousActive.current !== active) skipResumedFrame.current = true
    if (previousPaused.current && !paused) skipAmbientFrame.current = true
    previousActive.current = active
    previousPaused.current = paused
  }, [active, paused])
  useFrame((_, delta) => {
    frameDelta.current = 0
    if (!active) return
    // A canvas using frameloop="never" stops sampling its R3F clock. Discard
    // the first delta after visibility resumes so it cannot include that gap.
    if (skipResumedFrame.current) {
      skipResumedFrame.current = false

      return
    }
    // Demand rendering can sleep between interactions. Bound that first sample
    // so a deliberate camera or particle transition still has time to play.
    frameDelta.current = Math.min(delta, 0.1)
    if (!paused) {
      if (skipAmbientFrame.current) skipAmbientFrame.current = false
      else time.current += delta
    }
  }, -2)

  return { time, frameDelta, reducedMotion, paused }
}

/** Turn a geographic coordinate forward, then apply the decorative axial tilt.
 * The order matters: applying tilt before latitude would miss the target. */
export function globeViewAdjustment(
  view: GlobeView,
  framing: { pitch: number; yaw: number; tilt: number }
) {
  const opening = new THREE.Quaternion()
    .setFromEuler(
      new THREE.Euler(THREE.MathUtils.degToRad(framing.pitch), 0, framing.tilt)
    )
    .multiply(
      new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        THREE.MathUtils.degToRad(framing.yaw)
      )
    )
  const destination = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      THREE.MathUtils.degToRad(view.lat),
      THREE.MathUtils.degToRad(-view.lng),
      framing.tilt,
      "ZXY"
    )
  )

  return destination.multiply(opening.invert())
}

/** Camera rotation back to the opening azimuth, crossing the shorter arc. */
export function globeHomeAzimuthDelta(azimuth: number) {
  return Math.atan2(Math.sin(-azimuth), Math.cos(-azimuth))
}
