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
import { cn } from "@/lib/styles"

const LAND_DOT_VERTEX_SHADER = `
  attribute float intensity;
  attribute float phase;
  attribute float size;

  uniform float uTime;

  varying float vIntensity;
  varying float vPulse;

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float perlinNoise(vec2 p) {
    vec2 i = floor(p); 
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    vec2 g00 = hash(i + vec2(0.0, 0.0)); vec2 g10 = hash(i + vec2(1.0, 0.0));
    vec2 g01 = hash(i + vec2(0.0, 1.0)); vec2 g11 = hash(i + vec2(1.0, 1.0));
    float d00 = dot(g00, f - vec2(0.0, 0.0)); float d10 = dot(g10, f - vec2(1.0, 0.0));
    float d01 = dot(g01, f - vec2(0.0, 1.0)); float d11 = dot(g11, f - vec2(1.0, 1.0));
    return mix(mix(d00, d10, u.x), mix(d01, d11, u.x), u.y);
  }

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    // A sweeping band of light across the globe (longitude based sweep)
    float longitude = atan(position.z, position.x);
    float sweep = sin(longitude * 2.0 - uTime * 0.8);
    
    // Large slow noise patches to make it feel organic and random
    float noisePhase = uTime * 0.3;
    float globalNoise = perlinNoise(position.xy * 1.5 + vec2(noisePhase));
    
    // Combine base phase pulse, sweeping band, and sweeping noise
    float basePulse = 0.5 + 0.5 * sin(uTime * 1.2 + phase);
    float animatedGlow = smoothstep(0.0, 1.2, sweep * 0.5 + globalNoise * 0.6 + basePulse * 0.2);
    
    float pulse = animatedGlow;

    vIntensity = intensity;
    vPulse = pulse;

    // Expand size significantly when glowing, subtly when not
    float sizeFactor = 0.5 + (1.3 * animatedGlow);
    gl_PointSize = size * sizeFactor * (124.0 / -mvPosition.z) * 0.55;
    gl_Position = projectionMatrix * mvPosition;
  }
`

const LAND_DOT_FRAGMENT_SHADER = `
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;

  varying float vIntensity;
  varying float vPulse;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float halo = smoothstep(0.5, 0.1, distanceToCenter);
    float core = smoothstep(0.15, 0.0, distanceToCenter);

    float alpha = halo * (vIntensity * 0.35) + core * 1.2;
    
    // The higher the pulse, the closer to pure white they get
    vec3 color = mix(uBaseColor, uHighlightColor, core + vPulse * 0.8);

    gl_FragColor = vec4(color, alpha * (0.3 + vPulse * 0.9));
  }
`

const ATMOSPHERE_VERTEX_SHADER = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const ATMOSPHERE_FRAGMENT_SHADER = `
  varying vec3 vNormal;
  void main() {
    float rim = 1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0)));
    float intensity = pow(rim, 14.0);
    gl_FragColor = vec4(0.3, 0.65, 1.0, intensity * 0.1);
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
    float fade = smoothstep(0.6, 0.92, vLatitude);
    float alpha = 0.055 * (1.0 - fade);
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(0.22, 0.3, 0.42, alpha);
  }
`

function createSeededRandom(seed: number) {
  return () => {
    seed = Math.trunc(seed)
    seed = Math.trunc(seed + 0x6d2b79f5)
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function createLandDotsGeometry(maskImage: HTMLImageElement) {
  const maskCanvas = document.createElement("canvas")
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true })

  if (maskContext == null) {
    return new THREE.BufferGeometry()
  }

  const width = maskImage.naturalWidth || maskImage.width
  const height = maskImage.naturalHeight || maskImage.height

  maskCanvas.width = width
  maskCanvas.height = height
  maskContext.drawImage(maskImage, 0, 0, width, height)

  const pixelData = maskContext.getImageData(0, 0, width, height).data
  const positions: number[] = []
  const sizes: number[] = []
  const intensities: number[] = []
  const phases: number[] = []
  const random = createSeededRandom(37)

  for (let lat = -62; lat <= 82; lat += 0.65) {
    const cosLat = Math.max(Math.cos(THREE.MathUtils.degToRad(lat)), 0.28)
    const longitudeStep = 0.65 / cosLat

    for (let lng = -180; lng <= 180; lng += longitudeStep) {
      const jitteredLat = lat + (random() - 0.5) * 0.38
      const jitteredLng = lng + (random() - 0.5) * longitudeStep * 0.42
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

      if (random() < 0.01 + (brightness / 112) * 0.08) {
        continue
      }

      const point = latLngToVector3(
        jitteredLat,
        jitteredLng,
        EARTH_RADIUS + 0.008 + random() * 0.012
      )

      positions.push(point.x, point.y, point.z)
      sizes.push(1 + random() * 0.7)
      intensities.push(0.5 + random() * 0.5)
      phases.push(random() * Math.PI * 2)
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
  geometry.computeBoundingSphere()

  return geometry
}

function DotGlobe() {
  const maskTexture = useTexture("/images/globe/earth-specular.jpg")
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    return createLandDotsGeometry(maskTexture.image as HTMLImageElement)
  }, [maskTexture.image])
  const uniforms = useMemo(
    () => ({
      uBaseColor: { value: new THREE.Color("#8ab8e0") },
      uHighlightColor: { value: new THREE.Color("#ffffff") },
      uTime: { value: 0 },
    }),
    []
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
    }
  }, [geometry])

  useFrame(({ clock }) => {
    const timeUniform = materialRef.current?.uniforms.uTime

    if (timeUniform != null) {
      timeUniform.value = clock.elapsedTime
    }
  })

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        depthWrite={false}
        fragmentShader={LAND_DOT_FRAGMENT_SHADER}
        transparent
        uniforms={uniforms}
        vertexShader={LAND_DOT_VERTEX_SHADER}
      />
    </points>
  )
}

