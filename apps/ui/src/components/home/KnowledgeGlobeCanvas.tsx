"use client"

/* eslint-disable react/no-unknown-property */

import { OrbitControls, Stars, useTexture } from "@react-three/drei"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import {
  createLandDotsGeometry,
  createSeededRandom,
  createLandGlowGeometry,
} from "@/components/helpers/globe-geometry"
import {
  ARC_FRAGMENT_SHADER,
  ARC_VERTEX_SHADER,
  DUST_FRAGMENT_SHADER,
  DUST_VERTEX_SHADER,
  GLOBE_SURFACE_FRAGMENT_SHADER,
  GRATICULE_FRAGMENT_SHADER,
  GRATICULE_VERTEX_SHADER,
  HALO_FRAGMENT_SHADER,
  HALO_VERTEX_SHADER,
  HOTSPOT_FRAGMENT_SHADER,
  HOTSPOT_VERTEX_SHADER,
  LAND_DOT_FRAGMENT_SHADER,
  LAND_DOT_VERTEX_SHADER,
  LAND_GLOW_FRAGMENT_SHADER,
  LAND_GLOW_VERTEX_SHADER,
  NODE_GLOW_FRAGMENT_SHADER,
  NODE_GLOW_VERTEX_SHADER,
} from "@/components/helpers/globe-shaders"
import {
  ARC_ROUTES,
  EARTH_RADIUS,
  EARTH_TILT,
  HUB_MARKERS,
  KNOWLEDGE_LIGHTS,
  buildLibraryArcs,
  buildLibraryLights,
  markersCentroid,
  type ArcRoute,
  type GlobeLight,
  type LibraryMarker,
  latLngToVector3,
} from "@/components/home/knowledge-globe-data"
import {
  GLOBE_SETTINGS,
  GLOBE_QUALITY_TUNING,
} from "@/components/home/knowledge-globe-settings"
import { cn } from "@/lib/styles"

const NODE_GLOW_GEOMETRY = new THREE.PlaneGeometry(1, 1)
const GLOBE_QUALITY = GLOBE_QUALITY_TUNING[GLOBE_SETTINGS.qualityProfile]
const RENDERED_ARC_ROUTES = ARC_ROUTES.map((route) => ({
  points:
    GLOBE_QUALITY.routePoints === 44
      ? route.linePoints
      : route.curve.getPoints(GLOBE_QUALITY.routePoints),
  route,
}))
type ActivitySource = {
  position: THREE.Vector3
  radius: number
  weight: number
}

function buildActivitySources(
  hubs: GlobeLight[],
  lights: GlobeLight[]
): ActivitySource[] {
  return [
    ...hubs.map((light) => ({
      position: light.position,
      radius: 0.46 + light.size * 4.8,
      weight: 0.42 + light.size * 5.6,
    })),
    ...lights.map((light) => ({
      position: light.position,
      radius: 0.2 + light.size * 4.2,
      weight: 0.05 + light.size * 2.8,
    })),
  ]
}

const ACTIVITY_SOURCES = buildActivitySources(HUB_MARKERS, KNOWLEDGE_LIGHTS)

function computeSphereVisibility(
  point: THREE.Vector3,
  cameraPosition: THREE.Vector3,
  sphereCenter: THREE.Vector3,
  sphereRadius: number,
  segmentVector: THREE.Vector3,
  centerOffset: THREE.Vector3,
  closestPoint: THREE.Vector3
) {
  segmentVector.copy(point).sub(cameraPosition)
  const segmentLengthSq = segmentVector.lengthSq()

  if (segmentLengthSq <= 1e-6) {
    return 1
  }

  centerOffset.copy(sphereCenter).sub(cameraPosition)
  const projectedDistance = THREE.MathUtils.clamp(
    centerOffset.dot(segmentVector) / segmentLengthSq,
    0,
    1
  )

  closestPoint
    .copy(cameraPosition)
    .addScaledVector(segmentVector, projectedDistance)

  const clearance = closestPoint.distanceTo(sphereCenter) - sphereRadius

  return THREE.MathUtils.smoothstep(
    clearance,
    -sphereRadius * 0.02,
    sphereRadius * 0.05
  )
}

