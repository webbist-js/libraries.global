/**
 * Large globe sphere for the continent hero — same dot-map imagery as the
 * homepage ContinentTile but scaled to ~440 px and stripped of hover states.
 */

type GlobePreset = {
  accentGlow: string
  dotMap: string
  horizonGlow: string
  mapPosition: string
  mapSize: string
}

const DEFAULT_PRESET: GlobePreset = {
  accentGlow: "rgba(92, 182, 255, 0.22)",
  dotMap: "/images/globe/continent-europe-dots.png",
  horizonGlow: "rgba(73, 164, 255, 0.28)",
  mapPosition: "50% 50%",
  mapSize: "90% auto",
}

const PRESETS: Record<string, GlobePreset> = {
  africa: {
    accentGlow: "rgba(83, 198, 255, 0.22)",
    dotMap: "/images/globe/continent-africa-dots.png",
    horizonGlow: "rgba(68, 171, 255, 0.26)",
    mapPosition: "50% 51%",
    mapSize: "84% auto",
  },
  americas: {
    accentGlow: "rgba(92, 182, 255, 0.22)",
    dotMap: "/images/globe/continent-americas-dots.png",
    horizonGlow: "rgba(78, 169, 255, 0.24)",
    mapPosition: "50% 53%",
    mapSize: "86% auto",
  },
  asia: {
    accentGlow: "rgba(114, 195, 255, 0.2)",
    dotMap: "/images/globe/continent-asia-dots.png",
    horizonGlow: "rgba(98, 179, 255, 0.24)",
    mapPosition: "50% 50%",
    mapSize: "90% auto",
  },
  europe: {
    accentGlow: "rgba(124, 210, 255, 0.24)",
    dotMap: "/images/globe/continent-europe-dots.png",
    horizonGlow: "rgba(104, 190, 255, 0.28)",
    mapPosition: "50% 49%",
    mapSize: "94% auto",
  },
  oceania: {
    accentGlow: "rgba(138, 198, 255, 0.2)",
    dotMap: "/images/globe/continent-oceania-dots.png",
    horizonGlow: "rgba(95, 174, 255, 0.22)",
    mapPosition: "50% 51%",
    mapSize: "84% auto",
  },
}

// Aliases
PRESETS.af = PRESETS.africa!
PRESETS.am = PRESETS.americas!
PRESETS.as = PRESETS.asia!
PRESETS.eu = PRESETS.europe!
PRESETS.oc = PRESETS.oceania!
PRESETS.america = PRESETS.americas!

function getPreset(
  slug?: string | null,
  code?: string | null,
  name?: string | null
): GlobePreset {
  for (const key of [slug, code, name].filter(Boolean) as string[]) {
    const normalized = key.trim().toLowerCase()
    if (PRESETS[normalized]) return PRESETS[normalized]!
    if (normalized.includes("america")) return PRESETS.americas!
  }

  return DEFAULT_PRESET
}

export function ContinentHeroGlobe({
  slug,
  code,
  name,
}: {
  readonly slug?: string | null
  readonly code?: string | null
  readonly name?: string | null
}) {
  const preset = getPreset(slug, code, name)

  return (
    <div className="relative h-[27.5rem] w-[27.5rem]">
      {/* Outer accent glow ring */}
      <div
        aria-hidden
        className="absolute inset-[-15%] rounded-full opacity-70 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${preset.accentGlow} 0%, transparent 72%)`,
        }}
      />

      {/* Outer ring */}
      <div className="absolute inset-[-3%] rounded-full border border-cyan-100/8" />

      {/* Globe shell */}
      <div className="absolute inset-0 rounded-full border border-white/8 bg-[#020611] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_80px_rgba(52,130,255,0.14)]" />

      {/* Inner surface */}
      <div className="absolute inset-[6%] rounded-full border border-white/6 bg-[radial-gradient(circle_at_34%_24%,rgba(202,229,255,0.16),transparent_18%),linear-gradient(180deg,rgba(17,31,58,0.7)_0%,rgba(6,11,24,0.96)_100%)]" />

      {/* Dot map */}
      <div
        aria-hidden
        className="absolute inset-[8%] opacity-90"
        style={{
          backgroundImage: `url('${preset.dotMap}')`,
          backgroundPosition: preset.mapPosition,
          backgroundRepeat: "no-repeat",
          backgroundSize: preset.mapSize,
          filter:
            "drop-shadow(0 0 14px rgba(126,197,255,0.22)) drop-shadow(0 0 28px rgba(77,156,255,0.14))",
        }}
      />

      {/* Specular highlight */}
      <div className="absolute inset-[7%] rounded-full bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_32%,rgba(0,0,0,0.44)_100%)]" />

      {/* Horizon glow beneath */}
      <div
        aria-hidden
        className="absolute bottom-[-18%] left-1/2 h-16 w-[90%] -translate-x-1/2 rounded-full opacity-80 blur-3xl"
        style={{
          background: `radial-gradient(circle, ${preset.horizonGlow} 0%, transparent 72%)`,
        }}
      />
    </div>
  )
}

ContinentHeroGlobe.displayName = "ContinentHeroGlobe"

export default ContinentHeroGlobe
