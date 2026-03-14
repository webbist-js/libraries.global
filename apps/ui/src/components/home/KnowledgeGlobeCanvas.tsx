"use client"

/* eslint-disable react/no-unknown-property */

import { Line, OrbitControls, Stars, useTexture } from "@react-three/drei"
import { Canvas, useFrame } from "@react-three/fiber"
import { Bloom, EffectComposer } from "@react-three/postprocessing"
import { Suspense, useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import {
  ARC_ROUTES,
  EARTH_RADIUS,
  EARTH_TILT,
  HUB_MARKERS,
  KNOWLEDGE_LIGHTS,
  latLngToVector3,
  type ArcRoute,
  type GlobeLight,
} from "@/components/home/knowledge-globe-data"
import {
  FIXED_GLOBE_SETTINGS,
  GLOBE_QUALITY_TUNING,
} from "@/components/home/knowledge-globe-settings"
import { cn } from "@/lib/styles"

const LAND_DOT_VERTEX_SHADER = `
  attribute float intensity;
  attribute float size;

  uniform float uSizeScale;

  varying float vIntensity;

  void main() {
    vec3 direction = normalize(position);
    vec3 staticPosition = position + direction * (0.0018 + intensity * 0.0022);
    vec4 mvPosition = modelViewMatrix * vec4(staticPosition, 1.0);

    vIntensity = intensity;
    float sizeFactor = 0.34 + intensity * 0.18;
    gl_PointSize =
      size *
      uSizeScale *
      sizeFactor *
      (122.0 / -mvPosition.z) *
      0.62;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const LAND_DOT_FRAGMENT_SHADER = `
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;

  varying float vIntensity;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float halo = smoothstep(0.38, 0.1, distanceToCenter);
    float core = smoothstep(0.12, 0.0, distanceToCenter);
    float alpha = (halo * 0.2 + core * 0.9) * (0.34 + vIntensity * 0.28);
    vec3 color = mix(uBaseColor, uHighlightColor, core * 0.2 + vIntensity * 0.18);

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

const HOTSPOT_VERTEX_SHADER = `
  attribute float activity;
  attribute float phase;
  attribute float size;

  uniform float uTime;

  varying float vActivity;
  varying float vGlow;
  varying float vWave;

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float perlinNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 g00 = hash(i + vec2(0.0, 0.0));
    vec2 g10 = hash(i + vec2(1.0, 0.0));
    vec2 g01 = hash(i + vec2(0.0, 1.0));
    vec2 g11 = hash(i + vec2(1.0, 1.0));

    float d00 = dot(g00, f - vec2(0.0, 0.0));
    float d10 = dot(g10, f - vec2(1.0, 0.0));
    float d01 = dot(g01, f - vec2(0.0, 1.0));
    float d11 = dot(g11, f - vec2(1.0, 1.0));

    return mix(mix(d00, d10, u.x), mix(d01, d11, u.x), u.y);
  }

  void main() {
    vec3 direction = normalize(position);
    float longitude = atan(direction.z, direction.x);
    float latitude = asin(direction.y);
    float busyField = smoothstep(0.18, 0.92, activity);
    float localNoise =
      0.5 +
      0.5 *
        perlinNoise(position.xy * 1.25 + vec2(uTime * 0.18, -uTime * 0.14));
    float sweep =
      0.5 + 0.5 * sin(longitude * 2.4 - uTime * 0.64 + localNoise * 1.5);
    float latitudeBand =
      0.5 + 0.5 * sin(latitude * 2.0 + uTime * 0.16 + localNoise * 1.2);
    float wave = clamp(localNoise * 0.55 + sweep * 0.28 + latitudeBand * 0.17, 0.0, 1.0);
    float pulse =
      0.5 + 0.5 * sin(uTime * 1.15 + phase * 1.4 + localNoise * 2.0);
    float baseField = smoothstep(0.48, 0.82, wave);
    float glow = clamp(baseField * 0.55 + busyField * (0.22 + pulse * 0.78), 0.0, 1.0);

    vec3 animatedPosition = position + direction * (0.004 + baseField * 0.006 + busyField * 0.01);
    vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);

    vActivity = busyField;
    vGlow = glow;
    vWave = wave;

    float hotspotSize = size * (0.18 + baseField * 0.55 + busyField * 0.65 + glow * 1.15);
    gl_PointSize = hotspotSize * (124.0 / -mvPosition.z) * 0.58;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const HOTSPOT_FRAGMENT_SHADER = `
  varying float vActivity;
  varying float vGlow;
  varying float vWave;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float halo = smoothstep(0.44, 0.08, distanceToCenter);
    float core = smoothstep(0.14, 0.0, distanceToCenter);
    float baseGlow = smoothstep(0.5, 0.82, vWave);
    float alpha =
      halo * (baseGlow * 0.08 + vActivity * 0.1) +
      core * (baseGlow * 0.22 + vGlow * 0.5);

    if (alpha < 0.02) discard;

    vec3 color = mix(
      vec3(0.52, 0.84, 1.0),
      vec3(1.0),
      core * 0.55 + vGlow * 0.28 + vActivity * 0.12
    );
    gl_FragColor = vec4(color, alpha);
  }