function DotGlobe({
  activitySources = ACTIVITY_SOURCES,
  latBounds,
  lngBounds,
  landDotDensity,
  landDotSize,
  showGlow = true,
  showHotspots = true,
}: {
  readonly activitySources?: ActivitySource[]
  readonly latBounds?: [number, number]
  readonly lngBounds?: [number, number]
  readonly landDotDensity?: number
  readonly landDotSize?: number
  readonly showGlow?: boolean
  readonly showHotspots?: boolean
}) {
  const maskTexture = useTexture("/images/globe/earth-specular.jpg")
  const glowMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const hotspotMaterialRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const image =
      typeof HTMLImageElement !== "undefined" &&
      maskTexture.image instanceof HTMLImageElement
        ? maskTexture.image
        : null

    return createLandDotsGeometry({
      maskImage: image,
      radius: EARTH_RADIUS,
      density: landDotDensity ?? GLOBE_SETTINGS.landDotDensity,
      latBounds,
      lngBounds,
      activitySources,
    })
  }, [maskTexture.image, latBounds, lngBounds, landDotDensity, activitySources])

  // Ocean — sparser, dimmer indigo dots so the whole sphere reads as a
  // dot-matrix object rather than land floating on a void.
  const oceanGeometry = useMemo(() => {
    const image =
      typeof HTMLImageElement !== "undefined" &&
      maskTexture.image instanceof HTMLImageElement
        ? maskTexture.image
        : null

    return createLandDotsGeometry({
      maskImage: image,
      radius: EARTH_RADIUS,
      density: (landDotDensity ?? GLOBE_SETTINGS.landDotDensity) * 0.55,
      latBounds,
      lngBounds,
      invert: true,
    })
  }, [maskTexture.image, latBounds, lngBounds, landDotDensity])

  const glowGeometry = useMemo(
    () => createLandGlowGeometry(geometry),
    [geometry]
  )

  const dotSize = landDotSize ?? GLOBE_SETTINGS.landDotSize

  const uniforms = useMemo(
    () => ({
      // Land — parchment-white dots; the hotspot layer adds gold city light.
      uAlpha: { value: 1 },
      uBaseColor: { value: new THREE.Color("#d8d0bd") },
      uHighlightColor: { value: new THREE.Color("#fff8e6") },
      uSizeScale: { value: dotSize * 0.82 },
    }),
    [dotSize]
  )

  const oceanUniforms = useMemo(
    () => ({
      // Ocean — barely-there indigo so the sea reads dark, as in the render.
      uAlpha: { value: 0.3 },
      uBaseColor: { value: new THREE.Color("#5a60b8") },
      uHighlightColor: { value: new THREE.Color("#8c90d8") },
      uSizeScale: { value: dotSize * 0.8 },
    }),
    [dotSize]
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      oceanGeometry.dispose()
      glowGeometry.dispose()
    }
  }, [geometry, oceanGeometry, glowGeometry])

  useFrame(({ clock }) => {
    const glowTimeUniform = glowMaterialRef.current?.uniforms.uTime
    const hotspotTimeUniform = hotspotMaterialRef.current?.uniforms.uTime

    if (glowTimeUniform != null) {
      glowTimeUniform.value = clock.elapsedTime
    }

    if (hotspotTimeUniform != null) {
      hotspotTimeUniform.value = clock.elapsedTime
    }
  })

  return (
    <>
      <points geometry={oceanGeometry}>
        <shaderMaterial
          depthWrite={false}
          fragmentShader={LAND_DOT_FRAGMENT_SHADER}
          toneMapped={false}
          transparent
          uniforms={oceanUniforms}
          vertexShader={LAND_DOT_VERTEX_SHADER}
        />
      </points>

      <points geometry={geometry}>
        <shaderMaterial
          depthWrite={false}
          fragmentShader={LAND_DOT_FRAGMENT_SHADER}
          toneMapped={false}
          transparent
          uniforms={uniforms}
          vertexShader={LAND_DOT_VERTEX_SHADER}
        />
      </points>

      {showGlow ? (
        <points geometry={glowGeometry}>
          <shaderMaterial
            ref={glowMaterialRef}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fragmentShader={LAND_GLOW_FRAGMENT_SHADER}
            toneMapped={false}
            transparent
            uniforms={{
              uGlowColor: {
                value: new THREE.Color("#f2c879").multiplyScalar(0.6),
              },
              uSizeScale: { value: dotSize * 1.18 },
              uTime: { value: 0 },
            }}
            vertexShader={LAND_GLOW_VERTEX_SHADER}
          />
        </points>
      ) : null}

      {showHotspots ? (
        <points geometry={geometry}>
          <shaderMaterial
            ref={hotspotMaterialRef}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            fragmentShader={HOTSPOT_FRAGMENT_SHADER}
            toneMapped={false}
            transparent
            uniforms={{ uTime: { value: 0 } }}
            vertexShader={HOTSPOT_VERTEX_SHADER}
          />
        </points>
      ) : null}
    </>
  )
}

