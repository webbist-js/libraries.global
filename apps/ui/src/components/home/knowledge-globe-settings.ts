export type GlobeQualityProfile = "performance" | "balanced" | "cinematic"

export type GlobeSettings = {
  ambientLight: number
  arcOpacity: number
  atmosphereOpacity: number
  autoRotateSpeed: number
  bloomIntensity: number
  cameraFov: number
  cameraZ: number
  directionalLight: number
  globePitch: number
  globeScale: number
  globeY: number
  globeYaw: number
  landDotDensity: number
  landDotSize: number
  nodeGlow: number
  pointLight: number
  qualityProfile: GlobeQualityProfile
  starCount: number
}

export type GlobeQualityTuning = {
  antialias: boolean
  atmosphereSegments: number
  dprMax: number
  globeSegments: number
  multisampling: number
  routePoints: number
  wireframeSegments: number
}

export const FIXED_GLOBE_SETTINGS: GlobeSettings = {
  ambientLight: 0.28,
  arcOpacity: 0.05,
  atmosphereOpacity: 1.45,
  autoRotateSpeed: 0.1,
  bloomIntensity: 0.2,
  cameraFov: 22,
  cameraZ: 11.6,
  directionalLight: 0.76,
  globePitch: 10,
  globeScale: 0.76,
  globeY: -1.25,
  globeYaw: -54.5,
  landDotDensity: 0.65,
  landDotSize: 1.4,
  nodeGlow: 1.45,
  pointLight: 3.6,
  qualityProfile: "balanced",
  starCount: 1200,
}

export const GLOBE_QUALITY_TUNING: Record<
  GlobeQualityProfile,
  GlobeQualityTuning
> = {
  performance: {
    antialias: false,
    atmosphereSegments: 24,
    dprMax: 1,
    globeSegments: 32,
    multisampling: 0,
    routePoints: 20,
    wireframeSegments: 24,
  },
  balanced: {
    antialias: false,
    atmosphereSegments: 36,
    dprMax: 1.35,
    globeSegments: 48,
    multisampling: 0,
    routePoints: 28,
    wireframeSegments: 96,
  },
  cinematic: {
    antialias: true,
    atmosphereSegments: 36,
    dprMax: 1.75,
    globeSegments: 48,
    multisampling: 4,
    routePoints: 44,
    wireframeSegments: 44,
  },
}