`

const ATMOSPHERE_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const ATMOSPHERE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uCenterOpacity;
  uniform float uEdgeOpacity;
  uniform float uEdgePower;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    float dotNV = dot(normalize(vViewPosition), normalize(vNormal));
    float edgeFactor = pow(max(0.0, 1.0 - abs(dotNV)), uEdgePower);
    float alpha = mix(uCenterOpacity, uEdgeOpacity, edgeFactor);

    gl_FragColor = vec4(uColor, alpha);
  }
`

const NODE_HALO_VERTEX_SHADER = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const NODE_HALO_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormal;
  void main() {
    float intensity = max(0.0, dot(vNormal, vec3(0.0, 0.0, 1.0)));
    float fade = pow(intensity, 1.5);
    gl_FragColor = vec4(uColor, fade * uOpacity);
  }
`

const WIREFRAME_VERTEX_SHADER = `
  varying float vLatitude;
  void main() {
    vLatitude = abs(normalize(position).y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const WIREFRAME_FRAGMENT_SHADER = `
  varying float vLatitude;
  void main() {
    float fade = smoothstep(0.56, 0.93, vLatitude);
    float alpha = 0.028 * (1.0 - fade);
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(0.18, 0.25, 0.36, alpha);
  }
`

const NODE_HALO_GEOMETRY = new THREE.SphereGeometry(1, 12, 12)
const NODE_PULSE_GEOMETRY = new THREE.SphereGeometry(1, 8, 8)
const ARC_PULSE_GEOMETRY = new THREE.SphereGeometry(1, 10, 10)
const GLOBE_QUALITY = GLOBE_QUALITY_TUNING[FIXED_GLOBE_SETTINGS.qualityProfile]
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

function createSeededRandom(seed: number) {
  return () => {
    seed = Math.trunc(seed)
    seed = Math.trunc(seed + 0x6d2b79f5)
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function createLandDotsGeometry(maskImage: HTMLImageElement | null) {
  if (maskImage == null) {
    return new THREE.BufferGeometry()
  }

  const maskCanvas = document.createElement("canvas")
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true })

  if (maskContext == null) {
    return new THREE.BufferGeometry()
  }

  const width = maskImage.naturalWidth || maskImage.width
  const height = maskImage.naturalHeight || maskImage.height

  if (width === 0 || height === 0) {
    return new THREE.BufferGeometry()
  }

  maskCanvas.width = width
  maskCanvas.height = height
  maskContext.drawImage(maskImage, 0, 0, width, height)

  const pixelData = maskContext.getImageData(0, 0, width, height).data
  const positions: number[] = []
  const sizes: number[] = []
  const intensities: number[] = []
  const phases: number[] = []
  const activities: number[] = []
  const latitudeStep = 0.5 / FIXED_GLOBE_SETTINGS.landDotDensity
  const random = createSeededRandom(37)

  for (let lat = -62; lat <= 82; lat += latitudeStep) {
    const cosLat = Math.max(Math.cos(THREE.MathUtils.degToRad(lat)), 0.28)
    const longitudeStep = latitudeStep / cosLat

    for (let lng = -180; lng <= 180; lng += longitudeStep) {
      const jitteredLat = lat + (random() - 0.5) * latitudeStep * 0.62
      const jitteredLng = lng + (random() - 0.5) * longitudeStep * 0.38
      const x = Math.floor(((jitteredLng + 180) / 360) * (width - 1))
      const y = Math.floor(((90 - jitteredLat) / 180) * (height - 1))
      const pixelIndex = (y * width + x) * 4
      const brightness =
        (pixelData[pixelIndex]! +
          pixelData[pixelIndex + 1]! +
          pixelData[pixelIndex + 2]!) /
        3

      if (brightness > 112) {
        continue
      }

      if (random() < 0.004 + (brightness / 112) * 0.045) {
        continue
      }

      const point = latLngToVector3(
        jitteredLat,
        jitteredLng,
        EARTH_RADIUS + 0.0055 + random() * 0.0075
      )
      let activityScore = 0

      ACTIVITY_SOURCES.forEach((source) => {
        const distance = point.distanceTo(source.position)
        const influence = Math.max(0, 1 - distance / source.radius)

        activityScore += influence * influence * source.weight
      })
      const activity = 1 - Math.exp(-activityScore * 0.65)

      positions.push(point.x, point.y, point.z)
      sizes.push(0.78 + random() * 0.42)
      intensities.push(0.5 + random() * 0.5)
      phases.push(random() * Math.PI * 2)
      activities.push(activity)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  )
  geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute(
    "intensity",
    new THREE.Float32BufferAttribute(intensities, 1)
  )
  geometry.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute(
    "activity",
    new THREE.Float32BufferAttribute(activities, 1)
  )
  geometry.computeBoundingSphere()

  return geometry
}

function DotGlobe() {
  const maskTexture = useTexture("/images/globe/earth-specular.jpg")
  const hotspotMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const image =
      typeof HTMLImageElement !== "undefined" &&
      maskTexture.image instanceof HTMLImageElement
        ? maskTexture.image
        : null

    return createLandDotsGeometry(image)
  }, [maskTexture.image])
  const uniforms = useMemo(
    () => ({
      uBaseColor: { value: new THREE.Color("#d7ebff") },
      uHighlightColor: { value: new THREE.Color("#ffffff") },
      uSizeScale: { value: FIXED_GLOBE_SETTINGS.landDotSize },
    }),
    []
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  useFrame(({ clock }) => {
    const hotspotTimeUniform = hotspotMaterialRef.current?.uniforms.uTime

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
          transparent
          uniforms={uniforms}
          vertexShader={LAND_DOT_VERTEX_SHADER}
        />
      </points>

      <points geometry={geometry}>
        <shaderMaterial
          ref={hotspotMaterialRef}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={HOTSPOT_FRAGMENT_SHADER}
          transparent
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={HOTSPOT_VERTEX_SHADER}
        />
      </points>
    </>
  )
}

function GlobeShell() {
  const atmosphereUniforms = useMemo(
    () => ({
      uCenterOpacity: { value: 0 },
      uColor: { value: new THREE.Color("#547796") },
      uEdgeOpacity: { value: 0.017 * FIXED_GLOBE_SETTINGS.atmosphereOpacity },
      uEdgePower: { value: 2.9 },
    }),
    []
  )
  const outerAtmosphereUniforms = useMemo(
    () => ({
      uCenterOpacity: { value: 0 },
      uColor: { value: new THREE.Color("#6a8fb3") },
      uEdgeOpacity: { value: 0.006 * FIXED_GLOBE_SETTINGS.atmosphereOpacity },
      uEdgePower: { value: 1.9 },
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

      <mesh scale={1.02}>
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
          fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
          side={THREE.BackSide}
          transparent
          uniforms={atmosphereUniforms}
          vertexShader={ATMOSPHERE_VERTEX_SHADER}
        />
      </mesh>

      <mesh scale={1.048}>
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
          fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
          side={THREE.BackSide}
          transparent
          uniforms={outerAtmosphereUniforms}
          vertexShader={ATMOSPHERE_VERTEX_SHADER}
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
  const haloRef = useRef<THREE.Mesh>(null)
  const outerHaloRef = useRef<THREE.Mesh>(null)
  const pulseRef = useRef<THREE.Mesh>(null)
  const glowIntensity = FIXED_GLOBE_SETTINGS.nodeGlow
  const haloBaseScale = light.size * (prominent ? 1.28 : 0.9)
  const outerHaloBaseScale = light.size * (prominent ? 2.4 : 1.48)
  const pulseBaseScale = light.size * (prominent ? 0.32 : 0.19)

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(prominent ? "#6bf4ff" : "#5cb8ff") },
      uOpacity: { value: 0.11 * glowIntensity },
    }),
    [glowIntensity, prominent]
  )
  const outerUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(prominent ? "#8ff6ff" : "#69c4ff") },
      uOpacity: { value: 0.075 * glowIntensity },
    }),
    [glowIntensity, prominent]
  )

  useFrame(({ clock }) => {
    const pulse =
      0.58 +
      0.42 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.9 + light.phase))

    if (haloRef.current != null) {
      haloRef.current.scale.setScalar(
        haloBaseScale * (0.92 + pulse * (prominent ? 0.48 : 0.24))
      )
      const mat = haloRef.current.material as THREE.ShaderMaterial
      if (mat.uniforms?.uOpacity != null) {
        mat.uniforms.uOpacity.value =
          (0.05 + pulse * (prominent ? 0.11 : 0.04)) * glowIntensity
      }
    }

    if (outerHaloRef.current != null) {
      outerHaloRef.current.scale.setScalar(
        outerHaloBaseScale * (1 + pulse * (prominent ? 0.7 : 0.34))
      )
      const mat = outerHaloRef.current.material as THREE.ShaderMaterial
      if (mat.uniforms?.uOpacity != null) {
        mat.uniforms.uOpacity.value =
          (0.034 + pulse * (prominent ? 0.085 : 0.03)) * glowIntensity
      }
    }

    if (pulseRef.current != null) {
      pulseRef.current.scale.setScalar(pulseBaseScale * (0.92 + pulse * 0.26))
      ;(pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
        (0.8 + pulse * 0.38) * glowIntensity
    }
  })

  return (
    <group position={light.position}>
      <mesh geometry={NODE_HALO_GEOMETRY} ref={outerHaloRef}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={NODE_HALO_FRAGMENT_SHADER}
          transparent
          uniforms={outerUniforms}
          vertexShader={NODE_HALO_VERTEX_SHADER}
        />
      </mesh>

      <mesh geometry={NODE_HALO_GEOMETRY} ref={haloRef}>
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={NODE_HALO_FRAGMENT_SHADER}
          transparent
          uniforms={uniforms}
          vertexShader={NODE_HALO_VERTEX_SHADER}
        />
      </mesh>

      <mesh geometry={NODE_PULSE_GEOMETRY} ref={pulseRef}>
        <meshBasicMaterial
          color="#ffffff"
          opacity={0.5 * glowIntensity}
          toneMapped={false}
          transparent
        />
      </mesh>
    </group>
  )
}