function GlobeShell() {
  const surfaceUniforms = useMemo(
    () => ({
      uDeepColor: { value: new THREE.Color("#12163a") },
      uRimColor: { value: new THREE.Color("#3f3f96") },
    }),
    []
  )

  const rimUniforms = useMemo(
    () => ({
      uC: { value: 0.66 },
      uP: { value: 6 },
      uColor: { value: new THREE.Color("#c9c2ff") },
      uOpacity: { value: 0.42 * GLOBE_SETTINGS.atmosphereOpacity },
    }),
    []
  )

  const haloUniforms = useMemo(
    () => ({
      uC: { value: 0.72 },
      uP: { value: 3.2 },
      uColor: { value: new THREE.Color("#7d70e6") },
      uOpacity: { value: 0.16 * GLOBE_SETTINGS.atmosphereOpacity },
    }),
    []
  )

  return (
    <>
      <mesh>
        <sphereGeometry
          args={[
            EARTH_RADIUS - 0.02,
            GLOBE_QUALITY.globeSegments,
            GLOBE_QUALITY.globeSegments,
          ]}
        />
        <shaderMaterial
          fragmentShader={GLOBE_SURFACE_FRAGMENT_SHADER}
          toneMapped={false}
          uniforms={surfaceUniforms}
          vertexShader={HALO_VERTEX_SHADER}
        />
      </mesh>

      <mesh scale={1.014}>
        <sphereGeometry
          args={[
            EARTH_RADIUS,
            GLOBE_QUALITY.globeSegments,
            GLOBE_QUALITY.globeSegments,
          ]}
        />
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

      <mesh scale={1.14}>
        <sphereGeometry
          args={[
            EARTH_RADIUS,
            GLOBE_QUALITY.atmosphereSegments,
            GLOBE_QUALITY.atmosphereSegments,
          ]}
        />
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
    </>
  )
}

function KnowledgeNode({
  light,
  prominent = false,
}: {
  readonly light: GlobeLight
  readonly prominent?: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const haloRef = useRef<THREE.Mesh>(null)
  const outerHaloRef = useRef<THREE.Mesh>(null)
  const ambientHaloRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)
  const worldCenter = useMemo(() => new THREE.Vector3(), [])
  const worldPosition = useMemo(() => new THREE.Vector3(), [])
  const worldScale = useMemo(() => new THREE.Vector3(), [])
  const segmentVector = useMemo(() => new THREE.Vector3(), [])
  const centerOffset = useMemo(() => new THREE.Vector3(), [])
  const closestPoint = useMemo(() => new THREE.Vector3(), [])
  const glowIntensity = GLOBE_SETTINGS.nodeGlow
  const haloBaseScale = light.size * (prominent ? 1.28 : 0.9) * 2.2
  const outerHaloBaseScale = light.size * (prominent ? 2.4 : 1.48) * 3.9
  const ambientHaloBaseScale = light.size * (prominent ? 5.4 : 4.8)
  const pulseBaseScale = light.size * (prominent ? 0.32 : 0.19) * 1.45

  const nodePosition = useMemo(
    () =>
      light.position
        .clone()
        .normalize()
        .multiplyScalar(
          Math.max(EARTH_RADIUS + 0.012, light.position.length())
        ),
    [light.position]
  )

  const haloColor = useMemo(
    () =>
      new THREE.Color(prominent ? "#dfe4ff" : "#f2c879").multiplyScalar(
        prominent ? 2.1 : 1.7
      ),
    [prominent]
  )
  const outerHaloColor = useMemo(
    () =>
      new THREE.Color(prominent ? "#b9b4f5" : "#ffd9a0").multiplyScalar(
        prominent ? 1.7 : 1.45
      ),
    [prominent]
  )
  const ambientHaloColor = useMemo(
    () =>
      new THREE.Color(prominent ? "#8f86e8" : "#f5e3bd").multiplyScalar(
        prominent ? 1.1 : 0.95
      ),
    [prominent]
  )
  const pulseColor = useMemo(
    () =>
      new THREE.Color(prominent ? "#ffffff" : "#ffedcb").multiplyScalar(
        prominent ? 1.7 : 1.35
      ),
    [prominent]
  )

  const uniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uColor: { value: haloColor },
      uOpacity: { value: 0.028 * glowIntensity },
      uPlanetRadius: { value: EARTH_RADIUS },
    }),
    [glowIntensity, haloColor]
  )
  const outerUniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uColor: { value: outerHaloColor },
      uOpacity: { value: 0.018 * glowIntensity },
      uPlanetRadius: { value: EARTH_RADIUS },
    }),
    [glowIntensity, outerHaloColor]
  )
  const ambientUniforms = useMemo(
    () => ({
      uCameraPosition: { value: new THREE.Vector3() },
      uColor: { value: ambientHaloColor },
      uOpacity: { value: 0.008 * glowIntensity },
      uPlanetRadius: { value: EARTH_RADIUS },
    }),
    [ambientHaloColor, glowIntensity]
  )

  const applyGlowState = (
    mesh: THREE.Mesh | null,
    scale: number,
    opacity: number,
    camera: THREE.Camera,
    visibility: number
  ) => {
    if (mesh == null) {
      return
    }

    mesh.quaternion.copy(camera.quaternion)
    mesh.scale.set(scale, scale, 1)

    const material = mesh.material as THREE.ShaderMaterial
    const glowUniforms = material.uniforms as {
      uCameraPosition: { value: THREE.Vector3 }
      uOpacity: { value: number }
    }

    glowUniforms.uOpacity.value = opacity * visibility
    glowUniforms.uCameraPosition.value.copy(camera.position)
  }

  useFrame(({ camera, clock }) => {
    if (groupRef.current == null) {
      return
    }

    const pulse =
      0.58 +
      0.42 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.9 + light.phase))

    groupRef.current.getWorldPosition(worldPosition)
    groupRef.current.getWorldScale(worldScale)
    groupRef.current.parent?.getWorldPosition(worldCenter)

    const visibility = computeSphereVisibility(
      worldPosition,
      camera.position,
      worldCenter,
      worldScale.x * EARTH_RADIUS,
      segmentVector,
      centerOffset,
      closestPoint
    )

    applyGlowState(
      haloRef.current,
      haloBaseScale * (1 + pulse * (prominent ? 0.26 : 0.14)),
      (0.02 + pulse * (prominent ? 0.01 : 0.005)) * glowIntensity,
      camera,
      visibility
    )
    applyGlowState(
      outerHaloRef.current,
      outerHaloBaseScale * (1.02 + pulse * (prominent ? 0.34 : 0.18)),
      (0.012 + pulse * (prominent ? 0.006 : 0.003)) * glowIntensity,
      camera,
      visibility
    )
    applyGlowState(
      ambientHaloRef.current,
      ambientHaloBaseScale * (1 + pulse * 0.1),
      (0.0048 + pulse * 0.0028) * glowIntensity,
      camera,
      visibility
    )
    applyGlowState(
      pulseRef.current,
      pulseBaseScale * (0.95 + pulse * 0.16),
      (0.1 + pulse * 0.04) * glowIntensity,
      camera,
      visibility
    )
  })

  return (
    <group position={nodePosition} ref={groupRef}>
      <mesh geometry={NODE_GLOW_GEOMETRY} ref={ambientHaloRef} renderOrder={8}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={NODE_GLOW_FRAGMENT_SHADER}
          toneMapped={false}
          transparent
          uniforms={ambientUniforms}
          vertexShader={NODE_GLOW_VERTEX_SHADER}
        />
      </mesh>

      <mesh geometry={NODE_GLOW_GEOMETRY} ref={outerHaloRef} renderOrder={9}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={NODE_GLOW_FRAGMENT_SHADER}
          toneMapped={false}
          transparent
          uniforms={outerUniforms}
          vertexShader={NODE_GLOW_VERTEX_SHADER}
        />
      </mesh>

      <mesh geometry={NODE_GLOW_GEOMETRY} ref={haloRef} renderOrder={10}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={NODE_GLOW_FRAGMENT_SHADER}
          toneMapped={false}
          transparent
          uniforms={uniforms}
          vertexShader={NODE_GLOW_VERTEX_SHADER}
        />
      </mesh>

      <mesh geometry={NODE_GLOW_GEOMETRY} ref={pulseRef} renderOrder={11}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={NODE_GLOW_FRAGMENT_SHADER}
          toneMapped={false}
          transparent
          uniforms={{
            uCameraPosition: { value: new THREE.Vector3() },
            uColor: { value: pulseColor },
            uOpacity: { value: 0.11 * glowIntensity },
            uPlanetRadius: { value: EARTH_RADIUS },
          }}
          vertexShader={NODE_GLOW_VERTEX_SHADER}
        />
      </mesh>
    </group>
  )
}

