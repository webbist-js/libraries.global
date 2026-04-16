"use client"

/* eslint-disable react/no-unknown-property */

import { OrbitControls, Stars, useTexture } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import * as THREE from "three"

import { createLandDotsGeometry } from "@/components/helpers/globe-geometry"
import {
  HALO_FRAGMENT_SHADER,
  HALO_VERTEX_SHADER,
  HOTSPOT_FRAGMENT_SHADER,
  HOTSPOT_VERTEX_SHADER,
  LAND_DOT_FRAGMENT_SHADER,
  LAND_DOT_VERTEX_SHADER,
  WIREFRAME_FRAGMENT_SHADER,
  WIREFRAME_VERTEX_SHADER,
} from "@/components/helpers/globe-shaders"
import { GLOBE_SETTINGS } from "@/components/home/knowledge-globe-settings"

// ── Types ─────────────────────────────────────────────────────────────────────

export type DrillLevel = "world" | "continent" | "country" | "region"

export interface GlobeDrillState {
  level: DrillLevel
  continent?: {
    slug: string
    name: string
    centroid: { lat: number; lng: number }
  }
  country?: {
    slug: string
    name: string
    centroid: { lat: number; lng: number }
  }
  region?: {
    slug: string
    name: string
    centroid: { lat: number; lng: number }
  }
}

export interface MapGlobeProps {
  drillState: GlobeDrillState
  onDrillChange: (state: GlobeDrillState) => void
  onFirstInteraction?: () => void
  onLoadingChange?: (loading: boolean, message?: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const RADIUS = 1.8
const DOT_SIZE = GLOBE_SETTINGS.landDotSize

// The map camera sits at RADIUS*2.5; dots at the globe surface are ~2.7 world-units
// away. The homepage camera sits at z=11.6 with EARTH_RADIUS=3.2, giving ~8.4 units.
// The LAND_DOT shader uses (122/-mvPos.z) for perspective, so without compensation
// map dots render 8.4/2.7 ≈ 3.1× larger than homepage dots. This factor scales
// uSizeScale down so apparent dot size matches the homepage exactly.
const MAP_DOT_SCALE = (RADIUS * 1.5) / (GLOBE_SETTINGS.cameraZ - 3.2) // ≈ 0.32

const _CONTINENTS = ["africa", "americas", "asia", "europe", "oceania"] as const
type ContinentSlug = (typeof _CONTINENTS)[number]

const CONTINENT_CENTROIDS: Record<ContinentSlug, { lat: number; lng: number }> =
  {
    africa: { lat: 2, lng: 20 },
    americas: { lat: 8, lng: -78 },
    asia: { lat: 38, lng: 88 },
    europe: { lat: 52, lng: 15 },
    oceania: { lat: -22, lng: 133 },
  }

const CAMERA_DISTANCE: Record<DrillLevel, number> = {
  world: RADIUS * 2.5,
  continent: RADIUS * 1.88,
  country: RADIUS * 1.54,
  region: RADIUS * 1.36,
}

// Region marker shader — fixed pixel size to avoid explosion when zoomed
const REGION_MARKER_VERT = `
  uniform float uTime;
  uniform float uOpacity;
  varying float vPulse;
  varying float vOpacity;

  void main() {
    float pulse = 0.90 + 0.10 * sin(uTime * 2.2 + position.x * 10.0 + position.z * 10.0);
    vPulse   = pulse;
    vOpacity = uOpacity;

    vec3 dir = normalize(position);
    vec3 pos = position + dir * 0.014;
    vec4 mv  = modelViewMatrix * vec4(pos, 1.0);
    // Fixed size — clamp avoids explosion at close zoom
    gl_PointSize = clamp(pulse * (120.0 / -mv.z), 6.0, 14.0);
    gl_Position  = projectionMatrix * mv;
  }
`

const REGION_MARKER_FRAG = `
  uniform vec3 uColor;
  varying float vPulse;
  varying float vOpacity;

  void main() {
    float d    = distance(gl_PointCoord, vec2(0.5));
    float halo = smoothstep(0.5, 0.12, d);
    float core = smoothstep(0.18, 0.0, d);
    float alpha = (halo * 0.18 + core * 0.9) * vOpacity * vPulse;
    if (alpha < 0.01) discard;
    vec3 col = mix(uColor, vec3(1.0), core * 0.5);
    gl_FragColor = vec4(col, alpha);
  }
`

// ── Geometry helpers ──────────────────────────────────────────────────────────

// Same formula as knowledge-globe-data.ts latLngToVector3 and globe-geometry.ts —
// keeping all coordinate systems consistent so dots, outlines and camera align.
export function latLngToVec3(
  lat: number,
  lng: number,
  r: number
): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat)
  const lngRad = THREE.MathUtils.degToRad(lng)
  const cosLat = Math.cos(latRad)

  return new THREE.Vector3(
    cosLat * Math.sin(lngRad) * r,
    Math.sin(latRad) * r,
    cosLat * Math.cos(lngRad) * r
  )
}

