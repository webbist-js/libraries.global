import type { HomepageContinentSummary } from "@/components/home/homepage.types"

type ContinentFocusPreset = {
  accentGlow: string
  dotMap: string
  horizonGlow: string
  mapPosition: string
  mapSize: string
}

const DEFAULT_PRESET: ContinentFocusPreset = {
  accentGlow: "rgba(92, 182, 255, 0.22)",
  dotMap: "/images/globe/continent-europe-dots.png",
  horizonGlow: "rgba(73, 164, 255, 0.28)",
  mapPosition: "50% 50%",
  mapSize: "90% auto",
}

const CONTINENT_FOCUS_PRESETS: Record<string, ContinentFocusPreset> = {
  af: {
    accentGlow: "rgba(83, 198, 255, 0.22)",
    dotMap: "/images/globe/continent-africa-dots.png",
    horizonGlow: "rgba(68, 171, 255, 0.26)",
    mapPosition: "50% 51%",
    mapSize: "84% auto",
  },
  africa: {
    accentGlow: "rgba(83, 198, 255, 0.22)",
    dotMap: "/images/globe/continent-africa-dots.png",
    horizonGlow: "rgba(68, 171, 255, 0.26)",
    mapPosition: "50% 51%",
    mapSize: "84% auto",
  },
  am: {
    accentGlow: "rgba(92, 182, 255, 0.22)",
    dotMap: "/images/globe/continent-americas-dots.png",
    horizonGlow: "rgba(78, 169, 255, 0.24)",
    mapPosition: "50% 53%",
    mapSize: "86% auto",
  },
  america: {
    accentGlow: "rgba(92, 182, 255, 0.22)",
    dotMap: "/images/globe/continent-americas-dots.png",
    horizonGlow: "rgba(78, 169, 255, 0.24)",
    mapPosition: "50% 53%",
    mapSize: "86% auto",
  },
  americas: {
    accentGlow: "rgba(92, 182, 255, 0.22)",
    dotMap: "/images/globe/continent-americas-dots.png",
    horizonGlow: "rgba(78, 169, 255, 0.24)",
    mapPosition: "50% 53%",
    mapSize: "86% auto",
  },
  as: {
    accentGlow: "rgba(114, 195, 255, 0.2)",
    dotMap: "/images/globe/continent-asia-dots.png",
    horizonGlow: "rgba(98, 179, 255, 0.24)",
    mapPosition: "50% 50%",
    mapSize: "90% auto",
  },
  asia: {
    accentGlow: "rgba(114, 195, 255, 0.2)",
    dotMap: "/images/globe/continent-asia-dots.png",
    horizonGlow: "rgba(98, 179, 255, 0.24)",
    mapPosition: "50% 50%",
    mapSize: "90% auto",
  },
  eu: {
    accentGlow: "rgba(124, 210, 255, 0.24)",
    dotMap: "/images/globe/continent-europe-dots.png",
    horizonGlow: "rgba(104, 190, 255, 0.28)",
    mapPosition: "50% 49%",
    mapSize: "94% auto",
  },
  europe: {
    accentGlow: "rgba(124, 210, 255, 0.24)",
    dotMap: "/images/globe/continent-europe-dots.png",
    horizonGlow: "rgba(104, 190, 255, 0.28)",
    mapPosition: "50% 49%",
    mapSize: "94% auto",
  },
  oc: {
    accentGlow: "rgba(138, 198, 255, 0.2)",
    dotMap: "/images/globe/continent-oceania-dots.png",
    horizonGlow: "rgba(95, 174, 255, 0.22)",
    mapPosition: "50% 51%",
    mapSize: "84% auto",
  },
  oceania: {
    accentGlow: "rgba(138, 198, 255, 0.2)",
    dotMap: "/images/globe/continent-oceania-dots.png",
    horizonGlow: "rgba(95, 174, 255, 0.22)",
    mapPosition: "50% 51%",
    mapSize: "84% auto",
  },
}