function KnowledgeArc({
  points,
  route,
}: {
  readonly points: THREE.Vector3[]
  readonly route: ArcRoute
}) {
  const geometry = useMemo(() => {
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
    const progress = points.map((_, i) => i / Math.max(points.length - 1, 1))
    lineGeometry.setAttribute(
      "aProgress",
      new THREE.Float32BufferAttribute(progress, 1)
    )

    return lineGeometry
  }, [points])

  // Comets cross every arc in roughly the same wall-clock time band, so short
  // regional hops don't flicker and long routes don't crawl.
  const material = useMemo(() => {
    const arcLength = route.curve.getLength()

    return new THREE.ShaderMaterial({
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fragmentShader: ARC_FRAGMENT_SHADER,
      toneMapped: false,
      transparent: true,
      uniforms: {
        uColor: { value: new THREE.Color(route.color) },
        uOpacity: { value: 0.9 },
        uPhase: { value: route.phase },
        uSpeed: {
          value: THREE.MathUtils.clamp(0.9 / (arcLength + 1.2), 0.08, 0.3),
        },
        uTime: { value: 0 },
      },
      vertexShader: ARC_VERTEX_SHADER,
    })
  }, [route.color, route.curve, route.phase])

  const line = useMemo(
    () => new THREE.Line(geometry, material),
    [geometry, material]
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  const lineRef = useRef<THREE.Line>(null)

  useFrame(({ clock }) => {
    const timeUniform = (lineRef.current?.material as THREE.ShaderMaterial)
      ?.uniforms.uTime
    if (timeUniform != null) timeUniform.value = clock.elapsedTime
  })

  return <primitive object={line} ref={lineRef} />
}

// ---------------------------------------------------------------------------
// Graticule — hairline lat/long grid, faded at the limb and poles.
// ---------------------------------------------------------------------------

const GRATICULE_STEP = 20

function createGraticuleGeometry(radius: number) {
  const positions: number[] = []
  const push = (lat: number, lng: number) => {
    const point = latLngToVector3(lat, lng, radius)
    positions.push(point.x, point.y, point.z)
  }

  for (let lng = -180; lng < 180; lng += GRATICULE_STEP) {
    for (let lat = -80; lat < 80; lat += 2) {
      push(lat, lng)
      push(lat + 2, lng)
    }
  }
  for (let lat = -60; lat <= 60; lat += GRATICULE_STEP) {
    for (let lng = -180; lng < 180; lng += 2) {
      push(lat, lng)
      push(lat, lng + 2)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  )

  return geometry
}

function Graticule() {
  const geometry = useMemo(
    () => createGraticuleGeometry(EARTH_RADIUS + 0.004),
    []
  )
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#c9c2ff") },
      uOpacity: { value: 0.07 },
    }),
    []
  )

  useEffect(() => () => geometry.dispose(), [geometry])

  return (
    <lineSegments geometry={geometry}>
      <shaderMaterial
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        fragmentShader={GRATICULE_FRAGMENT_SHADER}
        toneMapped={false}
        transparent
        uniforms={uniforms}
        vertexShader={GRATICULE_VERTEX_SHADER}
      />
    </lineSegments>
  )
}

