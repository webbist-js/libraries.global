// ── Globe Shader Library ───────────────────────────────────────────────────
//
// All GLSL shaders used by KnowledgeGlobeCanvas (and by extension
// ContinentHeroGlobe which wraps it). Centralised here so the rendering
// layers can be audited and tuned in one place without navigating the larger
// canvas file.

// ── Land dots ─────────────────────────────────────────────────────────────
// Plain white/blue spherical dots placed on land-mass surface points.

export const LAND_DOT_VERTEX_SHADER = `
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

export const LAND_DOT_FRAGMENT_SHADER = `
  uniform vec3 uBaseColor;
  uniform vec3 uHighlightColor;
  uniform float uAlpha;

  varying float vIntensity;

  void main() {
    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
    float halo = smoothstep(0.38, 0.1, distanceToCenter);
    float core = smoothstep(0.12, 0.0, distanceToCenter);
    float alpha = (halo * 0.45 + core * 1.2) * (0.34 + vIntensity * 0.28);
    vec3 color =
      mix(uBaseColor, uHighlightColor, core * 0.22 + vIntensity * 0.18) *
      (1.0 + halo * 0.08);

    alpha *= 1.5 * uAlpha;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

// ── Land glow ─────────────────────────────────────────────────────────────
// Blue shimmer clouds rendered on a subset of high-activity dots
// (those close to library hub positions).  Uses additive blending so
// clusters accumulate into visible glows.  Animated via uTime.

export const LAND_GLOW_VERTEX_SHADER = `
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

export const LAND_GLOW_FRAGMENT_SHADER = `
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

// ── Hotspot (Perlin-noise undulation) ─────────────────────────────────────
// Animates ALL land dots with a Perlin-noise-driven wave field, giving the
// globe a "breathing" quality.  Dots near library hubs (high activity) glow
// more intensely; dots elsewhere still participate in the base wave.
// Controlled by the showHotspots override.

export const HOTSPOT_VERTEX_SHADER = `
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

export const HOTSPOT_FRAGMENT_SHADER = `
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

    // Warm city-light gold, whitening toward the hottest cores.
    vec3 color = mix(
      vec3(0.98, 0.74, 0.38),
      vec3(1.0, 0.96, 0.88),
      core * 0.55 + vGlow * 0.28 + vActivity * 0.12
    );
    gl_FragColor = vec4(color, alpha);
  }
`

// ── Atmosphere halo ────────────────────────────────────────────────────────
// GitHub-style fresnel rim rendered BackSide on two concentric spheres.
// Inner sphere: crisp terminator edge. Outer sphere: wide ambient halo.

export const HALO_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`

export const HALO_FRAGMENT_SHADER = `
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
    float intensity = pow(max(0.0, uC - fresnel), uP);
    float alpha = intensity * uOpacity;
    if (alpha < 0.001) discard;
    gl_FragColor = vec4(uColor * intensity, alpha);
  }
`

// ── Knowledge-node glow ────────────────────────────────────────────────────
// Billboard sprite glow behind KnowledgeNode markers (library hub indicators).

export const NODE_GLOW_VERTEX_SHADER = `
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

export const NODE_GLOW_FRAGMENT_SHADER = `
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

// ── Wireframe latitude lines ───────────────────────────────────────────────

export const WIREFRAME_VERTEX_SHADER = `
  varying float vLatitude;
  void main() {
    vLatitude = abs(normalize(position).y);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const WIREFRAME_FRAGMENT_SHADER = `
  varying float vLatitude;
  void main() {
    float fade = smoothstep(0.52, 0.93, vLatitude);
    float alpha = 0.023 * (1.0 - fade);
    if (alpha < 0.0035) discard;
    gl_FragColor = vec4(0.18, 0.25, 0.36, alpha);
  }
`

// ── Globe surface ──────────────────────────────────────────────────────────
// Deep navy body that lifts to lavender toward the limb, so the sphere reads
// as lit by its own atmosphere. Pairs with HALO_VERTEX_SHADER.

export const GLOBE_SURFACE_FRAGMENT_SHADER = `
  uniform vec3 uDeepColor;
  uniform vec3 uRimColor;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    float facing = max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0);
    float rim = pow(1.0 - facing, 3.0);
    gl_FragColor = vec4(mix(uDeepColor, uRimColor, rim), 1.0);
  }
`

// ── Arc routes ─────────────────────────────────────────────────────────────
// A faint gold thread with a comet of light travelling along it. aProgress
// runs 0→1 from source to destination; the head position is uTime-driven so
// no per-frame CPU work is needed.

export const ARC_VERTEX_SHADER = `
  attribute float aProgress;

  varying float vProgress;

  void main() {
    vProgress = aProgress;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const ARC_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uPhase;
  uniform float uSpeed;
  uniform float uTime;

  varying float vProgress;

  void main() {
    float endFade =
      smoothstep(0.0, 0.08, vProgress) * smoothstep(1.0, 0.92, vProgress);
    float head = fract(uTime * uSpeed + uPhase);
    // Distance behind the head, wrapped — the tail trails toward the source.
    float behind = fract(head - vProgress);
    float tail = exp(-behind * 7.0);
    float spark = exp(-behind * 60.0);

    float alpha = (0.2 + tail * 0.75 + spark * 0.6) * endFade * uOpacity;
    vec3 color = mix(uColor, vec3(1.0, 0.97, 0.9), spark) * (1.0 + tail * 0.9);

    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);
  }
`

// ── Graticule ──────────────────────────────────────────────────────────────
// Hairline lat/long grid. Fades toward the limb so it never outlines the
// sphere, and toward the poles where meridians converge.

export const GRATICULE_VERTEX_SHADER = `
  varying float vFacing;
  varying float vLatitude;

  void main() {
    vec3 direction = normalize(position);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * direction);

    vFacing = dot(viewNormal, normalize(-mvPosition.xyz));
    vLatitude = abs(direction.y);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export const GRATICULE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vFacing;
  varying float vLatitude;

  void main() {
    float alpha =
      uOpacity *
      smoothstep(0.0, 0.55, vFacing) *
      (1.0 - smoothstep(0.78, 0.97, vLatitude));

    if (alpha < 0.002) discard;

    gl_FragColor = vec4(uColor, alpha);
  }
`

// ── Orbital dust ───────────────────────────────────────────────────────────
// Sparse twinkling motes in a shell around the globe — the render's lavender
// "space dust". Denser near the atmosphere, thinning outward.

export const DUST_VERTEX_SHADER = `
  attribute float aPhase;
  attribute float aSize;

  uniform float uSizeScale;
  uniform float uTime;

  varying float vTwinkle;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

    vTwinkle = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.7 + aPhase));
    gl_PointSize = aSize * uSizeScale * (0.7 + vTwinkle * 0.5) * (120.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`

export const DUST_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vTwinkle;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float alpha = exp(-d * d * 4.0) * vTwinkle * uOpacity;

    if (alpha < 0.01) discard;

    gl_FragColor = vec4(uColor, alpha);
  }
`
