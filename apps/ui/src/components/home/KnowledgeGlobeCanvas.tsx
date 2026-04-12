"use client"

/* eslint-disable react/no-unknown-property */

import { OrbitControls, Stars, useTexture } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import {
  createLandDotsGeometry,
  createLandGlowGeometry,
} from "@/components/helpers/globe-geometry"
import {
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
  WIREFRAME_FRAGMENT_SHADER,
  WIREFRAME_VERTEX_SHADER,
} from "@/components/helpers/globe-shaders"
import {
  ARC_ROUTES,
  EARTH_RADIUS,
  EARTH_TILT,
  HUB_MARKERS,
  KNOWLEDGE_LIGHTS,
  type ArcRoute,
  type GlobeLight,
} from "@/components/home/knowledge-globe-data"
import {
  GLOBE_SETTINGS,
  GLOBE_QUALITY_TUNING,
} from "@/components/home/knowledge-globe-settings"
import { cn } from "@/lib/styles"

const NODE_GLOW_GEOMETRY = new THREE.PlaneGeometry(1, 1)
const ARC_PULSE_GEOMETRY = new THREE.SphereGeometry(1, 10, 10)
const GLOBE_QUALITY = GLOBE_QUALITY_TUNING[GLOBE_SETTINGS.qualityProfile]
const RENDERED_ARC_ROUTES = ARC_ROUTES.map((route) => ({
  points:
    GLOBE_QUALITY.routePoints === 44
      ? route.linePoints
      : route.curve.getPoints(GLOBE_QUALITY.routePoints),
  route,
}))
const ACTIVITY_SOURCES = [
  ...HUB_MARKERS.map((light) => ({
    position: light.position,
    radius: 0.46 + light.size * 4.8,
    weight: 0.42 + light.size * 5.6,
  })),
  ...KNOWLEDGE_LIGHTS.map((light) => ({
    position: light.position,
    radius: 0.2 + light.size * 4.2,
    weight: 0.05 + light.size * 2.8,
  })),
]
const ARC_VISIBILITY_SAMPLES = [0.16, 0.42, 0.68, 0.86] as const

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
  latBounds,
  lngBounds,
  landDotDensity,
  landDotSize,
  showGlow = true,
  showHotspots = true,
}: {
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
      activitySources: ACTIVITY_SOURCES,
    })
  }, [maskTexture.image, latBounds, lngBounds, landDotDensity])

  const glowGeometry = useMemo(
    () => createLandGlowGeometry(geometry),
    [geometry]
  )

  const dotSize = landDotSize ?? GLOBE_SETTINGS.landDotSize

  const uniforms = useMemo(
    () => ({
      uBaseColor: { value: new THREE.Color("#c3d8ee") },
      uHighlightColor: { value: new THREE.Color("#f7fbff") },
      uSizeScale: { value: dotSize * 1.04 },
    }),
    [dotSize]
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      glowGeometry.dispose()
    }
  }, [geometry, glowGeometry])

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
                value: new THREE.Color("#76c9ff").multiplyScalar(1.18),
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
  const rimUniforms = useMemo(
    () => ({
      uC: { value: 0.64 },
      uP: { value: 7 },
      uColor: { value: new THREE.Color("#7ec8f0") },
      uOpacity: { value: 0.38 * GLOBE_SETTINGS.atmosphereOpacity },
    }),
    []
  )

  const haloUniforms = useMemo(
    () => ({
      uC: { value: 0.68 },
      uP: { value: 4.5 },
      uColor: { value: new THREE.Color("#112040") },
      uOpacity: { value: 0.22 * GLOBE_SETTINGS.atmosphereOpacity },
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
        <meshBasicMaterial color="#000000" />
      </mesh>

      <mesh>
        <sphereGeometry
          args={[
            EARTH_RADIUS - 0.012,
            GLOBE_QUALITY.wireframeSegments,
            GLOBE_QUALITY.wireframeSegments,
          ]}
        />
        <shaderMaterial
          fragmentShader={WIREFRAME_FRAGMENT_SHADER}
          transparent
          vertexShader={WIREFRAME_VERTEX_SHADER}
          wireframe
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

      <mesh scale={1.08}>
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
      new THREE.Color(prominent ? "#7fdfff" : "#60b7ff").multiplyScalar(
        prominent ? 2.1 : 1.7
      ),
    [prominent]
  )
  const outerHaloColor = useMemo(
    () =>
      new THREE.Color(prominent ? "#60b7ff" : "#7fdfff").multiplyScalar(
        prominent ? 1.7 : 1.45
      ),
    [prominent]
  )
  const ambientHaloColor = useMemo(
    () => new THREE.Color("#90d9ff").multiplyScalar(prominent ? 1.1 : 0.95),
    [prominent]
  )
  const pulseColor = useMemo(
    () => new THREE.Color("#9ad8ff").multiplyScalar(prominent ? 1.55 : 1.35),
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

function ArcPulse({ route }: { readonly route: ArcRoute }) {
  const pulseRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const worldPulsePosition = useMemo(() => new THREE.Vector3(), [])
  const worldCenter = useMemo(() => new THREE.Vector3(), [])
  const worldScale = useMemo(() => new THREE.Vector3(), [])
  const segmentVector = useMemo(() => new THREE.Vector3(), [])
  const centerOffset = useMemo(() => new THREE.Vector3(), [])
  const closestPoint = useMemo(() => new THREE.Vector3(), [])

  const pulseColor = useMemo(
    () => new THREE.Color(route.color).multiplyScalar(1.6),
    [route.color]
  )
  const glowColor = useMemo(
    () => new THREE.Color(route.color).multiplyScalar(0.9),
    [route.color]
  )

  useFrame(({ camera, clock }) => {
    if (pulseRef.current == null) return

    const progress = (clock.elapsedTime * 0.06 + route.phase) % 1
    const point = route.curve.getPointAt(progress)
    const pulse =
      0.6 + 0.4 * Math.sin(clock.elapsedTime * 1.2 + route.phase * 10)

    pulseRef.current.position.copy(point)
    pulseRef.current.scale.setScalar(0.011 * (0.84 + pulse * 0.28))
    glowRef.current?.position.copy(point)
    glowRef.current?.scale.setScalar(0.028 * (0.8 + pulse * 0.3))

    pulseRef.current.getWorldPosition(worldPulsePosition)
    pulseRef.current.parent?.getWorldPosition(worldCenter)
    pulseRef.current.parent?.getWorldScale(worldScale)

    const visibility = computeSphereVisibility(
      worldPulsePosition,
      camera.position,
      worldCenter,
      worldScale.x * EARTH_RADIUS,
      segmentVector,
      centerOffset,
      closestPoint
    )

    ;(pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
      0.92 * visibility
    if (glowRef.current) {
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.22 * visibility
    }
  })

  return (
    <>
      <mesh geometry={ARC_PULSE_GEOMETRY} ref={glowRef}>
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={glowColor}
          depthTest={false}
          depthWrite={false}
          opacity={0.22}
          toneMapped={false}
          transparent
        />
      </mesh>
      <mesh geometry={ARC_PULSE_GEOMETRY} ref={pulseRef}>
        <meshBasicMaterial
          blending={THREE.AdditiveBlending}
          color={pulseColor}
          depthTest={false}
          depthWrite={false}
          opacity={0.92}
          toneMapped={false}
          transparent
        />
      </mesh>
    </>
  )
}

function KnowledgeArc({
  points,
  route,
}: {
  readonly points: THREE.Vector3[]
  readonly route: ArcRoute
}) {
  const groupRef = useRef<THREE.Group>(null)
  const lineRef = useRef<THREE.Line>(null)
  const ghostLineRef = useRef<THREE.Line>(null)
  const worldCenter = useMemo(() => new THREE.Vector3(), [])
  const worldPoint = useMemo(() => new THREE.Vector3(), [])
  const worldScale = useMemo(() => new THREE.Vector3(), [])
  const segmentVector = useMemo(() => new THREE.Vector3(), [])
  const centerOffset = useMemo(() => new THREE.Vector3(), [])
  const closestPoint = useMemo(() => new THREE.Vector3(), [])

  const geometry = useMemo(() => {
    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.setFromPoints(points)

    return lineGeometry
  }, [points])

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: route.color,
        depthTest: true,
        depthWrite: false,
        opacity: 0.34,
        transparent: true,
        toneMapped: false,
      }),
    [route.color]
  )

  const ghostMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        blending: THREE.AdditiveBlending,
        color: new THREE.Color(route.color).lerp(
          new THREE.Color("#9fdcff"),
          0.38
        ),
        depthTest: true,
        depthWrite: false,
        opacity: 0.055,
        transparent: true,
        toneMapped: false,
      }),
    [route.color]
  )

  const line = useMemo(
    () => new THREE.Line(geometry, material),
    [geometry, material]
  )
  const ghostLine = useMemo(
    () => new THREE.Line(geometry, ghostMaterial),
    [geometry, ghostMaterial]
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      ghostMaterial.dispose()
    }
  }, [geometry, material, ghostMaterial])

  useFrame(({ camera }) => {
    if (groupRef.current == null) {
      return
    }

    groupRef.current.getWorldPosition(worldCenter)
    groupRef.current.getWorldScale(worldScale)
    const worldRadius = worldScale.x * EARTH_RADIUS
    let visibilityTotal = 0

    ARC_VISIBILITY_SAMPLES.forEach((sample) => {
      worldPoint.copy(route.curve.getPointAt(sample))
      groupRef.current?.localToWorld(worldPoint)

      visibilityTotal += computeSphereVisibility(
        worldPoint,
        camera.position,
        worldCenter,
        worldRadius,
        segmentVector,
        centerOffset,
        closestPoint
      )
    })

    const averageVisibility = visibilityTotal / ARC_VISIBILITY_SAMPLES.length
    const lineOpacity = THREE.MathUtils.lerp(0.06, 0.82, averageVisibility)
    const ghostOpacity = lineOpacity * 0.16

    if (lineRef.current != null) {
      ;(lineRef.current.material as THREE.LineBasicMaterial).opacity =
        lineOpacity
    }

    if (ghostLineRef.current != null) {
      ;(ghostLineRef.current.material as THREE.LineBasicMaterial).opacity =
        ghostOpacity
    }
  })

  return (
    <group ref={groupRef}>
      <primitive object={ghostLine} ref={ghostLineRef} />
      <primitive object={line} ref={lineRef} />
      <ArcPulse route={route} />
    </group>
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

export type GlobeOverrides = {
  autoRotate?: boolean
  autoRotateSpeed?: number
  cameraFov?: number
  cameraY?: number
  cameraZ?: number
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
  showGlow?: boolean
  showHotspots?: boolean
  showNodes?: boolean
  showSatellites?: boolean
  showStars?: boolean
}

function GlobeScene({ overrides }: { readonly overrides?: GlobeOverrides }) {
  const globeY = overrides?.globeY ?? GLOBE_SETTINGS.globeY
  const globeScale = overrides?.globeScale ?? GLOBE_SETTINGS.globeScale
  const globePitch = overrides?.globePitch ?? GLOBE_SETTINGS.globePitch
  const globeYaw = overrides?.globeYaw ?? GLOBE_SETTINGS.globeYaw
  const globeTilt =
    overrides?.globeTilt !== undefined
      ? THREE.MathUtils.degToRad(overrides.globeTilt)
      : EARTH_TILT
  const autoRotate = overrides?.autoRotate ?? true
  const autoRotateSpeed =
    overrides?.autoRotateSpeed ?? GLOBE_SETTINGS.autoRotateSpeed
  const interactive = overrides?.interactive ?? true
  const minPolarAngle = overrides?.minPolarAngle ?? Math.PI * 0.34
  const maxPolarAngle = overrides?.maxPolarAngle ?? Math.PI * 0.7
  const showStars = overrides?.showStars ?? true
  const showArcs = overrides?.showArcs ?? true
  const showGlow = overrides?.showGlow ?? true
  const showNodes = overrides?.showNodes ?? true
  const showSatellites = overrides?.showSatellites ?? true
  const showHotspots = overrides?.showHotspots ?? true
  const landDotDensity = overrides?.landDotDensity
  const landDotSize = overrides?.landDotSize
  const latBounds = overrides?.latBounds
  const lngBounds = overrides?.lngBounds

  return (
    <>
      <color args={["#02040a"]} attach="background" />

      <ambientLight intensity={GLOBE_SETTINGS.ambientLight} />
      <hemisphereLight
        color="#eef8ff"
        groundColor="#050814"
        intensity={GLOBE_SETTINGS.ambientLight * 1.46}
      />
      <directionalLight
        color="#f4fbff"
        intensity={GLOBE_SETTINGS.directionalLight}
        position={[5, 4, 8]}
      />
      <pointLight
        color="#6fa6ff"
        intensity={GLOBE_SETTINGS.pointLight}
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

      <group position={[-0.02, globeY, 0]} scale={globeScale}>
        {showSatellites ? <Satellites /> : null}

        <group
          rotation={[
            THREE.MathUtils.degToRad(globePitch),
            THREE.MathUtils.degToRad(globeYaw),
            globeTilt,
          ]}
        >
          <GlobeShell />
          <DotGlobe
            landDotDensity={landDotDensity}
            landDotSize={landDotSize}
            latBounds={latBounds}
            lngBounds={lngBounds}
            showGlow={showGlow}
            showHotspots={showHotspots}
          />

          {showArcs
            ? RENDERED_ARC_ROUTES.map(({ points, route }) => (
                <KnowledgeArc
                  key={`${route.phase}-${route.color}`}
                  points={points}
                  route={route}
                />
              ))
            : null}

          {showNodes
            ? KNOWLEDGE_LIGHTS.map((light) => (
                <KnowledgeNode
                  key={`${light.phase}-${light.size}`}
                  light={light}
                />
              ))
            : null}

          {showNodes
            ? HUB_MARKERS.map((light) => (
                <KnowledgeNode
                  key={`hub-${light.phase}-${light.size}`}
                  light={light}
                  prominent
                />
              ))
            : null}
        </group>
      </group>

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

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          intensity={1.6}
          luminanceSmoothing={0.76}
          luminanceThreshold={0.12}
          mipmapBlur
          radius={0.78}
        />
      </EffectComposer>
    </>
  )
}

export function KnowledgeGlobeCanvas({
  className,
  overrides,
}: {
  readonly className?: string
  readonly overrides?: GlobeOverrides
}) {
  const fov = overrides?.cameraFov ?? GLOBE_SETTINGS.cameraFov
  const cameraZ = overrides?.cameraZ ?? GLOBE_SETTINGS.cameraZ
  const cameraY = overrides?.cameraY ?? 0.06

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* Ambient canvas glow — soft radial blue light emanating from the globe */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 65% at 62% 48%, rgba(18,72,148,0.22) 0%, rgba(8,28,72,0.10) 42%, transparent 68%)",
        }}
      />
      <Canvas
        camera={{
          fov,
          position: [0, cameraY, cameraZ],
        }}
        className="h-full w-full touch-none"
        dpr={[1, GLOBE_QUALITY.dprMax]}
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
          <GlobeScene overrides={overrides} />
        </Suspense>
      </Canvas>
    </div>
  )
}

useTexture.preload("/images/globe/earth-specular.jpg")

export default KnowledgeGlobeCanvas