// ---------------------------------------------------------------------------
// OrbitalDust — twinkling lavender motes in a shell around the globe.
// ---------------------------------------------------------------------------

const DUST_COUNT = 420

function createDustGeometry() {
  const random = createSeededRandom(7)
  const positions: number[] = []
  const phases: number[] = []
  const sizes: number[] = []
  const direction = new THREE.Vector3()

  for (let i = 0; i < DUST_COUNT; i += 1) {
    direction
      .set(random() * 2 - 1, random() * 2 - 1, random() * 2 - 1)
      .normalize()
    // Squared falloff crowds motes near the atmosphere.
    const shell = EARTH_RADIUS * (1.04 + random() ** 2 * 0.5)
    direction.multiplyScalar(shell)
    positions.push(direction.x, direction.y, direction.z)
    phases.push(random() * Math.PI * 2)
    sizes.push(0.6 + random() * 1.1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  )
  geometry.setAttribute("aPhase", new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute("aSize", new THREE.Float32BufferAttribute(sizes, 1))

  return geometry
}

function OrbitalDust() {
  const geometry = useMemo(() => createDustGeometry(), [])
  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color("#8a80ea") },
      uOpacity: { value: 0.6 },
      uSizeScale: { value: 0.9 },
      uTime: { value: 0 },
    }),
    []
  )

  const materialRef = useRef<THREE.ShaderMaterial>(null)

  useEffect(() => () => geometry.dispose(), [geometry])

  useFrame(({ clock }) => {
    const timeUniform = materialRef.current?.uniforms.uTime
    if (timeUniform != null) timeUniform.value = clock.elapsedTime
  })

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        depthWrite={false}
        fragmentShader={DUST_FRAGMENT_SHADER}
        toneMapped={false}
        transparent
        uniforms={uniforms}
        vertexShader={DUST_VERTEX_SHADER}
      />
    </points>
  )
}

// ---------------------------------------------------------------------------
// LibraryPointsLayer — one Points draw call for every plotted record. Scales
// to thousands of records where per-node halo meshes would not, and avoids
// the additive white-out that stacked halos caused on dense clusters.
// ---------------------------------------------------------------------------

function createNodeSpriteTexture() {
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext("2d")
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, "rgba(255,243,214,1)")
    gradient.addColorStop(0.3, "rgba(245,201,126,0.85)")
    gradient.addColorStop(1, "rgba(245,201,126,0)")
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  return texture
}

function LibraryPointsLayer({ lights }: { readonly lights: GlobeLight[] }) {
  const texture = useMemo(() => createNodeSpriteTexture(), [])
  const geometry = useMemo(() => {
    const positions: number[] = []
    lights.forEach((light) => {
      positions.push(light.position.x, light.position.y, light.position.z)
    })
    const pointsGeometry = new THREE.BufferGeometry()
    pointsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3)
    )
    pointsGeometry.computeBoundingSphere()

    return pointsGeometry
  }, [lights])

  useEffect(() => {
    return () => {
      geometry.dispose()
      texture.dispose()
    }
  }, [geometry, texture])

  return (
    <points geometry={geometry}>
      <pointsMaterial
        blending={THREE.AdditiveBlending}
        color="#ffdf9e"
        depthWrite={false}
        map={texture}
        size={0.13}
        sizeAttenuation
        toneMapped={false}
        transparent
      />
    </points>
  )
}

// ---------------------------------------------------------------------------
// Satellites — thin orbital ring lines with glowing nodes that orbit
// independently of the globe's rotation.
// ---------------------------------------------------------------------------