function GlobeShell() {
  return (
    <>
      {/* Internal shell to block backside nodes */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS - 0.02, 48, 48]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Wireframe shell with pole fade */}
      <mesh>
        <sphereGeometry args={[EARTH_RADIUS - 0.012, 96, 96]} />
        <shaderMaterial
          fragmentShader={WIREFRAME_FRAGMENT_SHADER}
          transparent
          vertexShader={WIREFRAME_VERTEX_SHADER}
          wireframe
        />
      </mesh>

      {/* Soft atmospheric rim light */}
      <mesh scale={1.045}>
        <sphereGeometry args={[EARTH_RADIUS, 48, 48]} />
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={ATMOSPHERE_FRAGMENT_SHADER}
          side={THREE.BackSide}
          transparent
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
  const pulseRef = useRef<THREE.Mesh>(null)

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(prominent ? "#6bf4ff" : "#5cb8ff") },
      uOpacity: { value: 0.15 },
    }),
    [prominent]
  )

  useFrame(({ clock }) => {
    const pulse =
      0.58 +
      0.42 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 0.9 + light.phase))

    if (haloRef.current != null) {
      haloRef.current.scale.setScalar(0.7 + pulse * (prominent ? 0.25 : 0.18))
      const mat = haloRef.current.material as THREE.ShaderMaterial
      if (mat.uniforms && mat.uniforms.uOpacity) {
        mat.uniforms.uOpacity.value = 0.06 + pulse * (prominent ? 0.1 : 0.05)
      }
    }

    if (pulseRef.current != null) {
      pulseRef.current.scale.setScalar(0.7 + pulse * 0.15)
      ;(pulseRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.5 + pulse * 0.3
    }
  })

  return (
    <group position={light.position}>
      <mesh ref={haloRef}>
        <sphereGeometry args={[light.size * (prominent ? 1.4 : 1.1), 16, 16]} />
        <shaderMaterial
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          fragmentShader={NODE_HALO_FRAGMENT_SHADER}
          transparent
          uniforms={uniforms}
          vertexShader={NODE_HALO_VERTEX_SHADER}
        />
      </mesh>

      <mesh ref={pulseRef}>
        <sphereGeometry args={[light.size * (prominent ? 0.4 : 0.3), 8, 8]} />
        <meshBasicMaterial
          color="#ffffff"
          opacity={0.7}
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
    pulseRef.current.scale.setScalar(0.85 + pulse * 0.35)
  })

  return (
    <mesh ref={pulseRef}>
      <sphereGeometry args={[0.007, 12, 12]} />
      <meshBasicMaterial
        color="#aaddff"
        opacity={0.25}
        toneMapped={false}
        transparent
      />
    </mesh>
  )
}

function KnowledgeArc({ route }: { readonly route: ArcRoute }) {
  return (
    <group>
      <Line
        color={route.color}
        lineWidth={0.002}
        opacity={0.18}
        points={route.linePoints}
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

      <ambientLight intensity={0.3} />
      <hemisphereLight color="#eef8ff" groundColor="#050814" intensity={0.44} />
      <directionalLight color="#f4fbff" intensity={0.82} position={[5, 4, 8]} />
      <pointLight color="#6fa6ff" intensity={4.2} position={[-7, -2, -10]} />

      <Stars
        count={2500}
        depth={60}
        factor={3.5}
        radius={100}
        saturation={0}
        speed={0}
      />

      <group position={[-0.02, -0.9, 0]} scale={0.76}>
        <group rotation={[0.28, -0.05, EARTH_TILT]}>
          <GlobeShell />
          <DotGlobe />

          {ARC_ROUTES.map((route) => (
            <KnowledgeArc key={`${route.phase}-${route.color}`} route={route} />
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
        autoRotateSpeed={0.14}
        dampingFactor={0.08}
        enableDamping
        enablePan={false}
        enableZoom={false}
        maxPolarAngle={Math.PI * 0.7}
        minPolarAngle={Math.PI * 0.34}
        rotateSpeed={0.34}
      />

      <EffectComposer enableNormalPass={false} multisampling={8}>
        <Bloom
          intensity={0.42}
          luminanceSmoothing={0.5}
          luminanceThreshold={0.42}
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
    <div className={cn("h-full w-full touch-none", className)}>
      <Canvas
        camera={{ fov: 20, position: [0, 0.06, 12.7] }}
        dpr={[1, 2]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
        }}
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
