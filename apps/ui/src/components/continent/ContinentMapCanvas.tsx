"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"

// ── Constants ──────────────────────────────────────────────────────────────

const FREQ = 100 // dots per canvas-height unit
// uZoomY = height/width is computed at runtime — both axes advance through
// the texture at the same texel-per-pixel rate (no distortion).
// To reveal more of the continent, increase the section height in
// ContinentDetailPage (the larger H/W ratio = more texture height shown).

// ── Shaders ────────────────────────────────────────────────────────────────
//
// Dot-shape convention mirrors gl_PointCoord:
//   distNorm = length(local) / 2.0
//     → 0.0 at dot centre
//     → 0.5 at cell edge   (matches gl_PointCoord distance from centre)
//     → 0.707 at cell corner
//
//   halo = smoothstep(0.50, 0.08, distNorm)  outer edge at exactly the cell
//   boundary so halos of adjacent dots just touch without filling corners.
//
//   core = smoothstep(0.14, 0.0, distNorm)   tight bright centre.
//
// Alpha is driven almost entirely by the Perlin-noise wave so brightness
// pulses visibly over time.  The globe HOTSPOT formula is used verbatim.

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */ `
  uniform sampler2D uSpecular;
  uniform float     uTime;
  uniform float     uAspect;
  uniform float     uZoomY;  // H/W — keeps texels square in both axes
  uniform float     uFreq;

  varying vec2 vUv;

  // ── Perlin noise — identical to globe HOTSPOT vertex shader ───────────────
  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }
  float perlin(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float d00 = dot(hash(i),             f);
    float d10 = dot(hash(i + vec2(1,0)), f - vec2(1,0));
    float d01 = dot(hash(i + vec2(0,1)), f - vec2(0,1));
    float d11 = dot(hash(i + vec2(1,1)), f - vec2(1,1));
    return mix(mix(d00, d10, u.x), mix(d01, d11, u.x), u.y);
  }

  // Canvas UV → texture UV  (full-width x, centred zoom y)
  vec2 toTex(vec2 cv) {
    return vec2(cv.x, (cv.y - 0.5) * uZoomY + 0.5);
  }

  void main() {
    // ── Aspect-corrected dot grid ──────────────────────────────────────────
    // Scaling x by uAspect makes each cell square in screen-pixels.
    vec2 grid  = vec2(vUv.x * uAspect * uFreq, vUv.y * uFreq);
    vec2 cell  = floor(grid);
    // local: −1…1 in both axes (cell-normalised)
    vec2 local = (fract(grid) - 0.5) * 2.0;

    // Cell centre in canvas UV → texture UV
    vec2 cCvs = (cell + 0.5) / vec2(uAspect * uFreq, uFreq);
    vec2 cTex = toTex(cCvs);

    // ── Land mask (specular PNG: solid white = land, transparent = ocean) ──
    float land = 0.0;
    if (cTex.y >= 0.0 && cTex.y <= 1.0) {
      land = texture2D(uSpecular, cTex).a;
    }
    float isLand = smoothstep(0.25, 0.65, land);

    // ── Dot shape ──────────────────────────────────────────────────────────
    // Normalise so 0.5 == cell edge — matches gl_PointCoord distance range.
    float distNorm = length(local) * 0.5;

    // halo outer edge = 0.50 (just touching cell boundary; no corner fill)
    float halo = smoothstep(0.50, 0.08, distNorm);
    // bright tight core
    float core = smoothstep(0.14, 0.0,  distNorm);

    // Discard pixels outside the halo circle entirely
    if (halo < 0.003) { gl_FragColor = vec4(0.0); return; }

    // Per-cell intensity jitter (hash → matches globe's per-point variation)
    float iv = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5);

    // ── Perlin-noise wave — verbatim globe HOTSPOT vertex logic ───────────
    vec2  fTex     = toTex(vUv);

    // Remap fTex to a ~3-unit space so noise frequency matches the globe
    // (globe uses position.xy * 1.25 where position ≈ −3.2…3.2)
    vec2  noisePos = (fTex - 0.5) * 6.4;

    float localNoise =
      0.5 + 0.5 * perlin(noisePos * 1.25 + vec2(uTime * 0.32, -uTime * 0.24));
    float sweep =
      0.5 + 0.5 * sin(fTex.x * 15.08 - uTime * 0.92 + localNoise * 2.0);
    float latBand =
      0.5 + 0.5 * sin(fTex.y * 12.57 + uTime * 0.28 + localNoise * 1.6);
    float wave    = clamp(localNoise * 0.55 + sweep * 0.28 + latBand * 0.17, 0.0, 1.0);
    float pulse   = 0.5 + 0.5 * sin(uTime * 1.5 + iv * 8.796 + localNoise * 2.4);

    float baseField = smoothstep(0.48, 0.82, wave);
    float glow      = clamp((baseField * 0.55 + isLand * (0.22 + pulse * 0.78)) * 1.4, 0.0, 1.4);

    // ── Alpha — HOTSPOT fragment formula ─────────────────────────────────
    // halo and core contributions weighted by wave + glow (= visible pulse)
    float alpha =
      halo * (baseField * 0.09 + isLand * 0.10) +
      core * (baseField * 0.26 + glow   * 0.56);
    alpha *= 1.72;

    // Ocean: same dots but very dim
    float oceanAlpha = (halo * 0.04 + core * 0.08);
    alpha = mix(oceanAlpha, alpha, isLand);

    if (alpha < 0.003) { gl_FragColor = vec4(0.0); return; }

    // ── Colour — exact globe palette ─────────────────────────────────────
    vec3 baseColor = vec3(0.38, 0.72, 1.0);
    vec3 hiColor   = vec3(0.90, 0.97, 1.0);
    vec3 color = mix(baseColor, hiColor, core * 0.22 + iv * 0.18);
    color *= 1.0 + halo * 0.08;
    // HOTSPOT tints toward white on active glow
    color = mix(color, vec3(1.0), core * 0.55 + glow * 0.28);

    gl_FragColor = vec4(color * alpha, alpha);
  }
`