const SATELLITE_CONFIGS = [
  {
    color: "#e8f4ff", // cool white
    inclination: 26,
    orbitRadius: EARTH_RADIUS * 1.36,
    nodePhase: 0.14,
    speed: 0.009,
  },
  {
    color: "#c8e0ff", // light blue
    inclination: -44,
    orbitRadius: EARTH_RADIUS * 1.54,
    nodePhase: 0.68,
    speed: 0.006,
  },
  {
    color: "#f0f8ff", // almost white
    inclination: 62,
    orbitRadius: EARTH_RADIUS * 1.24,
    nodePhase: 0.38,
    speed: 0.011,
  },
  {
    color: "#b8d0f0", // steel blue
    inclination: -16,
    orbitRadius: EARTH_RADIUS * 1.44,
    nodePhase: 0.82,
    speed: 0.007,
  },
  {
    color: "#d8ecff", // pale sky
    inclination: 38,
    orbitRadius: EARTH_RADIUS * 1.62,
    nodePhase: 0.51,
    speed: 0.005,
  },
  {
    color: "#a8c8e8", // muted blue
    inclination: -55,
    orbitRadius: EARTH_RADIUS * 1.32,
    nodePhase: 0.22,
    speed: 0.008,
  },
  {
    color: "#e8f4ff", // cool white
    inclination: 75,
    orbitRadius: EARTH_RADIUS * 1.48,
    nodePhase: 0.61,
    speed: 0.006,
  },
  {
    color: "#c8e0ff", // light blue
    inclination: -30,
    orbitRadius: EARTH_RADIUS * 1.7,
    nodePhase: 0.35,
    speed: 0.004,
  },
  {
    color: "#f0f8ff", // almost white
    inclination: 50,
    orbitRadius: EARTH_RADIUS * 1.28,
    nodePhase: 0.76,
    speed: 0.01,
  },
  {
    color: "#b8d0f0", // steel blue
    inclination: -70,
    orbitRadius: EARTH_RADIUS * 1.58,
    nodePhase: 0.42,
    speed: 0.007,
  },
  {
    color: "#d8ecff", // pale sky
    inclination: 15,
    orbitRadius: EARTH_RADIUS * 1.4,
    nodePhase: 0.88,
    speed: 0.009,
  },
  {
    color: "#a8c8e8", // muted blue
    inclination: -85,
    orbitRadius: EARTH_RADIUS * 1.66,
    nodePhase: 0.55,
    speed: 0.005,
  },
] as const

function SatelliteOrbit({
  color,
  inclination,
  orbitRadius,
  nodePhase,
  speed,
}: {
  readonly color: string
  readonly inclination: number
  readonly orbitRadius: number
  readonly nodePhase: number
  readonly speed: number
}) {
  const nodeRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (nodeRef.current == null) return
    const a = ((clock.elapsedTime * speed + nodePhase) % 1) * Math.PI * 2
    nodeRef.current.position.set(
      Math.cos(a) * orbitRadius,
      0,
      Math.sin(a) * orbitRadius
    )
  })

  return (
    <group rotation={[THREE.MathUtils.degToRad(inclination), 0, 0]}>
      {/* Tiny bright dot — bloom turns it into a glowing satellite spark */}
      <mesh ref={nodeRef}>
        <sphereGeometry args={[0.008, 6, 6]} />
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={color}
          depthWrite={false}
          opacity={1}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  )
}

function Satellites() {
  return (
    <>
      {SATELLITE_CONFIGS.map((cfg) => (
        <SatelliteOrbit key={`${cfg.color}-${cfg.inclination}`} {...cfg} />
      ))}
    </>
  )
}

function StarfieldLayer({
  count,
  depth,
  factor,
  radius,
  rotationSpeed,
}: {
  readonly count: number
  readonly depth: number
  readonly factor: number
  readonly radius: number
  readonly rotationSpeed: [number, number]
}) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (groupRef.current == null) {
      return
    }

    groupRef.current.rotation.y = clock.elapsedTime * rotationSpeed[0]
    groupRef.current.rotation.x = clock.elapsedTime * rotationSpeed[1]
  })

  return (
    <group ref={groupRef}>
      <Stars
        count={count}
        depth={depth}
        factor={factor}
        radius={radius}
        saturation={0}
        speed={0}
      />
    </group>
  )
}

/**
 * Pins the globe to a point on the canvas instead of centring it. `x`/`y` are
 * fractions of the canvas (0 = left/top, values past 1 sit off-canvas),
 * `radius` is a fraction of canvas height, capped by `maxRadiusW` (fraction
 * of width) so narrow viewports don't swallow the page content.
 */
export type GlobeScreenAnchor = {
  x: number
  y: number
  radius: number
  maxRadiusW?: number
}