function buildOutlineGeo(
  rings: [number, number][][],
  radius: number
): THREE.BufferGeometry {
  const positions: number[] = []
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i]!,
        b = ring[i + 1]!
      const va = latLngToVec3(a[1], a[0], radius + 0.005)
      const vb = latLngToVec3(b[1], b[0], radius + 0.005)
      positions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))

  return geo
}

function computeRingCentroid(ring: [number, number][]): {
  lat: number
  lng: number
} {
  if (!ring.length) return { lat: 0, lng: 0 }
  let sl = 0,
    sg = 0
  for (const [lng, lat] of ring) {
    sl += lat
    sg += lng
  }

  return { lat: sl / ring.length, lng: sg / ring.length }
}

// Filters rings to those whose centroid is within `threshold` degrees of a
// reference centroid. Used to exclude distant overseas territories (e.g. French
// Guiana, Martinique) from France's continent/country outline and neon highlight
// while keeping nearby territories (Corsica, Azores, Canary Islands, etc.).
function filterNearbyRings(
  rings: [number, number][][],
  centroid: { lat: number; lng: number },
  threshold = 25
): [number, number][][] {
  if (rings.length <= 1) return rings

  return rings.filter((ring) => {
    const c = computeRingCentroid(ring)

    return (
      Math.abs(c.lat - centroid.lat) < threshold &&
      Math.abs(c.lng - centroid.lng) < threshold
    )
  })
}

function pointInRing(
  lng: number,
  lat: number,
  ring: [number, number][]
): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!,
      [xj, yj] = ring[j]!
    if (
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      inside = !inside
  }

  return inside
}

// ── GeoJSON types ─────────────────────────────────────────────────────────────

interface ContinentFeature {
  slug: string
  name: string
  rings: [number, number][][]
}
interface CountryFeature {
  slug: string
  name: string
  rings: [number, number][][]
  centroid: { lat: number; lng: number }
}
interface RegionMarker {
  slug: string
  name: string
  lat: number
  lng: number
}

// ── Camera target ─────────────────────────────────────────────────────────────

function computeCameraTarget(state: GlobeDrillState): THREE.Vector3 {
  let lat = 0,
    lng = 0
  const e = state.region ?? state.country ?? state.continent
  if (e) {
    lat = e.centroid.lat
    lng = e.centroid.lng
  }

  return latLngToVec3(lat, lng, CAMERA_DISTANCE[state.level])
}

// ── GlobeScene ────────────────────────────────────────────────────────────────

