import * as THREE from "three"

import type { GlobeNarrativeState } from "@/components/home/knowledge-globe-narrative"

export function createNarrativeUniforms(state: GlobeNarrativeState) {
  return {
    uNarrativeProgress: { value: state.progress },
    uNarrativeFocus: { value: state.focus },
    uNarrativeStep: { value: state.step },
    uNarrativeGrowth: { value: state.growth },
    uNarrativeFrameX: { value: state.frameX },
    uNarrativeFrameY: { value: state.frameY },
    uNarrativeFrameScale: { value: state.frameScale },
    uNarrativeAspect: { value: state.frameAspect },
    uNarrativePaper: { value: state.paper },
    uNarrativeOpacity: { value: state.opacity },
    uNarrativeWorldAlpha: {
      value: 1 - THREE.MathUtils.smoothstep(state.progress, 1, 1.9),
    },
    uNarrativeCenter: { value: new THREE.Vector3() },
    uNarrativeScale: { value: 1 },
  }
}

export type NarrativeUniforms = ReturnType<typeof createNarrativeUniforms>

/** World-only glow/surface shaders share a fade instead of disappearing at a
 * chapter boundary. Their depth writes are released by the scene on unfold. */
export function fadeNarrativeWorldMaterial(
  material: THREE.ShaderMaterial,
  alpha: THREE.IUniform<number>
) {
  const original = material.fragmentShader
  const originalTransparent = material.transparent
  material.uniforms.uNarrativeWorldAlpha = alpha
  material.fragmentShader =
    "uniform float uNarrativeWorldAlpha;\n" +
    original.replace(/}\s*$/, "gl_FragColor.a *= uNarrativeWorldAlpha;\n}")
  material.transparent = true
  material.needsUpdate = true

  return () => {
    material.fragmentShader = original
    delete material.uniforms.uNarrativeWorldAlpha
    material.transparent = originalTransparent
    material.needsUpdate = true
  }
}

/** One small stable attribute, rather than six copies of every point position.
 * A point's real geographic position remains available for the unfolded map. */
export function addNarrativeIndex(geometry: THREE.BufferGeometry) {
  const count = geometry.getAttribute("position")?.count ?? 0
  const indices = new Float32Array(count)
  for (let i = 0; i < count; i++) indices[i] = i
  geometry.setAttribute(
    "aNarrativeIndex",
    new THREE.BufferAttribute(indices, 1)
  )

  return geometry
}