const getContinentPreset = (
  continent: HomepageContinentSummary
): ContinentFocusPreset => {
  const lookupKeys = [continent.slug, continent.code, continent.name]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())

  const matchedKey = lookupKeys.find(
    (value) => value in CONTINENT_FOCUS_PRESETS
  )

  if (matchedKey != null) {
    return CONTINENT_FOCUS_PRESETS[matchedKey] ?? DEFAULT_PRESET
  }

  if (lookupKeys.some((value) => value.includes("america"))) {
    return CONTINENT_FOCUS_PRESETS.americas ?? DEFAULT_PRESET
  }

  return DEFAULT_PRESET
}

export function ContinentGlobeBackdrop({
  continent,
}: {
  readonly continent: HomepageContinentSummary
}) {
  const preset = getContinentPreset(continent)

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        aria-hidden
        className="absolute inset-x-[10%] top-[9%] h-[12.5rem] rounded-full opacity-90 blur-3xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:opacity-100 group-focus-visible:scale-105 group-focus-visible:opacity-100"
        style={{
          background: `radial-gradient(circle, ${preset.accentGlow} 0%, transparent 72%)`,
        }}
      />

      <div className="absolute top-[6%] left-1/2 h-[14.25rem] w-[14.25rem] -translate-x-1/2 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.02] group-focus-visible:scale-[1.02]">
        <div className="absolute inset-0 rounded-full border border-white/8 bg-[#020611] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_0_68px_rgba(52,130,255,0.12)] transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-cyan-100/14 group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_86px_rgba(68,154,255,0.2)] group-focus-visible:border-cyan-100/14 group-focus-visible:shadow-[0_0_0_1px_rgba(255,255,255,0.05),0_0_86px_rgba(68,154,255,0.2)]" />
        <div className="absolute inset-[6%] rounded-full border border-white/6 bg-[radial-gradient(circle_at_34%_24%,rgba(202,229,255,0.16),transparent_18%),linear-gradient(180deg,rgba(17,31,58,0.7)_0%,rgba(6,11,24,0.96)_100%)] transition-[border-color,background] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-white/10 group-hover:bg-[radial-gradient(circle_at_34%_24%,rgba(202,229,255,0.2),transparent_18%),linear-gradient(180deg,rgba(18,35,64,0.76)_0%,rgba(6,11,24,0.96)_100%)] group-focus-visible:border-white/10 group-focus-visible:bg-[radial-gradient(circle_at_34%_24%,rgba(202,229,255,0.2),transparent_18%),linear-gradient(180deg,rgba(18,35,64,0.76)_0%,rgba(6,11,24,0.96)_100%)]" />

        <div
          aria-hidden
          className="absolute inset-[8%] opacity-92 transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.015] group-hover:opacity-100 group-focus-visible:scale-[1.015] group-focus-visible:opacity-100"
          style={{
            backgroundImage: `url('${preset.dotMap}')`,
            backgroundPosition: preset.mapPosition,
            backgroundRepeat: "no-repeat",
            backgroundSize: preset.mapSize,
            filter:
              "drop-shadow(0 0 12px rgba(126, 197, 255, 0.2)) drop-shadow(0 0 24px rgba(77, 156, 255, 0.12))",
          }}
        />

        <div className="absolute inset-[7%] rounded-full bg-[radial-gradient(circle_at_50%_8%,rgba(255,255,255,0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02)_0%,rgba(255,255,255,0)_32%,rgba(0,0,0,0.44)_100%)]" />
        <div className="absolute inset-[-3%] rounded-full border border-cyan-100/8 transition-[border-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:border-cyan-100/16 group-hover:shadow-[0_0_34px_rgba(92,182,255,0.16)] group-focus-visible:border-cyan-100/16 group-focus-visible:shadow-[0_0_34px_rgba(92,182,255,0.16)]" />
      </div>

      <div
        aria-hidden
        className="absolute bottom-[22%] left-1/2 h-[4.5rem] w-[78%] -translate-x-1/2 rounded-full opacity-90 blur-3xl transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:opacity-100 group-focus-visible:scale-105 group-focus-visible:opacity-100"
        style={{
          background: `radial-gradient(circle, ${preset.horizonGlow} 0%, transparent 72%)`,
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[linear-gradient(180deg,rgba(5,8,22,0),rgba(5,8,22,0.14)_28%,rgba(5,8,22,0.9)_86%)]" />
    </div>
  )
}

ContinentGlobeBackdrop.displayName = "ContinentGlobeBackdrop"

export default ContinentGlobeBackdrop
