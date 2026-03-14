"use client"

/* eslint-disable react/no-unknown-property */

import { OrbitControls, Stars, useTexture } from "@react-three/drei"
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
    float alpha = (halo * 0.45 + core * 1.2) * (0.34 + vIntensity * 0.28);
    vec3 color =
      mix(uBaseColor, uHighlightColor, core * 0.22 + vIntensity * 0.18) *
      (1.0 + halo * 0.08);

    alpha *= 1.5;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

const LAND_GLOW_VERTEX_SHADER = `
  attribute float activity;
  attribute float intensity;
  attribute float phase;
  attribute float size;

  uniform float uSizeScale;
  uniform float uTime;

  varying float vActivity;
  varying float vIntensity;
  varying float vShimmer;

  void main() {
    vec3 direction = normalize(position);
    float shimmer =
      0.975 +
      0.05 * sin(uTime * 0.22 + phase * 0.93) +
      0.018 * sin(uTime * 0.11 + phase * 1.71 + intensity * 2.4);

    float activityMask = smoothstep(0.14, 0.74, activity);
    float densityMask = smoothstep(0.48, 0.92, intensity * 0.42 + activity * 0.88);

    vec3 glowPosition = position + direction * (0.0038 + activityMask * 0.0054);
    vec4 mvPosition = modelViewMatrix * vec4(glowPosition, 1.0);

    vActivity = activity;
    vIntensity = intensity;
    vShimmer = shimmer;

    float cloudSize = 0.92 + activityMask * 0.9 + densityMask * 0.35;

    gl_PointSize =
      size *
      uSizeScale *
      cloudSize *
      shimmer *
      (122.0 / -mvPosition.z) *
      0.82;

    gl_Position = projectionMatrix * mvPosition;
  }
`

const LAND_GLOW_FRAGMENT_SHADER = `
  uniform vec3 uGlowColor;

  varying float vActivity;
  varying float vIntensity;
  varying float vShimmer;

  void main() {
    vec2 centeredUv = gl_PointCoord - vec2(0.5);
    float radius = length(centeredUv) * 2.0;

    float broadGlow = exp(-radius * radius * 2.2);
    float midGlow = exp(-radius * radius * 4.8);
    float coreGlow = exp(-radius * radius * 8.2);

    float clusterMask =
      smoothstep(0.16, 0.72, vActivity) *
      smoothstep(0.54, 0.96, vIntensity + vActivity * 0.34);

    float alpha =
      (broadGlow * 0.03 + midGlow * 0.015 + coreGlow * 0.004) *
      (0.78 + vIntensity * 0.24) *
      (0.72 + vActivity * 0.48) *
      clusterMask *
      vShimmer;

    if (alpha < 0.001) discard;

    vec3 color = uGlowColor * (0.9 + vActivity * 0.2);
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
        perlinNoise(position.xy * 1.25 + vec2(uTime * 0.32, -uTime * 0.24));
    float sweep =
      0.5 + 0.5 * sin(longitude * 2.4 - uTime * 0.92 + localNoise * 2.0);
    float latitudeBand =
      0.5 + 0.5 * sin(latitude * 2.0 + uTime * 0.28 + localNoise * 1.6);
    float wave = clamp(localNoise * 0.55 + sweep * 0.28 + latitudeBand * 0.17, 0.0, 1.0);
    float pulse =
      0.5 + 0.5 * sin(uTime * 1.5 + phase * 1.4 + localNoise * 2.4);
    float baseField = smoothstep(0.48, 0.82, wave);
    float glow =
      clamp((baseField * 0.55 + busyField * (0.22 + pulse * 0.78)) * 1.4, 0.0, 1.4);

    vec3 animatedPosition = position + direction * (0.004 + baseField * 0.006 + busyField * 0.01);
    vec4 mvPosition = modelViewMatrix * vec4(animatedPosition, 1.0);

    vActivity = busyField;
    vGlow = glow;
    vWave = wave;

    float hotspotSize = size * (0.22 + baseField * 0.62 + busyField * 0.7 + glow * 1.2);
    gl_PointSize = hotspotSize * (124.0 / -mvPosition.z) * 0.68;
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
      halo * (baseGlow * 0.09 + vActivity * 0.1) +
      core * (baseGlow * 0.26 + vGlow * 0.56);

    alpha *= 1.72;

    if (alpha < 0.02) discard;

    vec3 color = mix(
      vec3(0.38, 0.72, 1.0),
      vec3(1.0),
      core * 0.55 + vGlow * 0.28 + vActivity * 0.12
    );
    gl_FragColor = vec4(color, alpha);
  }
`

