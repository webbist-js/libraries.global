import { Map, Plus } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import HomeSearch from "@/components/home/HomeSearch"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"
import { T } from "@/lib/design-tokens"

const PILL =
  "inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2.5 text-[15px] font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"

export function HomepageHero({
  eyebrow,
  title,
  text,
  markers,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly text: string
  readonly markers?: LibraryMarker[]
}) {
  return (
    <section
      className="relative w-full overflow-hidden border-b"
      style={{ borderColor: T.border.line }}
    >
      {/* Soft lavender wash fading into the paper page */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 360px at 78% 30%, rgba(255,255,255,.85) 0%, transparent 70%), linear-gradient(180deg, #EEEBFA 0%, #F3F1F6 55%, var(--t-bg-void) 100%)",
        }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-[1360px] items-center gap-10 px-4 py-[clamp(48px,8vh,104px)] sm:px-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <div className="max-w-[660px]">
          <p
            className="mb-4 flex items-center gap-2 text-[15px] font-semibold"
            style={{ color: T.accent.ok }}
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
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(46px,6vw,86px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: T.ink.base,
            }}
          >
            <Emphasis text={title} emStyle={{ color: T.accent.primary }} />
          </h1>
          <p
            className="mt-5 max-w-[560px] text-[19px] leading-[1.6] text-pretty"
            style={{ color: T.ink.dim }}
          >
            {text}
          </p>

          <HomeSearch />

          <div className="mt-5 flex flex-wrap gap-2.5">
            <GlobalLink
              href="/map"
              className={PILL}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              <Map
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.8}
                style={{ color: T.accent.primary }}
              />
              Explore the map
            </GlobalLink>
            <GlobalLink
              href="/contribute/add"
              className={PILL}
              style={{ borderColor: T.border.hi, color: T.ink.base }}
            >
              <Plus
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.8}
                style={{ color: T.accent.primary }}
              />
              Add a library
            </GlobalLink>
          </div>
        </div>

        {/* Globe — every published record, plotted */}
        <div
          aria-hidden
          className="mx-auto aspect-square w-[min(100%,340px)] md:w-full md:max-w-[560px]"
          style={{
            // Keep the canvas's own backdrop from reading as a square
            maskImage: "radial-gradient(circle, #000 58%, transparent 71%)",
            WebkitMaskImage:
              "radial-gradient(circle, #000 58%, transparent 71%)",
          }}
        >
          <KnowledgeGlobeCanvas
            markers={markers}
            overrides={{
              globeY: 0,
              cameraY: 0,
              cameraZ: 17.5,
              autoRotateSpeed: 0.025,
              dprMax: 1.25,
              globeTilt: 24,
              interactive: false,
              showSatellites: false,
              showStars: false,
            }}
          />
        </div>
      </div>
    </section>
  )
}

HomepageHero.displayName = "HomepageHero"

export default HomepageHero