const NARRATIVE_VERTEX = `
  attribute float aNarrativeIndex;
  uniform float uNarrativeProgress;
  uniform float uNarrativeFocus;
  uniform float uNarrativeStep;
  uniform float uNarrativeGrowth;
  uniform float uNarrativeAspect;
  uniform float uNarrativeLayer;
  uniform vec3 uNarrativeCenter;
  uniform float uNarrativeScale;
  varying float vNarrativeWeight;
  varying float vNarrativeEmphasis;
  varying float vNarrativeBlend;

  vec2 narrativeRectangle(float fraction, vec2 halfSize) {
    float edge = min(floor(fraction * 4.0), 3.0);
    float t = fract(fraction * 4.0);
    if (edge < 0.5) return vec2(mix(-halfSize.x, halfSize.x, t), halfSize.y);
    if (edge < 1.5) return vec2(halfSize.x, mix(halfSize.y, -halfSize.y, t));
    if (edge < 2.5) return vec2(mix(halfSize.x, -halfSize.x, t), -halfSize.y);
    return vec2(-halfSize.x, mix(-halfSize.y, halfSize.y, t));
  }

  vec2 narrativeTypeGlyph(float kind, float sampleIndex) {
    float t = sampleIndex / 56.0;
    if (kind < 0.5) return narrativeRectangle(t, vec2(0.23, 0.15));
    if (kind < 1.5) {
      float side = step(0.5, t);
      float u = fract(t * 2.0);
      return vec2(mix(-0.23, 0.23, side) * u, 0.12 - u * 0.22);
    }
    if (kind < 2.5) {
      float pillar = mod(sampleIndex, 5.0);
      return vec2((pillar - 2.0) * 0.1, mix(-0.16, 0.16, floor(sampleIndex / 5.0) / 11.0));
    }
    if (kind < 3.5) {
      float stack = mod(sampleIndex, 3.0);
      return narrativeRectangle(fract(floor(sampleIndex / 3.0) / 19.0), vec2(0.21, 0.07)) + vec2(stack * 0.035 - 0.035, stack * 0.11 - 0.11);
    }
    if (kind < 4.5) {
      float angle = t * 3.141592654;
      return vec2(cos(angle) * 0.2, sin(angle) * 0.26 - 0.13);
    }
    if (kind < 5.5) {
      if (sampleIndex < 40.0) return narrativeRectangle(sampleIndex / 40.0, vec2(0.24, 0.11));
      float wheel = step(48.0, sampleIndex);
      float angle = mod(sampleIndex - 40.0, 8.0) / 8.0 * 6.283185307;
      return vec2(mix(-0.15, 0.15, wheel), -0.14) + vec2(cos(angle), sin(angle)) * 0.045;
    }
    float column = mod(sampleIndex, 7.0);
    float row = floor(sampleIndex / 7.0);
    return vec2((column - 3.0) * 0.055, (row - 3.5) * 0.045);
  }

  float narrativeLayerWeight(float chapter) {
    // Preserve all geographic samples and the actual marker coordinates for
    // the world/map. The schematic chapters use one bounded particle layer.
    if (chapter < 1.5 || (chapter > 3.5 && chapter < 4.5)) return 1.0;
    if (uNarrativeLayer > 0.5) return 0.0;
    float limit = 1400.0;
    if (chapter > 2.5 && chapter < 3.5) limit = 1560.0;
    if (chapter > 4.5 && chapter < 5.5) limit = 1800.0;
    if (chapter > 5.5) limit = 1536.0;
    return 1.0 - step(limit, aNarrativeIndex);
  }

  vec3 narrativeTarget(float chapter, vec3 geographicPosition) {
    float index = aNarrativeIndex;
    if (chapter < 2.5) {
      index = mod(index, 1400.0);
      // Six clean context glyphs connected to a small central index.
      float cluster = mod(index, 7.0);
      vec2 anchor = vec2(0.17, 0.24);
      if (cluster > 0.5) anchor = vec2(0.68, 0.14);
      if (cluster > 1.5) anchor = vec2(0.79, 0.47);
      if (cluster > 2.5) anchor = vec2(0.22, 0.60);
      if (cluster > 3.5) anchor = vec2(0.52, 0.86);
      if (cluster > 4.5) anchor = vec2(0.84, 0.82);
      if (cluster > 5.5) anchor = vec2(0.48, 0.52);
      vec2 center = vec2((anchor.x - 0.5) * 6.4 * uNarrativeAspect, (0.5 - anchor.y) * 6.4);
      float sampleIndex = floor(index / 7.0);
      vec2 local;
      if (sampleIndex < 144.0) {
        float angle = sampleIndex / 144.0 * 6.283185307;
        local = vec2(cos(angle), sin(angle)) * 0.43;
      } else local = narrativeTypeGlyph(cluster, sampleIndex - 144.0);
      return vec3(center + local, 0.0);
    }
    if (chapter < 3.5) {
      index = mod(index, 1560.0);
      // A single front-facing record: perimeter, heading, then seven rows.
      if (index < 600.0) return vec3(narrativeRectangle(index / 600.0, vec2(3.2 * uNarrativeAspect, 3.2)), 0.0);
      float sampleIndex = index - 600.0;
      float row = floor(sampleIndex / 120.0);
      float x = mod(sampleIndex, 120.0) / 119.0;
      float width = row < 0.5 ? 4.3 : 4.9;
      return vec3((x - 0.5) * width * uNarrativeAspect, 2.35 - row * 0.62, 0.0);
    }
    if (chapter < 4.5) {
      vec3 direction = normalize(geographicPosition);
      float longitude = atan(direction.x, direction.z);
      float latitude = asin(clamp(direction.y, -1.0, 1.0));
      return vec3(longitude / 3.141592654 * 3.2 * uNarrativeAspect, latitude / 1.570796327 * 3.2, 0.0);
    }
    if (chapter < 5.5) {
      index = mod(index, 1800.0);
      // Shared sources become six concentric, openly connected rings.
      float ring = mod(index, 6.0);
      float angle = floor(index / 6.0) / 300.0 * 6.283185307;
      float radius = (0.48 + ring * 0.38) * 1.3;
      return vec3(cos(angle) * radius, sin(angle) * radius, 0.0);
    }
    index = mod(index, 1536.0);
    float node = mod(index, 24.0);
    float localAngle = floor(index / 24.0) / 64.0 * 6.283185307;
    vec2 local = vec2(cos(localAngle), sin(localAngle)) * 0.115;
    if (node < 0.5) return vec3(local * 1.5, 0.0);
    float outer = step(8.0, node);
    float angle = mix((node - 1.0) / 7.0, (node - 8.0) / 16.0, outer) * 6.283185307;
    float radius = mix(1.0, 2.25, outer) * 1.35 * (0.76 + uNarrativeGrowth * 0.24);
    vec2 center = vec2(cos(angle), sin(angle)) * radius;
    return vec3(center + local, 0.0);
  }

  float narrativeEmphasis(float chapter, vec3 geographicPosition) {
    if (chapter < 2.5) {
      float cluster = mod(aNarrativeIndex, 7.0);
      if (cluster > 5.5) return 0.8;
      return 1.0 - step(0.5, abs(cluster - floor(uNarrativeFocus + 0.5)));
    }
    if (chapter < 3.5) {
      float row = floor((aNarrativeIndex - 600.0) / 120.0);
      float rowStage = aNarrativeIndex < 720.0 ? 0.0 : (row < 4.0 ? 1.0 : 2.0);
      return 1.0 - smoothstep(0.2, 1.2, abs(rowStage - uNarrativeStep));
    }
    if (chapter < 4.5) {
      float focus = floor(uNarrativeFocus + 0.5);
      // Geographic highlights use the same order as the continent controls.
      vec2 center = vec2(15.0, 50.0);
      if (focus > 0.5) center = vec2(90.0, 30.0);
      if (focus > 1.5) center = vec2(20.0, 0.0);
      if (focus > 2.5) center = vec2(-100.0, 40.0);
      if (focus > 3.5) center = vec2(-60.0, -15.0);
      if (focus > 4.5) center = vec2(135.0, -25.0);
      vec3 direction = normalize(geographicPosition);
      vec2 geographic = vec2(atan(direction.x, direction.z), asin(clamp(direction.y, -1.0, 1.0))) * 57.29577951;
      vec2 distance = (geographic - center) / vec2(48.0, 35.0);
      return 1.0 - smoothstep(0.45, 1.4, length(distance));
    }
    if (chapter < 5.5) return 1.0 - step(0.5, abs(mod(aNarrativeIndex, 6.0) - floor(uNarrativeFocus + 0.5)));
    return 1.0;
  }

  vec4 narrativeProject(vec4 sphereViewPosition, vec3 geographicPosition) {
    vNarrativeWeight = 1.0;
    vNarrativeEmphasis = 0.0;
    vNarrativeBlend = smoothstep(1.0, 2.0, uNarrativeProgress);
    if (uNarrativeProgress <= 1.0) {
      // A gentle geographic highlight makes the context selector visible while
      // the sphere remains intact. It represents a view, not a type census.
      vNarrativeEmphasis = narrativeEmphasis(4.0, geographicPosition);
      vNarrativeBlend = smoothstep(0.25, 1.0, uNarrativeProgress) * 0.28;
      return sphereViewPosition;
    }
    float chapter = min(floor(uNarrativeProgress), 6.0);
    float nextChapter = min(chapter + 1.0, 6.0);
    float fraction = smoothstep(0.0, 1.0, fract(uNarrativeProgress));
    vNarrativeWeight = mix(narrativeLayerWeight(chapter), narrativeLayerWeight(nextChapter), fraction);
    vec4 center = viewMatrix * vec4(uNarrativeCenter, 1.0);
    vec3 start = chapter < 2.0 ? sphereViewPosition.xyz : center.xyz + narrativeTarget(chapter, geographicPosition) * uNarrativeScale;
    vec3 end = center.xyz + narrativeTarget(nextChapter, geographicPosition) * uNarrativeScale;
    vNarrativeEmphasis = mix(narrativeEmphasis(max(chapter, 2.0), geographicPosition), narrativeEmphasis(nextChapter, geographicPosition), fraction);
    float network = smoothstep(5.0, 6.0, uNarrativeProgress);
    float node = mod(aNarrativeIndex, 24.0);
    float visibleNodes = uNarrativeGrowth <= 0.5 ? 1.0 + uNarrativeGrowth * 14.0 : 8.0 + (uNarrativeGrowth - 0.5) * 32.0;
    vNarrativeWeight *= mix(1.0, clamp(visibleNodes - node, 0.0, 1.0), network);
    // Assemble the record in stages: boundary/source, core rows, then history.
    float record = max(0.0, 1.0 - abs(uNarrativeProgress - 3.0));
    float row = floor((aNarrativeIndex - 600.0) / 120.0);
    float rowStage = row < 4.0 ? 1.0 : 2.0;
    float rowWeight = aNarrativeIndex < 720.0 ? 1.0 : clamp(uNarrativeStep - rowStage + 1.0, 0.0, 1.0);
    vNarrativeWeight *= mix(1.0, rowWeight, record);
    return vec4(mix(start, end, fraction), 1.0);
  }
`

