"use client"

import {
  KnowledgeGlobeCanvas,
  type GlobeOverrides,
} from "@/components/home/KnowledgeGlobeCanvas"

// ── Baseline ──────────────────────────────────────────────────────────────
//
// Homepage uses: cameraFov:22, cameraZ:11.6, globeScale:0.76, globeY:-1.25
// EARTH_RADIUS = 3.2, so at those settings the globe (radius 2.43) slightly
// overflows the viewport height — giving the immersive zoomed-in look.
//
// Continent pages use cameraZ:10.2 (slightly closer for more fill) and
// globeScale:0.78 (marginally larger face) so the continent dominates the
// frame. autoRotate, arcs, nodes, library-blob glow, and satellites are
// disabled. The full globe is rendered so the Perlin-noise hotspot wave
// stays active; the rotation simply faces the target continent to camera.

const CONTINENT_BASE: GlobeOverrides = {
  autoRotate: false,
  cameraFov: 22,
  cameraY: 0.06,
  cameraZ: 10.2,
  globeScale: 0.78,
  globeTilt: 0, // disable EARTH_TILT so rotation maths stay clean
  interactive: false,
  showArcs: false,
  showGlow: false, // no library-hub blob highlights on continent pages
  showHotspots: true, // keep Perlin-noise undulating wave animation
  showNodes: false,
  showSatellites: false,
}

// ── Rotation maths ────────────────────────────────────────────────────────
//
// latLngToVector3 formula: x=cos(lat)*sin(lng), y=sin(lat), z=cos(lat)*cos(lng)
// → at lng=0, z is maximal → 0°E naturally faces the camera (+Z).
//
// With globeTilt=0, Three.js XYZ Euler applies in vector order: Rz→Ry→Rx.
// So Ry(yaw) runs before Rx(pitch), giving the clean formulas:
//   globeYaw   = -targetLng  (spins globe until target lng faces +Z)
//   globePitch =  targetLat  (tilts globe until target lat aligns with equator)
//
// globeY shifts the globe vertically so the continent face sits near the
// visual centre of the hero (homepage uses -1.25 for a zoomed-in feel;
// continent pages use shallower offsets).

const CONTINENT_OVERRIDES: Record<string, GlobeOverrides> = {
  europe: {
    ...CONTINENT_BASE,
    // target ~46°N, 10°E — centres on France/Germany/Alps
    globePitch: 46,
    globeY: -0.5,
    globeYaw: -10,
  },
  asia: {
    ...CONTINENT_BASE,
    // target ~28°N, 100°E — centres on China/SE-Asia junction
    globePitch: 28,
    globeY: -0.6,
    globeYaw: -100,
  },
  // "americas" covers both North and South America
  americas: {
    ...CONTINENT_BASE,
    // target ~20°N, 85°W — Central America, balances both continents in view
    globePitch: 20,
    globeY: -0.5,
    globeYaw: 85,
  },
  africa: {
    ...CONTINENT_BASE,
    // target ~2°N, 20°E — equatorial Africa, avoids over-emphasising the Sahara
    globePitch: 2,
    globeY: -0.8,
    globeYaw: -20,
  },
  oceania: {
    ...CONTINENT_BASE,
    // target ~-28°S, 140°E — centres on eastern Australia
    globePitch: -28,
    globeY: -0.7,
    globeYaw: -140,
  },
  antarctica: {
    ...CONTINENT_BASE,
    // target ~-80°S, 0°  → pitch=-80, yaw=0
    globePitch: -80,
    globeY: -0.7,
    globeYaw: 0,
  },
}

export function ContinentGlobeCanvas({
  continentSlug,
  className,
}: {
  readonly continentSlug: string
  readonly className?: string
}) {
  const overrides =
    CONTINENT_OVERRIDES[continentSlug] ?? CONTINENT_OVERRIDES.europe!

  return <KnowledgeGlobeCanvas className={className} overrides={overrides} />
}