function GlobeScene({
  drillState,
  onDrillChange,
  onFirstInteraction,
  continentFeatures,
  countryFeatures,
  regionMarkers,
}: {
  drillState: GlobeDrillState
  onDrillChange: (s: GlobeDrillState) => void
  onFirstInteraction?: () => void
  continentFeatures: ContinentFeature[]
  countryFeatures: CountryFeature[]
  regionMarkers: RegionMarker[]
}) {
  const { gl, camera } = useThree()
  const maskTexture = useTexture(
    "/images/globe/earth-specular.jpg"
  ) as THREE.Texture
  // Atmosphere uniforms matching KnowledgeGlobeCanvas
  const rimUniforms = useMemo(
    () => ({
      uC: { value: 0.64 },
      uP: { value: 7 },
      uColor: { value: new THREE.Color("#7ec8f0") },
      uOpacity: { value: 0.38 },
    }),
    []
  )

  const haloUniforms = useMemo(
    () => ({
      uC: { value: 0.68 },
      uP: { value: 4.5 },
      uColor: { value: new THREE.Color("#112040") },
      uOpacity: { value: 0.22 },
    }),
    []
  )

  const image =
    maskTexture.image instanceof HTMLImageElement ? maskTexture.image : null

  // ── Dot geometry ───────────────────────────────────────────────────────────

  const worldDotsGeo = useMemo(
    () =>
      createLandDotsGeometry({
        maskImage: image,
        radius: RADIUS,
        density: GLOBE_SETTINGS.landDotDensity, // match homepage density (0.65)
        activitySources: [],
      }),
    [image]
  )

  // Noise layer — same geometry seeded with no activity sources so Perlin noise
  // animates all dots uniformly (matching the homepage globe's breathing effect)
  const noiseDotGeo = useMemo(
    () =>
      createLandDotsGeometry({
        maskImage: image,
        radius: RADIUS,
        density: GLOBE_SETTINGS.landDotDensity,
        activitySources: [],
      }),
    [image]
  )

  // ── Materials ──────────────────────────────────────────────────────────────

  const worldDotMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: LAND_DOT_VERTEX_SHADER,
        fragmentShader: LAND_DOT_FRAGMENT_SHADER,
        uniforms: {
          uBaseColor: { value: new THREE.Color("#c3d8ee") },
          uHighlightColor: { value: new THREE.Color("#f7fbff") },
          uSizeScale: { value: DOT_SIZE * 1.04 * MAP_DOT_SCALE },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  )

  // HOTSPOT — Perlin-noise animated shimmer matching the homepage hero globe
  const noiseDotMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HOTSPOT_VERTEX_SHADER,
        fragmentShader: HOTSPOT_FRAGMENT_SHADER,
        uniforms: {
          uTime: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      }),
    []
  )

  // ── Continent outlines ─────────────────────────────────────────────────────

  const contOutlinePairs = useMemo(() => {
    if (!continentFeatures.length) return []

    return continentFeatures.map((f) => ({
      slug: f.slug,
      geo: buildOutlineGeo(f.rings, RADIUS),
      mat: new THREE.LineBasicMaterial({
        color: "#22d3ee",
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    }))
  }, [continentFeatures])

  const contOutlineMatMap = useMemo(() => {
    const m = new Map<string, THREE.LineBasicMaterial>()
    contOutlinePairs.forEach(({ slug, mat }) => m.set(slug, mat))

    return m
  }, [contOutlinePairs])

  // Pre-built line geometries for continent hover (5 total — cheap)
  const contLineGeoMap = useMemo(() => {
    const m = new Map<string, THREE.BufferGeometry>()
    for (const f of continentFeatures) {
      m.set(f.slug, buildOutlineGeo(f.rings, RADIUS + 0.01))
    }

    return m
  }, [continentFeatures])

  const contLineGeoMapRef = useRef(contLineGeoMap)
  contLineGeoMapRef.current = contLineGeoMap

  // Lazy cache for country hover line geometries (built on first hover)
  const countryLineGeoCache = useRef(new Map<string, THREE.BufferGeometry>())

  // ── Country outlines ───────────────────────────────────────────────────────

  const countryOutlinePairs = useMemo(() => {
    if (!countryFeatures.length) return []

    return countryFeatures.map((f) => ({
      slug: f.slug,
      name: f.name,
      // Only draw rings near the country's representative centroid — excludes
      // overseas territories (French Guiana, Martinique, etc.) from the globe outline.
      geo: buildOutlineGeo(filterNearbyRings(f.rings, f.centroid), RADIUS),
      mat: new THREE.LineBasicMaterial({
        color: "#1e4d6b",
        transparent: true,
        opacity: 0.3,
        depthWrite: false,
      }),
    }))
  }, [countryFeatures])

  const countryOutlineMatMap = useMemo(() => {
    const m = new Map<string, THREE.LineBasicMaterial>()
    countryOutlinePairs.forEach(({ slug, mat }) => m.set(slug, mat))

    return m
  }, [countryOutlinePairs])

  // ── Selected entity neon outline (sphere billboards) ───────────────────────

  const selectedRings = useMemo((): [number, number][][] => {
    if (drillState.level === "continent") {
      return (
        continentFeatures.find((f) => f.slug === drillState.continent?.slug)
          ?.rings ?? []
      )
    }
    if (drillState.level === "country" || drillState.level === "region") {
      const feat = countryFeatures.find(
        (f) => f.slug === drillState.country?.slug
      )
      if (!feat) return []

      // Only highlight rings near the mainland centroid — overseas territories (French
      // Guiana, Martinique, Réunion, etc.) are excluded from the neon highlight.
      return filterNearbyRings(feat.rings, feat.centroid)
    }

    return []
  }, [drillState, continentFeatures, countryFeatures])

  // Solid line geometry — slightly raised above the globe to avoid z-fighting
  const neonOutlineGeo = useMemo(
    () =>
      selectedRings.length
        ? buildOutlineGeo(selectedRings, RADIUS + 0.01)
        : null,
    [selectedRings]
  )

  // Bright white line — Bloom provides the glow; opacity animated from 0→1 in useFrame
  const neonOutlineMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#e8f4ff",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  )

  // Hover line — cyan tint to distinguish from the selected (white) outline
  const hoverNeonMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#7dd3fc",
        transparent: true,
        opacity: 0,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  )

  const emptyGeo = useMemo(() => new THREE.BufferGeometry(), [])

  // ── Region markers ─────────────────────────────────────────────────────────

  const regionMarkerGeo = useMemo(() => {
    if (!regionMarkers.length) return null
    const positions: number[] = []
    for (const r of regionMarkers) {
      const v = latLngToVec3(r.lat, r.lng, RADIUS + 0.012)
      positions.push(v.x, v.y, v.z)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(new Float32Array(positions), 3)
    )

    return geo
  }, [regionMarkers])

  const regionMarkerMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: REGION_MARKER_VERT,
        fragmentShader: REGION_MARKER_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
          uColor: { value: new THREE.Color("#38bdf8") },
        },
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
    []
  )

  // ── Hit sphere ────────────────────────────────────────────────────────────

  const hitSphere = useMemo(
    () =>
      new THREE.Mesh(
        new THREE.SphereGeometry(RADIUS, 32, 32),
        new THREE.MeshBasicMaterial({ visible: false })
      ),
    []
  )

  // ── Refs ──────────────────────────────────────────────────────────────────

  const worldDotRef = useRef<THREE.Points>(null)
  const noiseDotRef = useRef<THREE.Points>(null)
  const neonRef = useRef<THREE.LineSegments>(null)
  const hoverNeonRef = useRef<THREE.LineSegments>(null)
  const regionRef = useRef<THREE.Points>(null)
  const controlsRef = useRef<any>(null)

  const hoveredContRef = useRef<string | null>(null)
  const hoveredCountryRef = useRef<string | null>(null)
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const interactedRef = useRef(false)
  const onFirstInterRef = useRef(onFirstInteraction)
  onFirstInterRef.current = onFirstInteraction

  // Smooth opacity state
  const neonOpacity = useRef(0)
  const hoverNeonOpacity = useRef(0)
  const hoverNeonTarget = useRef(0)
  const regionOpacity = useRef(0)
  const globalDimming = useRef(1) // 1.0 = world view, 0.4ish = drilled

  // Camera animation
  const targetCamPos = useRef(new THREE.Vector3(0, 0, RADIUS * 2.5))
  const isAnimating = useRef(false)

  // Detect drill state change → start camera animation
  // isInitialized guard prevents false-trigger on first render
  const drillKey = `${drillState.level}|${drillState.continent?.slug ?? ""}|${drillState.country?.slug ?? ""}|${drillState.region?.slug ?? ""}`
  const prevDrillKey = useRef("")
  const isInitialized = useRef(false)
  if (!isInitialized.current) {
    isInitialized.current = true
    prevDrillKey.current = drillKey
    // No animation on mount — OrbitControls stays enabled
  } else if (prevDrillKey.current !== drillKey) {
    prevDrillKey.current = drillKey
    targetCamPos.current.copy(computeCameraTarget(drillState))
    isAnimating.current = true
    if (controlsRef.current) controlsRef.current.enabled = false
    // Reset hover neon when changing drill level
    hoverNeonTarget.current = 0
    hoveredContRef.current = null
    hoveredCountryRef.current = null
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────

  useFrame(({ clock }) => {
    const t = clock.elapsedTime

    // Time uniforms for animated layers
    const setT = (r: React.RefObject<THREE.Points | null>) => {
      const p = r.current
      if (p) {
        const m = p.material as THREE.ShaderMaterial
        if (m.uniforms.uTime) m.uniforms.uTime.value = t
      }
    }
    setT(noiseDotRef)
    setT(regionRef)

    // Opacity transitions
    const lerp = THREE.MathUtils.lerp
    const targetNeon =
      drillState.level === "continent" ||
      drillState.level === "country" ||
      drillState.level === "region"
        ? 1
        : 0
    const targetRegion =
      drillState.level === "country" || drillState.level === "region" ? 0.95 : 0
    const targetDim = drillState.level === "world" ? 1 : 0.54

    neonOpacity.current = lerp(neonOpacity.current, targetNeon, 0.04)
    hoverNeonOpacity.current = lerp(
      hoverNeonOpacity.current,
      hoverNeonTarget.current,
      0.08
    )
    regionOpacity.current = lerp(regionOpacity.current, targetRegion, 0.04)
    globalDimming.current = lerp(globalDimming.current, targetDim, 0.04)

    if (neonRef.current)
      (neonRef.current.material as THREE.LineBasicMaterial).opacity =
        neonOpacity.current
    if (hoverNeonRef.current)
      (hoverNeonRef.current.material as THREE.LineBasicMaterial).opacity =
        hoverNeonOpacity.current
    if (regionRef.current)
      (
        regionRef.current.material as THREE.ShaderMaterial
      ).uniforms.uOpacity!.value = regionOpacity.current

    // Apply global dimming to base layers (MAP_DOT_SCALE compensates for closer camera)
    if (worldDotRef.current)
      (
        worldDotRef.current.material as THREE.ShaderMaterial
      ).uniforms.uSizeScale!.value =
        DOT_SIZE * 1.04 * MAP_DOT_SCALE * (0.6 + 0.4 * globalDimming.current)

    // Camera animation
    if (isAnimating.current) {
      camera.position.lerp(targetCamPos.current, 0.046)
      camera.lookAt(0, 0, 0)
      camera.up.set(0, 1, 0)
      if (camera.position.distanceTo(targetCamPos.current) < 0.007) {
        isAnimating.current = false
        if (controlsRef.current) {
          controlsRef.current.enabled = true
          controlsRef.current.update()
        }
      }
    }
  })

  // Update continent/country outline visuals on drill state change
  useEffect(() => {
    const selectedCountry = drillState.country?.slug

    contOutlineMatMap.forEach((mat, slug) => {
      if (drillState.level === "world") {
        mat.color.set("#22d3ee")
        mat.opacity = 0.25
      } else {
        // Neon handles the selection highlight — keep the line at the same dim opacity
        // as non-selected continents so it doesn't create a double-outline
        mat.color.set("#22d3ee")
        mat.opacity = 0.06
      }
    })

    countryOutlineMatMap.forEach((mat, slug) => {
      if (slug === selectedCountry) {
        // Neon handles the selection highlight — line stays dim to avoid double-outline
        mat.color.set("#1e4d6b")
        mat.opacity = 0.15
      } else {
        mat.color.set("#1e4d6b")
        mat.opacity = 0.22
      }
    })
  }, [drillState, contOutlineMatMap, countryOutlineMatMap])

  // ── Interaction ───────────────────────────────────────────────────────────

  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const ndcVec = useMemo(() => new THREE.Vector2(), [])
  const drillRef = useRef(drillState)
  const onChangeRef = useRef(onDrillChange)
  const contFeatRef = useRef(continentFeatures)
  const countryFeatRef = useRef(countryFeatures)
  const regionRef2 = useRef(regionMarkers)
  drillRef.current = drillState
  onChangeRef.current = onDrillChange
  contFeatRef.current = continentFeatures
  countryFeatRef.current = countryFeatures
  regionRef2.current = regionMarkers

  function applyContHover(slug: string | null) {
    if (slug === hoveredContRef.current) return
    hoveredContRef.current = slug
    // Only adjust line opacities at world level — at drilled levels, line mats are
    // managed by the drill-state useEffect and we don't want to clobber them.
    if (drillRef.current.level === "world") {
      contOutlineMatMap.forEach((mat, s) => {
        mat.opacity = s === slug ? 0.9 : 0.25
      })
    }
    gl.domElement.style.cursor = slug ? "pointer" : "grab"
    // Show hover line for the hovered continent
    if (hoverNeonRef.current) {
      if (slug) {
        const geo = contLineGeoMapRef.current.get(slug)
        if (geo) hoverNeonRef.current.geometry = geo
        hoverNeonTarget.current = 1
      } else {
        hoverNeonTarget.current = 0
      }
    }
  }

  function applyCountryHover(slug: string | null) {
    if (slug === hoveredCountryRef.current) return
    hoveredCountryRef.current = slug
    const selectedSlug = drillRef.current.country?.slug
    countryOutlineMatMap.forEach((mat, s) => {
      if (s === selectedSlug) {
        mat.color.set("#1e4d6b")
        mat.opacity = 0.15
      } else if (s === slug) {
        mat.color.set("#7dd3fc")
        mat.opacity = 0.75
      } else {
        mat.color.set("#1e4d6b")
        mat.opacity = 0.22
      }
    })
    gl.domElement.style.cursor = slug ? "pointer" : "grab"
    // Show hover line for the hovered country (built lazily and cached)
    if (hoverNeonRef.current) {
      if (slug) {
        let geo = countryLineGeoCache.current.get(slug)
        if (!geo) {
          const feat = countryFeatRef.current.find((f) => f.slug === slug)
          if (feat) {
            geo = buildOutlineGeo(
              filterNearbyRings(feat.rings, feat.centroid),
              RADIUS + 0.01
            )
            countryLineGeoCache.current.set(slug, geo)
          }
        }
        if (geo) {
          hoverNeonRef.current.geometry = geo
          hoverNeonTarget.current = 1
        }
      } else {
        hoverNeonTarget.current = 0
      }
    }
  }

  function markInteracted() {
    if (!interactedRef.current) {
      interactedRef.current = true
      onFirstInterRef.current?.()
    }
  }

  useEffect(() => {
    const el = gl.domElement

    function hitLatLng(e: PointerEvent): { lat: number; lng: number } | null {
      const rect = el.getBoundingClientRect()
      ndcVec.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1)
      )
      raycaster.setFromCamera(ndcVec, camera)
      const hit = raycaster.intersectObject(hitSphere)[0]
      if (!hit) return null
      const n = hit.point.clone().normalize()
      const lat = Math.asin(Math.max(-1, Math.min(1, n.y))) * (180 / Math.PI)
      // Inverse of latLngToVec3: x = cos*sin(lng), z = cos*cos(lng) → atan2(x, z) = lng
      let lng = Math.atan2(n.x, n.z) * (180 / Math.PI)
      if (lng < -180) lng += 360

      return { lat, lng }
    }

    function onMove(e: PointerEvent) {
      if (isAnimating.current) return
      const hit = getHit(e)
      if (!hit) {
        applyContHover(null)
        applyCountryHover(null)

        return
      }

      const level = drillRef.current.level
      if (level === "world") {
        let c: string | null = null
        for (const f of contFeatRef.current)
          for (const ring of f.rings)
            if (pointInRing(hit.lng, hit.lat, ring)) {
              c = f.slug
              break
            }
        applyContHover(c)
      } else {
        // Detect country hover first
        let country: string | null = null
        for (const f of countryFeatRef.current)
          for (const ring of f.rings)
            if (pointInRing(hit.lng, hit.lat, ring)) {
              country = f.slug
              break
            }
        applyCountryHover(country)

        // Also detect continent hover when the cursor is over a different continent —
        // allows the user to see the hover neon and know they can click to navigate there.
        if (!country) {
          let cont: string | null = null
          for (const f of contFeatRef.current)
            for (const ring of f.rings)
              if (pointInRing(hit.lng, hit.lat, ring)) {
                cont = f.slug
                break
              }
          applyContHover(
            cont !== drillRef.current.continent?.slug ? cont : null
          )
        } else {
          applyContHover(null)
        }
      }
    }

    function getHit(e: PointerEvent) {
      return hitLatLng(e)
    }

    function onDown(e: PointerEvent) {
      pointerDownPos.current = { x: e.clientX, y: e.clientY }
      markInteracted()
    }

    function onUp(e: PointerEvent) {
      if (!pointerDownPos.current) return
      const dx = e.clientX - pointerDownPos.current.x
      const dy = e.clientY - pointerDownPos.current.y
      pointerDownPos.current = null
      if (Math.hypot(dx, dy) >= 6) return

      const hit = hitLatLng(e)
      if (!hit) return
      const level = drillRef.current.level

      // Helper: navigate to a continent (shared across levels)
      function drillToCont(f: ContinentFeature) {
        const slug = f.slug as ContinentSlug
        onChangeRef.current({
          level: "continent",
          continent: {
            slug,
            name: f.name,
            centroid: CONTINENT_CENTROIDS[slug] ?? { lat: 0, lng: 0 },
          },
        })
      }

      switch (level) {
        case "world": {
          let clicked: ContinentFeature | null = null
          for (const f of contFeatRef.current)
            for (const ring of f.rings)
              if (pointInRing(hit.lng, hit.lat, ring)) {
                clicked = f
                break
              }
          if (clicked) drillToCont(clicked)

          break
        }
        case "continent": {
          // Priority 1: country inside the current or any continent
          let clickedCountry: CountryFeature | null = null
          for (const f of countryFeatRef.current)
            for (const ring of f.rings)
              if (pointInRing(hit.lng, hit.lat, ring)) {
                clickedCountry = f
                break
              }
          if (clickedCountry) {
            onChangeRef.current({
              ...drillRef.current,
              level: "country",
              country: {
                slug: clickedCountry.slug,
                name: clickedCountry.name,
                centroid: clickedCountry.centroid,
              },
            })

            return
          }
          // Priority 2: clicked a different continent → navigate there
          let clickedCont: ContinentFeature | null = null
          for (const f of contFeatRef.current)
            for (const ring of f.rings)
              if (pointInRing(hit.lng, hit.lat, ring)) {
                clickedCont = f
                break
              }
          if (
            clickedCont &&
            clickedCont.slug !== drillRef.current.continent?.slug
          )
            drillToCont(clickedCont)

          break
        }
        case "country":
        case "region": {
          // Priority 1: region marker (tight threshold)
          const hitVec = latLngToVec3(hit.lat, hit.lng, 1).normalize()
          let closest: RegionMarker | null = null,
            closestD = 0.05
          for (const r of regionRef2.current) {
            const rv = latLngToVec3(r.lat, r.lng, 1).normalize()
            const d = hitVec.distanceTo(rv)
            if (d < closestD) {
              closestD = d
              closest = r
            }
          }
          if (closest) {
            onChangeRef.current({
              ...drillRef.current,
              level: "region",
              region: {
                slug: closest.slug,
                name: closest.name,
                centroid: { lat: closest.lat, lng: closest.lng },
              },
            })

            return
          }
          // Priority 2: any country (including a different country)
          let clickedCountry: CountryFeature | null = null
          for (const f of countryFeatRef.current)
            for (const ring of f.rings)
              if (pointInRing(hit.lng, hit.lat, ring)) {
                clickedCountry = f
                break
              }
          if (
            clickedCountry &&
            clickedCountry.slug !== drillRef.current.country?.slug
          ) {
            onChangeRef.current({
              ...drillRef.current,
              level: "country",
              country: {
                slug: clickedCountry.slug,
                name: clickedCountry.name,
                centroid: clickedCountry.centroid,
              },
              region: undefined,
            })

            return
          }
          // Priority 3: clicked a different continent → navigate there
          let clickedCont: ContinentFeature | null = null
          for (const f of contFeatRef.current)
            for (const ring of f.rings)
              if (pointInRing(hit.lng, hit.lat, ring)) {
                clickedCont = f
                break
              }
          if (
            clickedCont &&
            clickedCont.slug !== drillRef.current.continent?.slug
          )
            drillToCont(clickedCont)

          break
        }
        // No default
      }
    }

    function onLeave() {
      applyContHover(null)
      applyCountryHover(null)
    }

    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerdown", onDown)
    el.addEventListener("pointerup", onUp)
    el.addEventListener("pointerleave", onLeave)

    return () => {
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerdown", onDown)
      el.removeEventListener("pointerup", onUp)
      el.removeEventListener("pointerleave", onLeave)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl.domElement, hitSphere, contOutlineMatMap, countryOutlineMatMap])

  // ── Render ────────────────────────────────────────────────────────────────

  const isZoomed = drillState.level !== "world"

  return (
    <>
      {/* Starfield — 3 layers matching homepage */}
      <Stars
        count={4000}
        depth={48}
        factor={0.5}
        radius={80}
        saturation={0}
        speed={0}
      />
      <Stars
        count={2000}
        depth={72}
        factor={1}
        radius={120}
        saturation={0}
        speed={0}
      />
      <Stars
        count={800}
        depth={120}
        factor={2}
        radius={200}
        saturation={0}
        speed={0}
      />

      {/* Lighting — matching homepage */}
      <ambientLight intensity={0.28} />
      <hemisphereLight
        color="#eef8ff"
        groundColor="#050814"
        intensity={0.28 * 1.46}
      />
      <directionalLight color="#f4fbff" intensity={0.76} position={[5, 4, 8]} />
      <pointLight color="#6fa6ff" intensity={3.6} position={[-7, -2, -10]} />

      {/* Hit-test sphere */}
      <primitive object={hitSphere} />

      {/* ── Globe shell (identical to homepage GlobeShell) ──────────────────── */}
      <mesh>
        <sphereGeometry args={[RADIUS - 0.02, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Wireframe — same shader and segments as homepage; Bloom provides the boost */}
      <mesh>
        <sphereGeometry args={[RADIUS - 0.012, 96, 96]} />
        <shaderMaterial
          vertexShader={WIREFRAME_VERTEX_SHADER}
          fragmentShader={WIREFRAME_FRAGMENT_SHADER}
          transparent
          wireframe
        />
      </mesh>

      {/* Inner rim — tight Fresnel glow at the globe edge */}
      <mesh scale={1.014}>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={HALO_FRAGMENT_SHADER}
          side={THREE.BackSide}
          toneMapped={false}
          transparent
          uniforms={rimUniforms}
          vertexShader={HALO_VERTEX_SHADER}
        />
      </mesh>

      {/* Outer halo — soft ambient glow just beyond the rim */}
      <mesh scale={1.08}>
        <sphereGeometry args={[RADIUS, 64, 64]} />
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={HALO_FRAGMENT_SHADER}
          side={THREE.BackSide}
          toneMapped={false}
          transparent
          uniforms={haloUniforms}
          vertexShader={HALO_VERTEX_SHADER}
        />
      </mesh>

      {/* ── Land Layers ── */}
      <points
        geometry={worldDotsGeo}
        material={worldDotMat}
        ref={worldDotRef}
      />
      {/* Perlin-noise animated shimmer layer — same visual as homepage hero */}
      <points geometry={noiseDotGeo} material={noiseDotMat} ref={noiseDotRef} />

      {/* ── Continent outlines ─────────────────────────────────────────────── */}
      {contOutlinePairs.map(({ slug, geo, mat }) => {
        // Once country outlines are loaded, hide the selected continent's low-res outline
        // to avoid the jagged low-fidelity polygon showing through the high-res one
        const countryOutlinesReady = countryFeatures.length > 0
        const isSelectedContinent = slug === drillState.continent?.slug
        if (countryOutlinesReady && isSelectedContinent) return null

        return <lineSegments key={slug} geometry={geo} material={mat} />
      })}

      {/* ── Country outlines (visible when zoomed into a continent) ──────── */}
      {isZoomed &&
        countryOutlinePairs.map(({ slug, geo, mat }) => (
          <lineSegments key={slug} geometry={geo} material={mat} />
        ))}

      {/* ── Solid line outline for selected entity (Bloom provides the glow) ── */}
      {neonOutlineGeo && (
        <lineSegments
          ref={neonRef}
          geometry={neonOutlineGeo}
          material={neonOutlineMat}
        />
      )}

      {/* ── Hover line — cyan solid outline for hovered continent/country ───── */}
      <lineSegments
        ref={hoverNeonRef}
        geometry={emptyGeo}
        material={hoverNeonMat}
      />

      {/* ── Region markers ─────────────────────────────────────────────────── */}
      {regionMarkerGeo && (
        <points
          ref={regionRef}
          geometry={regionMarkerGeo}
          material={regionMarkerMat}
        />
      )}

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom
        minDistance={RADIUS * 1.32}
        maxDistance={RADIUS * 3.5}
        autoRotate={drillState.level === "world"}
        autoRotateSpeed={0.1}
        rotateSpeed={0.34}
        zoomSpeed={0.7}
        dampingFactor={0.08}
        enableDamping
      />

      {/* Bloom — reduced vs homepage (no arcs/nodes to balance); still boosts wireframe and neon */}
      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          intensity={0.9}
          luminanceSmoothing={0.76}
          luminanceThreshold={0.18}
          mipmapBlur
          radius={0.78}
        />
      </EffectComposer>
    </>
  )
}