export type GlobeOverrides = {
  anchor?: GlobeScreenAnchor
  autoRotate?: boolean
  autoRotateSpeed?: number
  cameraFov?: number
  cameraY?: number
  cameraZ?: number
  dprMax?: number
  globePitch?: number
  globeScale?: number
  globeTilt?: number
  globeY?: number
  globeYaw?: number
  interactive?: boolean
  landDotDensity?: number
  landDotSize?: number
  latBounds?: [number, number]
  lngBounds?: [number, number]
  maxPolarAngle?: number
  minPolarAngle?: number
  showArcs?: boolean
  showDust?: boolean
  showGlow?: boolean
  showGraticule?: boolean
  showHotspots?: boolean
  showNodes?: boolean
  showSatellites?: boolean
  showStars?: boolean
}

/** World-space position + scale that places the globe at a screen anchor.
 * Assumes the camera looks down -z at the origin, so the globe plane (z=0)
 * sits `camera.position.z` away. */
function useAnchorFrame(anchor: GlobeScreenAnchor | undefined) {
  const size = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)

  return useMemo(() => {
    if (!anchor || !(camera instanceof THREE.PerspectiveCamera)) return null
    const worldH =
      2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const aspect = size.width / Math.max(size.height, 1)
    const worldW = worldH * aspect
    const radiusH = Math.min(
      anchor.radius,
      (anchor.maxRadiusW ?? Infinity) * aspect
    )

    return {
      position: [(anchor.x - 0.5) * worldW, (0.5 - anchor.y) * worldH, 0] as [
        number,
        number,
        number,
      ],
      scale: (radiusH * worldH) / EARTH_RADIUS,
    }
  }, [anchor, camera, size.width, size.height])
}

/** Spins its children about the globe's own polar axis — used in anchored
 * mode, where OrbitControls' auto-rotate would swing the camera around the
 * origin rather than the off-centre globe. */
function PolarSpin({
  children,
  speed,
}: {
  readonly children: React.ReactNode
  readonly speed: number
}) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * speed
  })

  return <group ref={ref}>{children}</group>
}