const SPECULAR_SLUGS = new Set([
  "europe",
  "americas",
  "africa",
  "asia",
  "oceania",
])

export function ContinentMapCanvas({
  continentSlug,
  className,
}: {
  readonly continentSlug: string
  readonly className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || !SPECULAR_SLUGS.has(continentSlug)) return

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    const { width, height } = container.getBoundingClientRect()
    renderer.setSize(width, height, false)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const specular = new THREE.TextureLoader().load(
      `/images/globe/continent-${continentSlug}-specular.png`
    )
    specular.minFilter = THREE.LinearFilter
    specular.magFilter = THREE.LinearFilter

    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uSpecular: { value: specular },
        uTime: { value: 0 },
        uAspect: { value: width / height },
        uZoomY: { value: height / width },
        uFreq: { value: FREQ },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    const startTime = performance.now()
    let frameId: number

    function animate() {
      frameId = requestAnimationFrame(animate)
      material.uniforms.uTime!.value = (performance.now() - startTime) / 1000
      renderer.render(scene, camera)
    }
    animate()

    const observer = new ResizeObserver(() => {
      const { width: w, height: h } = container.getBoundingClientRect()
      renderer.setSize(w, h, false)
      material.uniforms.uAspect!.value = w / h
      material.uniforms.uZoomY!.value = h / w
    })
    observer.observe(container)

    return () => {
      cancelAnimationFrame(frameId)
      observer.disconnect()
      mesh.geometry.dispose()
      material.dispose()
      specular.dispose()
      renderer.dispose()
    }
  }, [continentSlug])

  if (!SPECULAR_SLUGS.has(continentSlug)) return null

  return (
    <div ref={containerRef} className={className}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