// GitHub-style halo: intensity = pow(max(0, c - dot(N, V)), p)
// Rendered BackSide so Three.js flips normals — fragments near the limb
// have near-zero dot product, producing the rim glow. The inner sphere gives
// a crisp terminator edge; the outer sphere gives the wide ambient halo.
const HALO_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const HALO_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uC;
  uniform float uP;
  uniform float uOpacity;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 normal   = normalize(vNormal);
    vec3 viewDir  = normalize(vViewPosition);
    float fresnel = dot(normal, viewDir);
    // pow(max(0, c - fresnel), p): 0 where surface faces camera, glows at limb
    float intensity = pow(max(0.0, uC - fresnel), uP);
    float alpha = intensity * uOpacity;
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(uColor * intensity, alpha);
  }
`

const NODE_GLOW_VERTEX_SHADER = `
  uniform vec3 uCameraPosition;

  varying vec2 vUv;
  varying float vOcclusion;

  void main() {
    vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
    vec3 toCamera = normalize(uCameraPosition - center);
    vec3 planetDir = normalize(center);

    vUv = uv;
    vOcclusion = dot(toCamera, planetDir);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const NODE_GLOW_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPlanetRadius;

  varying vec2 vUv;
  varying float vOcclusion;

  void main() {
    vec2 centeredUv = vUv - vec2(0.5);
    float distanceToCenter = length(centeredUv) * 1.92;
    float broadGlow = exp(-distanceToCenter * distanceToCenter * 1.24);
    float softCenter = exp(-distanceToCenter * distanceToCenter * 3.4);
    float visibility = smoothstep(-0.04 - uPlanetRadius * 0.018, 0.06, vOcclusion);
    float alpha = (broadGlow * 0.88 + softCenter * 0.14) * uOpacity * visibility;

    if (alpha < 0.002) discard;

    gl_FragColor = vec4(uColor, alpha);
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
    float fade = smoothstep(0.52, 0.93, vLatitude);
    float alpha = 0.023 * (1.0 - fade);
    if (alpha < 0.0035) discard;
    gl_FragColor = vec4(0.18, 0.25, 0.36, alpha);
  }
`

const NODE_GLOW_GEOMETRY = new THREE.PlaneGeometry(1, 1)
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

function createLandGlowGeometry(sourceGeometry: THREE.BufferGeometry) {
  const positionAttribute = sourceGeometry.getAttribute(
    "position"
  ) as THREE.BufferAttribute | null
  const sizeAttribute = sourceGeometry.getAttribute(
    "size"
  ) as THREE.BufferAttribute | null
  const intensityAttribute = sourceGeometry.getAttribute(
    "intensity"
  ) as THREE.BufferAttribute | null
  const phaseAttribute = sourceGeometry.getAttribute(
    "phase"
  ) as THREE.BufferAttribute | null
  const activityAttribute = sourceGeometry.getAttribute(
    "activity"
  ) as THREE.BufferAttribute | null

  if (
    positionAttribute == null ||
    sizeAttribute == null ||
    intensityAttribute == null ||
    phaseAttribute == null ||
    activityAttribute == null
  ) {
    return new THREE.BufferGeometry()
  }

  const positions: number[] = []
  const sizes: number[] = []
  const intensities: number[] = []
  const phases: number[] = []
  const activities: number[] = []
  const random = createSeededRandom(913)

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const activity = activityAttribute.getX(index)
    const intensity = intensityAttribute.getX(index)
    const weight =
      activity * 0.82 + Math.max(0, intensity - 0.62) * 0.72 + intensity * 0.1

    if (weight < 0.24) {
      continue
    }

    const sampleChance = THREE.MathUtils.clamp(0.16 + weight * 0.42, 0.18, 0.6)

    if (random() > sampleChance) {
      continue
    }

    positions.push(
      positionAttribute.getX(index),
      positionAttribute.getY(index),
      positionAttribute.getZ(index)
    )
    sizes.push(sizeAttribute.getX(index) * (1.35 + activity * 0.5))
    intensities.push(intensity)
    phases.push(phaseAttribute.getX(index))
    activities.push(activity)
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
  const glowMaterialRef = useRef<THREE.ShaderMaterial>(null)
  const hotspotMaterialRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => {
    const image =
      typeof HTMLImageElement !== "undefined" &&
      maskTexture.image instanceof HTMLImageElement
        ? maskTexture.image
        : null

    return createLandDotsGeometry(image)
  }, [maskTexture.image])

  const glowGeometry = useMemo(
    () => createLandGlowGeometry(geometry),
    [geometry]
  )

  const uniforms = useMemo(
    () => ({
      uBaseColor: { value: new THREE.Color("#c3d8ee") },
      uHighlightColor: { value: new THREE.Color("#f7fbff") },
      uSizeScale: { value: FIXED_GLOBE_SETTINGS.landDotSize * 1.04 },
    }),
    []
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
            uSizeScale: { value: FIXED_GLOBE_SETTINGS.landDotSize * 1.18 },
            uTime: { value: 0 },
          }}
          vertexShader={LAND_GLOW_VERTEX_SHADER}
        />
      </points>

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
    </>
  )
}

function GlobeShell() {
  // Inner rim: thin bright terminator line at the globe edge.
  const rimUniforms = useMemo(
    () => ({
      uC: { value: 0.64 },
      uP: { value: 7 },
      uColor: { value: new THREE.Color("#7ec8f0") },
      uOpacity: { value: 0.38 * FIXED_GLOBE_SETTINGS.atmosphereOpacity },
    }),
    []
  )

  // Outer halo: soft ambient glow just beyond the rim.
  const haloUniforms = useMemo(
    () => ({
      uC: { value: 0.68 },
      uP: { value: 4.5 },
      uColor: { value: new THREE.Color("#112040") },
      uOpacity: { value: 0.22 * FIXED_GLOBE_SETTINGS.atmosphereOpacity },
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

      {/* Inner rim — tight Fresnel glow at the very edge of the globe */}
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

      {/* Outer halo — soft ambient glow just beyond the rim */}
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
  const glowIntensity = FIXED_GLOBE_SETTINGS.nodeGlow
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
  const worldPulsePosition = useMemo(() => new THREE.Vector3(), [])
  const worldCenter = useMemo(() => new THREE.Vector3(), [])
  const worldScale = useMemo(() => new THREE.Vector3(), [])
  const segmentVector = useMemo(() => new THREE.Vector3(), [])
  const centerOffset = useMemo(() => new THREE.Vector3(), [])
  const closestPoint = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ camera, clock }) => {
    if (pulseRef.current == null) {
      return
    }

    const progress = (clock.elapsedTime * 0.06 + route.phase) % 1
    const point = route.curve.getPointAt(progress)
    const pulse =
      0.6 + 0.4 * Math.sin(clock.elapsedTime * 1.2 + route.phase * 10)

    pulseRef.current.position.copy(point)
    pulseRef.current.scale.setScalar(0.0072 * (0.84 + pulse * 0.24))
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
      0.15 * visibility
  })

  return (
    <mesh geometry={ARC_PULSE_GEOMETRY} ref={pulseRef}>
      <meshBasicMaterial
        blending={THREE.AdditiveBlending}
        color="#7fdfff"
        depthTest={false}
        depthWrite={false}
        opacity={0.15}
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
    const lineOpacity = THREE.MathUtils.lerp(0.04, 0.34, averageVisibility)
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

function GlobeScene() {
  return (
    <>
      <color args={["#02040a"]} attach="background" />

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
          intensity={1.1}
          luminanceSmoothing={0.76}
          luminanceThreshold={0.18}
          mipmapBlur
          radius={0.72}
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
