import Emphasis from "@/components/home/Emphasis"
import { displayStyle } from "@/components/home/homepage.constants"
import type { HomepageStats } from "@/components/home/homepage.types"
import HomeSearch from "@/components/home/HomeSearch"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import { HOMEPAGE_GLOBE_APPEARANCE } from "@/components/home/knowledge-globe-settings"
import KnowledgeGlobeCanvas, {
  type GlobeView,
} from "@/components/home/KnowledgeGlobeCanvas"
import StatsStrip from "@/components/home/sections/StatsStrip"
import { T } from "@/lib/design-tokens"

/** Where the globe opens, one picked at random on each page load so the
 * hero isn't always Europe. Each is the point turned to face the camera,
 * which sits below the crop: chosen so the named region lands in the
 * visible upper-left of the globe. */
const START_VIEWS: readonly GlobeView[] = [
  { lat: 12, lng: 23 }, // Europe
  { lat: 3, lng: -82 }, // North America
  { lat: -5, lng: 132 }, // East Asia
  { lat: -19, lng: 96 }, // South Asia
  { lat: -39, lng: 43 }, // Africa
  { lat: -63, lng: -26 }, // South America
  { lat: -60, lng: 160 }, // South-East Asia and Australia
]

/** The homepage hero: a display title, library search and live index counts,
 * beside the globe of every published record. */
export function HomepageHero({
  eyebrow,
  title,
  text,
  markers,
  stats,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly text: string
  readonly markers?: LibraryMarker[]
  readonly stats: HomepageStats | null
}) {
  return (
    <section className="relative flex min-h-[calc(100svh_-_57px)] w-full items-center overflow-hidden">
      {/* Globe — every published record, plotted: the hero's feature
          visual, pinned into the bottom-right corner and cropped by both
          edges. From xl it fills the space right of the text column (its
          left edge sits 24px inside the column, and the 64px feather plus
          `clearLeft` keep the globe 40px clear of it); below xl it sits in a
          band under the search. The feathers fade orbital dust out instead
          of ending it in a seam. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[320px] [mask-image:linear-gradient(to_bottom,transparent,#000_48px)] xl:top-0 xl:left-[calc(max(0px,(100%_-_1360px)/2)_+_2rem_+_760px_-_24px)] xl:h-auto xl:[mask-image:linear-gradient(to_right,transparent,#000_64px)]"
      >
        <KnowledgeGlobeCanvas
          markers={markers}
          overrides={{
            ...HOMEPAGE_GLOBE_APPEARANCE,
            pin: {
              radius: 1.16,
              below: 0.15,
              inset: 0.4,
              minInset: -0.15,
              clearLeft: 64,
            },
            startViews: START_VIEWS,
            autoRotateSpeed: 0.018,
            interactive: false,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-4 pt-[clamp(48px,8vw,112px)] pb-[360px] sm:px-8 xl:py-6">
        <div className="max-w-[760px]">
          <p
            className="mb-4 inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-1.5 text-[14px] font-semibold"
            style={{ borderColor: T.border.line, color: T.ink.base }}
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: T.accent.ok }}
            />
            {eyebrow}
          </p>
          <h1
            className="m-0 text-balance"
            style={{
              ...displayStyle("hero"),
              fontSize: "clamp(60px, min(10vw, 12svh), 144px)",
              color: T.ink.base,
            }}
          >
            <Emphasis text={title} emStyle={{ color: T.accent.primary }} />
          </h1>
          <p
            className="mt-[24px] max-w-[600px] text-[clamp(18px,1.6vw,21px)] leading-[1.6] text-pretty"
            style={{ color: T.ink.dim }}
          >
            {text}
          </p>

          <HomeSearch />
          <StatsStrip stats={stats} />
        </div>
      </div>
    </section>
  )
}

HomepageHero.displayName = "HomepageHero"

export default HomepageHero
