import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import HomeSearch from "@/components/home/HomeSearch"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"
import { T } from "@/lib/design-tokens"

export function HomepageHero({
  eyebrow,
  title,
  text,
  markers,
  signedIn,
}: {
  readonly eyebrow: string
  readonly title: string
  readonly text: string
  readonly markers?: LibraryMarker[]
  readonly signedIn: boolean
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

      {/* Globe — every published record, plotted. Oversized and pinned to
          the bottom-right corner so the section edges crop it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-full md:w-[64%]"
        style={{
          // Feather the canvas's left edge so orbital dust never ends in a seam
          maskImage: "linear-gradient(to right, transparent, #000 14%)",
          WebkitMaskImage: "linear-gradient(to right, transparent, #000 14%)",
        }}
      >
        <KnowledgeGlobeCanvas
          markers={markers}
          overrides={{
            anchor: { x: 0.8, y: 1.02, radius: 0.84, maxRadiusW: 0.62 },
            autoRotateSpeed: 0.018,
            cameraY: 0,
            dprMax: 1.25,
            globePitch: 10,
            globeTilt: 22,
            interactive: false,
            showSatellites: false,
            showStars: false,
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-4 pt-[clamp(48px,8vh,104px)] pb-72 sm:px-8 md:pb-[clamp(48px,8vh,104px)]">
        <div className="max-w-[660px]">
          <p
            className="mb-5 inline-flex items-center gap-2 rounded-full border bg-white px-3.5 py-1.5 text-[14px] font-semibold"
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

          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <GlobalLink
              href={signedIn ? "/map" : "/auth/register"}
              className="rounded-full px-5 py-3 text-[15px] font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48]"
              style={{ background: T.ink.base }}
            >
              {signedIn ? "Open the atlas" : "Create a free account"}
            </GlobalLink>
            <span className="text-[15px]" style={{ color: T.ink.dim }}>
              {signedIn
                ? "Every published library on one map."
                : "Follow libraries, suggest edits, get credit."}
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

HomepageHero.displayName = "HomepageHero"

export default HomepageHero
