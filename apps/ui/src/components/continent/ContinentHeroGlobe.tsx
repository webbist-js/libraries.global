import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"
import { GRAIN_SVG } from "@/lib/design-tokens"

/** Camera focus per continent — keeps empty continents facing correctly
 * (record centroids take over naturally as data grows, and agree with these). */
const CONTINENT_FOCUS: Record<string, { lat: number; lng: number }> = {
  africa: { lat: 2, lng: 21 },
  asia: { lat: 34, lng: 95 },
  europe: { lat: 54, lng: 15 },
  "north-america": { lat: 45, lng: -100 },
  oceania: { lat: -25, lng: 140 },
  "south-america": { lat: -15, lng: -60 },
}

const clampDeg = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/**
 * Continent-page hero globe — the homepage globe treatment (ink sphere,
 * green land / indigo ocean dots, gold record markers, halo + grain),
 * zoomed and rotated to centre this continent.
 */
export function ContinentHeroGlobe({
  slug,
  markers,
}: {
  readonly slug: string
  readonly markers?: LibraryMarker[]
}) {
  const focus = CONTINENT_FOCUS[slug]

  return (
    <div
      aria-hidden
      className="pointer-events-none relative m-0 hidden size-[300px] lg:block xl:size-[340px]"
    >
      {/* Halo — blends the sphere's edge into the paper */}
      <div
        aria-hidden
        className="absolute inset-[-12%]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, transparent 30%, transparent 40%, rgba(255,255,255,.55) 47%, rgba(255,255,255,.18) 56%, transparent 66%)",
        }}
      />
      <KnowledgeGlobeCanvas
        markers={markers}
        overrides={{
          autoRotate: false,
          cameraY: 0,
          cameraZ: 13,
          globeTilt: 0,
          globeY: 0,
          ...(focus
            ? {
                globePitch: clampDeg(focus.lat * 0.55, -32, 32),
                globeYaw: -focus.lng,
              }
            : {}),
          interactive: false,
          landDotDensity: 0.95,
          landDotSize: 1.35,
          showSatellites: false,
          showStars: false,
        }}
      />
      {/* Grain — masked to the sphere so the page stays clean */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage: GRAIN_SVG,
          maskImage:
            "radial-gradient(circle at 50% 50%, #000 55%, transparent 70%)",
        }}
      />
    </div>
  )
}

export default ContinentHeroGlobe