function GlobeScene({
  markers,
  overrides,
}: {
  readonly markers?: LibraryMarker[]
  readonly overrides?: GlobeOverrides
}) {
  const anchorFrame = useAnchorFrame(overrides?.anchor)
  // Real records replace the illustrative dataset when available.
  const dataLayers = useMemo(() => {
    if (!markers || markers.length === 0) return null
    const { hubs, lights } = buildLibraryLights(markers)
    const arcs = buildLibraryArcs(markers)

    return {
      activity: buildActivitySources(hubs, lights),
      arcs: arcs.map((route) => ({
        points: route.curve.getPoints(GLOBE_QUALITY.routePoints),
        route,
      })),
      hubs,
      lights,
    }
  }, [markers])

  const centroid = useMemo(
    () => (markers && markers.length > 0 ? markersCentroid(markers) : null),
    [markers]
  )

  const hubMarkers = dataLayers?.hubs ?? HUB_MARKERS
  const knowledgeLights = dataLayers?.lights ?? KNOWLEDGE_LIGHTS
  const renderedArcs = dataLayers?.arcs ?? RENDERED_ARC_ROUTES
  const activitySources = dataLayers?.activity ?? ACTIVITY_SOURCES

  const globeY = overrides?.globeY ?? GLOBE_SETTINGS.globeY
  const globeScale = overrides?.globeScale ?? GLOBE_SETTINGS.globeScale
  // Face the plotted data toward the camera by default.
  const globePitch =
    overrides?.globePitch ??
    (centroid
      ? THREE.MathUtils.clamp(centroid.lat * 0.55, -32, 32)
      : GLOBE_SETTINGS.globePitch)
  const globeYaw =
    overrides?.globeYaw ?? (centroid ? -centroid.lng : GLOBE_SETTINGS.globeYaw)
  // Axial tilt is decorative on the illustrative globe; with real data it
  // rolls the centred cluster off-axis, so it's dropped when markers drive
  // the framing.
  const globeTilt =
    overrides?.globeTilt !== undefined
      ? THREE.MathUtils.degToRad(overrides.globeTilt)
      : centroid
        ? 0
        : EARTH_TILT
  const autoRotate = overrides?.autoRotate ?? true
  const autoRotateSpeed =
    overrides?.autoRotateSpeed ?? GLOBE_SETTINGS.autoRotateSpeed
  const interactive = overrides?.interactive ?? true
  const minPolarAngle = overrides?.minPolarAngle ?? Math.PI * 0.34
  const maxPolarAngle = overrides?.maxPolarAngle ?? Math.PI * 0.7
  const showStars = overrides?.showStars ?? true
  const showArcs = overrides?.showArcs ?? true
  const showDust = overrides?.showDust ?? true
  const showGlow = overrides?.showGlow ?? true
  const showGraticule = overrides?.showGraticule ?? true
  const showNodes = overrides?.showNodes ?? true
  const showSatellites = overrides?.showSatellites ?? true
  const showHotspots = overrides?.showHotspots ?? true
  const landDotDensity = overrides?.landDotDensity
  const landDotSize = overrides?.landDotSize
  const latBounds = overrides?.latBounds
  const lngBounds = overrides?.lngBounds

  return (
    <>
      <ambientLight intensity={GLOBE_SETTINGS.ambientLight} />
      <hemisphereLight
        color="#fdf8ec"
        groundColor="#17162b"
        intensity={GLOBE_SETTINGS.ambientLight * 1.46}
      />
      <directionalLight
        color="#fff6e6"
        intensity={GLOBE_SETTINGS.directionalLight}
        position={[5, 4, 8]}
      />
      <pointLight
        color="#8a7ce8"
        intensity={GLOBE_SETTINGS.pointLight * 0.7}
        position={[-7, -2, -10]}
      />

      {showStars ? (
        <>
          <StarfieldLayer
            count={4000}
            depth={48}
            factor={0.5}
            radius={80}
            rotationSpeed={[0, 0]}
          />
          <StarfieldLayer
            count={2000}
            depth={72}
            factor={1}
            radius={120}
            rotationSpeed={[0, 0]}
          />
          <StarfieldLayer
            count={800}
            depth={120}
            factor={2}
            radius={200}
            rotationSpeed={[0, 0]}
          />
        </>
      ) : null}

      <group
        position={anchorFrame?.position ?? [-0.02, globeY, 0]}
        scale={anchorFrame?.scale ?? globeScale}
      >
        {showSatellites ? <Satellites /> : null}
        {showDust ? <OrbitalDust /> : null}

        {/* Pitch/tilt applied outside, yaw inside — so yaw spins the sphere
            about its own poles and lng→front math stays exact. */}
        <group rotation={[THREE.MathUtils.degToRad(globePitch), 0, globeTilt]}>
          <PolarSpin speed={anchorFrame && autoRotate ? autoRotateSpeed : 0}>
            <group rotation={[0, THREE.MathUtils.degToRad(globeYaw), 0]}>
              <GlobeShell />
              {showGraticule ? <Graticule /> : null}
              <DotGlobe
                activitySources={activitySources}
                landDotDensity={landDotDensity}
                landDotSize={landDotSize}
                latBounds={latBounds}
                lngBounds={lngBounds}
                showGlow={showGlow}
                showHotspots={showHotspots}
              />

              {showArcs
                ? renderedArcs.map(({ points, route }) => (
                    <KnowledgeArc
                      key={`${route.phase}-${route.color}`}
                      points={points}
                      route={route}
                    />
                  ))
                : null}

              {showNodes && dataLayers ? (
                <LibraryPointsLayer lights={knowledgeLights} />
              ) : null}

              {showNodes && !dataLayers
                ? knowledgeLights.map((light) => (
                    <KnowledgeNode
                      key={`${light.phase}-${light.size}`}
                      light={light}
                    />
                  ))
                : null}

              {showNodes
                ? hubMarkers.map((light) => (
                    <KnowledgeNode
                      key={`hub-${light.phase}-${light.size}`}
                      light={light}
                      prominent
                    />
                  ))
                : null}
            </group>
          </PolarSpin>
        </group>
      </group>

      {anchorFrame ? null : (
        <OrbitControls
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          dampingFactor={0.08}
          enableDamping
          enablePan={false}
          enableRotate={interactive}
          enableZoom={false}
          maxPolarAngle={maxPolarAngle}
          minPolarAngle={minPolarAngle}
          rotateSpeed={0.34}
        />
      )}

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          intensity={0.85}
          luminanceSmoothing={0.7}
          luminanceThreshold={0.32}
          mipmapBlur
          radius={0.66}
        />
      </EffectComposer>
    </>
  )
}

export function KnowledgeGlobeCanvas({
  className,
  markers,
  overrides,
}: {
  readonly className?: string
  readonly markers?: LibraryMarker[]
  readonly overrides?: GlobeOverrides
}) {
  const fov = overrides?.cameraFov ?? GLOBE_SETTINGS.cameraFov
  const cameraZ = overrides?.cameraZ ?? GLOBE_SETTINGS.cameraZ
  const cameraY = overrides?.cameraY ?? 0.06
  const anchor = overrides?.anchor

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* Ambient canvas glow — a soft warm indigo wash behind the globe */}
      {anchor ? null : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 62% at 50% 46%, rgba(67,56,202,0.10) 0%, rgba(242,200,121,0.07) 44%, transparent 70%)",
          }}
        />
      )}
      <Canvas
        camera={{
          fov,
          position: [0, cameraY, cameraZ],
        }}
        className="h-full w-full touch-none"
        dpr={[1, overrides?.dprMax ?? GLOBE_QUALITY.dprMax]}
        gl={{
          alpha: true,
          antialias: GLOBE_QUALITY.antialias,
          powerPreference: "high-performance",
          stencil: false,
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
        performance={{ min: 0.75 }}
      >
        <Suspense fallback={null}>
          <GlobeScene markers={markers} overrides={overrides} />
        </Suspense>
      </Canvas>
    </div>
  )
}

useTexture.preload("/images/globe/earth-specular.jpg")

export default KnowledgeGlobeCanvas