function ArcPulse({ route }: { readonly route: ArcRoute }) {
  const pulseRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (pulseRef.current == null) {
      return
    }

    const progress = (clock.elapsedTime * 0.06 + route.phase) % 1
    const point = route.curve.getPointAt(progress)
    const pulse =
      0.6 + 0.4 * Math.sin(clock.elapsedTime * 1.2 + route.phase * 10)

    pulseRef.current.position.copy(point)
    pulseRef.current.scale.setScalar(0.0052 * (0.85 + pulse * 0.35))
  })

  return (
    <mesh geometry={ARC_PULSE_GEOMETRY} ref={pulseRef}>
      <meshBasicMaterial
        color="#aaddff"
        opacity={Math.min(0.24, FIXED_GLOBE_SETTINGS.arcOpacity * 1.5)}
        toneMapped={false}
        transparent
      />
    </mesh>
  )
}

function KnowledgeArc({
  points,
  route,
}: {
  readonly points: THREE.Vector3[]
  readonly route: ArcRoute
}) {
  return (
    <group>
      <Line
        color={route.color}
        lineWidth={0.002}
        opacity={FIXED_GLOBE_SETTINGS.arcOpacity}
        points={points}
        transparent
        worldUnits
      />
      <ArcPulse route={route} />
    </group>
  )
}