/** The existing shaders are unchanged for callers without a narrative. */
export function narrativeVertexShader(shader: string) {
  return (
    NARRATIVE_VERTEX +
    shader.replace(
      /(vec4 mvPosition = modelViewMatrix \* vec4\([^;]+;)/,
      "$1\n    mvPosition = narrativeProject(mvPosition, position);"
    )
  )
}

export function narrativeFragmentShader(shader: string) {
  return (
    `varying float vNarrativeWeight;
     varying float vNarrativeEmphasis;
     varying float vNarrativeBlend;
     uniform float uNarrativePaper;
    ` +
    shader.replace(
      "gl_FragColor = vec4(color, alpha);",
      `color = mix(color, vec3(1.0, 0.79, 0.44), vNarrativeBlend * vNarrativeEmphasis * 0.7);
       color = mix(color, mix(vec3(0.12, 0.10, 0.22), vec3(0.26, 0.20, 0.50), vNarrativeEmphasis), uNarrativePaper);
       alpha *= vNarrativeWeight * mix(1.0, 0.36 + vNarrativeEmphasis * 0.64, vNarrativeBlend);
       gl_FragColor = vec4(color, alpha);`
    )
  )
}

/** Three's built-in points shader still supplies sprite and size attenuation. */
export function applyNarrativeToPoints(
  shader: {
    vertexShader: string
    fragmentShader: string
    uniforms: Record<string, THREE.IUniform>
  },
  uniforms: NarrativeUniforms
) {
  Object.assign(shader.uniforms, uniforms)
  shader.uniforms.uNarrativeLayer = { value: 2 }
  shader.vertexShader =
    NARRATIVE_VERTEX +
    shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
       mvPosition = narrativeProject(mvPosition, position);
       gl_Position = projectionMatrix * mvPosition;`
    )
  shader.fragmentShader =
    `varying float vNarrativeWeight;
     varying float vNarrativeEmphasis;
     varying float vNarrativeBlend;
     uniform float uNarrativePaper;\n` +
    shader.fragmentShader.replace(
      "#include <opaque_fragment>",
      `#include <opaque_fragment>
       gl_FragColor.a *= vNarrativeWeight * mix(1.0, 0.3 + vNarrativeEmphasis * 0.7, vNarrativeBlend);
       gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(1.0, 0.79, 0.44), vNarrativeEmphasis * vNarrativeBlend * 0.5);`
    )
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <tonemapping_fragment>",
    `gl_FragColor.rgb = mix(gl_FragColor.rgb, mix(vec3(0.04, 0.025, 0.12), vec3(0.12, 0.06, 0.34), vNarrativeEmphasis), uNarrativePaper);
     #include <tonemapping_fragment>`
  )
}