// ── Public MapGlobe ───────────────────────────────────────────────────────────

export default function MapGlobe({
  drillState,
  onDrillChange,
  onFirstInteraction,
  onLoadingChange,
}: MapGlobeProps) {
  const [continentFeatures, setContinentFeatures] = useState<
    ContinentFeature[]
  >([])
  const [countryFeatures, setCountryFeatures] = useState<CountryFeature[]>([])
  const [regionMarkers, setRegionMarkers] = useState<RegionMarker[]>([])

  useEffect(() => {
    onLoadingChange?.(true, "Loading globe…")
    fetch("/boundaries/world-continents.geojson")
      .then((r) => r.json())
      .then((gj: GeoJSON.FeatureCollection) => {
        const parsed: ContinentFeature[] = gj.features
          .filter(
            (f): f is GeoJSON.Feature<GeoJSON.MultiPolygon | GeoJSON.Polygon> =>
              f.geometry?.type === "MultiPolygon" ||
              f.geometry?.type === "Polygon"
          )
          .map((f) => ({
            slug: f.properties?.slug as string,
            name: f.properties?.name as string,
            rings:
              f.geometry.type === "MultiPolygon"
                ? (f.geometry.coordinates.map((p) => p[0]) as [
                    number,
                    number,
                  ][][])
                : [f.geometry.coordinates[0] as [number, number][]],
          }))
        setContinentFeatures(parsed)
      })
      .catch(console.error)
      .finally(() => onLoadingChange?.(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!drillState.continent) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountryFeatures([])

      return
    }
    const slug = drillState.continent.slug
    onLoadingChange?.(true, `Loading ${drillState.continent.name}…`)

    // Some continents need supplemental country GeoJSON files.
    // Europe excludes the UK at the continent level (europe.geojson has no GB features)
    // so we fetch countries/uk.geojson separately to include England/Scotland/Wales/NI.
    const SUPPLEMENTAL: Partial<Record<string, string[]>> = {
      europe: ["/boundaries/countries/uk.geojson"],
    }
    const extra = SUPPLEMENTAL[slug] ?? []

    Promise.all([
      fetch(`/boundaries/continents/${slug}.geojson`).then((r) => {
        if (!r.ok) throw new Error("Failed to load boundaries")

        return r.json() as Promise<GeoJSON.FeatureCollection>
      }),
      ...extra.map((url) =>
        fetch(url)
          .then((r) =>
            r.ok
              ? (r.json() as Promise<GeoJSON.FeatureCollection>)
              : { features: [] as GeoJSON.Feature[] }
          )
          .catch(() => ({ features: [] as GeoJSON.Feature[] }))
      ),
    ])
      .then(([mainGj, ...suppGjs]) => {
        const allFeatures = [
          ...(mainGj.features ?? []),
          ...suppGjs.flatMap(
            (gj) => (gj as GeoJSON.FeatureCollection).features ?? []
          ),
        ]
        const parsed: CountryFeature[] = allFeatures
          .filter(
            (f): f is GeoJSON.Feature<GeoJSON.MultiPolygon | GeoJSON.Polygon> =>
              f.geometry?.type === "MultiPolygon" ||
              f.geometry?.type === "Polygon"
          )
          .map((f) => {
            const rings: [number, number][][] =
              f.geometry.type === "MultiPolygon"
                ? (f.geometry.coordinates.map((p) => p[0]) as [
                    number,
                    number,
                  ][][])
                : [f.geometry.coordinates[0] as [number, number][]]
            // For countries with overseas territories (France, Portugal, etc.),
            // rings[0] may be a small island or distant territory, not the mainland.
            // Pick the ring with the most vertices — it's almost always the mainland
            // polygon, which has by far the most complex boundary.
            const mainRing = rings.reduce(
              (best, r) => (r.length > best.length ? r : best),
              rings[0] ?? []
            )

            return {
              slug: f.properties?.slug as string,
              name: f.properties?.name as string,
              rings,
              centroid: computeRingCentroid(mainRing),
            }
          })
        setCountryFeatures(parsed)
      })
      .catch(() => setCountryFeatures([]))
      .finally(() => onLoadingChange?.(false))
  }, [drillState.continent?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Always clear immediately so stale markers from a previous country never show
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRegionMarkers([])
    if (!drillState.country) return
    onLoadingChange?.(true, `Loading regions…`)
    fetch(
      `/api/public-proxy/api/regions/map-pins?countrySlug=${encodeURIComponent(drillState.country.slug)}&status=published`
    )
      .then((r) => r.json())
      .then(
        (data: {
          data?: {
            slug: string
            name: string
            lat?: number | null
            lng?: number | null
            boundingBoxNE?: string | null
            boundingBoxSW?: string | null
          }[]
        }) => {
          const markers: RegionMarker[] = []
          for (const r of data.data ?? []) {
            let lat = r.lat ?? null
            let lng = r.lng ?? null
            // Fallback: derive centroid from bounding box when mapConfig lacks centerLat/centerLng
            if (lat == null && r.boundingBoxNE && r.boundingBoxSW) {
              const [neLat, neLng] = r.boundingBoxNE.split(",").map(Number)
              const [swLat, swLng] = r.boundingBoxSW.split(",").map(Number)
              if (
                !Number.isNaN(neLat!) &&
                !Number.isNaN(neLng!) &&
                !Number.isNaN(swLat!) &&
                !Number.isNaN(swLng!)
              ) {
                lat = (neLat! + swLat!) / 2
                lng = (neLng! + swLng!) / 2
              }
            }
            if (lat != null && lng != null)
              markers.push({ slug: r.slug, name: r.name, lat, lng })
          }
          setRegionMarkers(markers)
        }
      )
      .catch(() => setRegionMarkers([]))
      .finally(() => onLoadingChange?.(false))
  }, [drillState.country?.slug]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{
        position: [0, 0.06, RADIUS * 2.5],
        fov: 40,
        near: 0.1,
        far: 1000,
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
        stencil: false,
      }}
      dpr={[1, 1.35]}
      performance={{ min: 0.75 }}
    >
      <color attach="background" args={["#02040a"]} />
      <Suspense fallback={null}>
        <GlobeScene
          drillState={drillState}
          onDrillChange={onDrillChange}
          onFirstInteraction={onFirstInteraction}
          continentFeatures={continentFeatures}
          countryFeatures={countryFeatures}
          regionMarkers={regionMarkers}
        />
      </Suspense>
    </Canvas>
  )
}