function GlobeScene() {
  return (
    <>
      <color args={["#020408"]} attach="background" />

      <ambientLight intensity={FIXED_GLOBE_SETTINGS.ambientLight} />
      <hemisphereLight
        color="#eef8ff"
        groundColor="#050814"
        intensity={FIXED_GLOBE_SETTINGS.ambientLight * 1.46}
      />
      <directionalLight
        color="#f4fbff"
        intensity={FIXED_GLOBE_SETTINGS.directionalLight}
        position={[5, 4, 8]}
      />
      <pointLight
        color="#6fa6ff"
        intensity={FIXED_GLOBE_SETTINGS.pointLight}
        position={[-7, -2, -10]}
      />

      <Stars
        count={FIXED_GLOBE_SETTINGS.starCount}
        depth={60}
        factor={2.4}
        radius={100}
        saturation={0}
        speed={0}
      />

      <group
        position={[-0.02, FIXED_GLOBE_SETTINGS.globeY, 0]}
        scale={FIXED_GLOBE_SETTINGS.globeScale}
      >
        <group
          rotation={[
            THREE.MathUtils.degToRad(FIXED_GLOBE_SETTINGS.globePitch),
            THREE.MathUtils.degToRad(FIXED_GLOBE_SETTINGS.globeYaw),
            EARTH_TILT,
          ]}
        >
          <GlobeShell />
          <DotGlobe />

          {RENDERED_ARC_ROUTES.map(({ points, route }) => (
            <KnowledgeArc
              key={`${route.phase}-${route.color}`}
              points={points}
              route={route}
            />
          ))}

          {KNOWLEDGE_LIGHTS.map((light) => (
            <KnowledgeNode key={`${light.phase}-${light.size}`} light={light} />
          ))}

          {HUB_MARKERS.map((light) => (
            <KnowledgeNode
              key={`hub-${light.phase}-${light.size}`}
              light={light}
              prominent
            />
          ))}
        </group>
      </group>

      <OrbitControls
        autoRotate
        autoRotateSpeed={FIXED_GLOBE_SETTINGS.autoRotateSpeed}
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI * 0.7}
        minPolarAngle={Math.PI * 0.34}
        rotateSpeed={0.34}
      />

      <EffectComposer enableNormalPass={false} multisampling={0}>
        <Bloom
          intensity={0.26}
          luminanceSmoothing={0.8}
          luminanceThreshold={0.6}
          mipmapBlur
        />
      </EffectComposer>
    </>
  )
}

export function KnowledgeGlobeCanvas({
  className,
}: {
  readonly className?: string
}) {
  return (
    <div className={cn("relative h-full w-full", className)}>
      <Canvas
        camera={{
          fov: FIXED_GLOBE_SETTINGS.cameraFov,
          position: [0, 0.06, FIXED_GLOBE_SETTINGS.cameraZ],
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
          <GlobeScene />
        </Suspense>
      </Canvas>
    </div>
  )
}

useTexture.preload("/images/globe/earth-specular.jpg")

export default KnowledgeGlobeCanvas