export const TYPE_CONSTELLATION_ANCHORS = [
  [0.17, 0.24],
  [0.68, 0.14],
  [0.79, 0.47],
  [0.22, 0.6],
  [0.52, 0.86],
  [0.84, 0.82],
] as const

/** Lightweight line guides give each particle arrangement an explicit structure. */
export function createNarrativeGuide(chapter: number) {
  const positions: number[] = []
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    positions.push(x1, y1, 0, x2, y2, 0)
  }
  const ring = (radius: number, segments = 64) => {
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2
      const b = ((i + 1) / segments) * Math.PI * 2
      line(
        Math.cos(a) * radius,
        Math.sin(a) * radius,
        Math.cos(b) * radius,
        Math.sin(b) * radius
      )
    }
  }
  switch (chapter) {
    case 1:
      // The globe simply recedes before unfolding.
      break

    case 2:
      for (const [x, y] of TYPE_CONSTELLATION_ANCHORS) {
        line(-0.128, -0.128, (x - 0.5) * 6.4, (0.5 - y) * 6.4)
      }
      break

    case 3:
      // The particle layer owns the sole perimeter; this is a heading rule.
      line(-2.6, 1.98, 2.6, 1.98)
      break

    case 4:
      for (let i = -3; i <= 3; i++)
        line(i * (3.2 / 3), -3.2, i * (3.2 / 3), 3.2)
      for (let i = -2; i <= 2; i++) line(-3.2, i * 1.6, 3.2, i * 1.6)
      break

    case 5:
      for (let i = 0; i < 6; i++) ring((0.48 + i * 0.38) * 1.3)
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        line(0, 0, Math.cos(angle) * 3.094, Math.sin(angle) * 3.094)
      }
      break

    case 6:
      ring(1.35)
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * Math.PI * 2
        line(0, 0, Math.cos(angle) * 1.35, Math.sin(angle) * 1.35)
      }
      break

    case 7:
      ring(3.0375)
      for (let i = 0; i < 16; i++) {
        const a = (Math.floor((i * 7) / 16) / 7) * Math.PI * 2
        const b = (i / 16) * Math.PI * 2
        line(
          Math.cos(a) * 1.35,
          Math.sin(a) * 1.35,
          Math.cos(b) * 3.0375,
          Math.sin(b) * 3.0375
        )
      }
      break

    default:
      break
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  )

  return geometry
}
