import { Globe } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import HomeSearch from "@/components/home/HomeSearch"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"
import { GRAIN_SVG, T } from "@/lib/design-tokens"

/** Sphere centre sits below the hero's bottom edge, right of centre. */
const HERO_GLOBE_ANCHOR = { x: 0.9, y: 1.1, radius: 0.84, maxRadiusW: 0.4 }

/** Split `*emphasised*` CMS syntax, keyed by character offset (stable even
 * when the same fragment repeats). */
function splitHeroTitle(title: string): { key: string; text: string }[] {
  const parts: { key: string; text: string }[] = []
  let offset = 0
  for (const text of title.split(/(\*[^*]+\*)/g)) {
    parts.push({ key: `${offset}`, text })
    offset += text.length
  }

  return parts
}

export function HomepageHero({
  heroTitle,
  heroText,
  libraryCount,
  coverageNote,
  markers,
}: {
  readonly heroTitle?: string | null
  readonly heroText?: string | null
  readonly libraryCount?: number | null
  readonly coverageNote?: string | null
  readonly markers?: LibraryMarker[]
}) {
  const title = heroTitle ?? "Every library has a story. *Find yours.*"
  const parts = splitHeroTitle(title)

  return (
    <section
      className="relative flex w-full flex-col justify-center overflow-hidden border-b md:min-h-[calc(100svh-56px)]"
      style={{ borderColor: T.border.line }}
    >
      {/* Sky — soft daylight wash fading into the paper page */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, #E9F0F7 0%, #EFF1F0 46%, var(--t-bg-void) 88%)",
        }}
      />
      {/* Cloud light — soft white radials, concept-art sky */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(640px 300px at 76% 16%, rgba(255,255,255,.9) 0%, transparent 70%), radial-gradient(520px 280px at 12% 10%, rgba(255,255,255,.65) 0%, transparent 70%), radial-gradient(760px 340px at 55% 92%, rgba(255,255,255,.5) 0%, transparent 75%)",
        }}
      />

      {/* Globe — a huge sphere rising out of the bottom-right corner, cropped
          by the hero so only the (tilted) northern cap shows. The canvas
          covers the hero; the anchor places the sphere's centre below it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden md:block"
      >
        <KnowledgeGlobeCanvas
          markers={markers}
          overrides={{
            anchor: HERO_GLOBE_ANCHOR,
            autoRotateSpeed: 0.025,
            cameraY: 0,
            cameraZ: 12.6,
            dprMax: 1.25,
            globePitch: 16,
            globeTilt: 24,
            interactive: false,
            landDotDensity: 1.25,
            landDotSize: 1.6,
            showSatellites: false,
            showStars: false,
          }}
        />
        {/* Grain — keeps the canvas texture of the original treatment,
            masked to the sphere so the sky stays clean */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage: GRAIN_SVG,
            maskImage: `radial-gradient(circle at ${HERO_GLOBE_ANCHOR.x * 100}% ${HERO_GLOBE_ANCHOR.y * 100}%, #000 45%, transparent 62%)`,
          }}
        />
      </div>

      {/* Hero content */}
      <div className="relative z-10 mx-auto w-full max-w-[1360px] px-4 py-[clamp(48px,9vh,110px)] sm:px-8">
        <div className="max-w-[660px]">
          <p
            className="mb-4 flex items-center gap-2 text-[16px] font-semibold"
            style={{ color: T.accent.ok }}
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ background: T.accent.ok }}
            />
            Independent · Open source · Community maintained
          </p>
          <h1
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(46px,6.2vw,88px)",
              lineHeight: 1,
              letterSpacing: "-0.02em",
              color: T.ink.base,
            }}
          >
            {parts.map(({ key, text }) =>
              text.startsWith("*") && text.endsWith("*") ? (
                <em
                  key={key}
                  style={{ fontWeight: 400, color: T.accent.primary }}
                >
                  {text.slice(1, -1)}
                </em>
              ) : (
                <span key={key}>{text}</span>
              )
            )}
          </h1>
          <p
            className="mt-5 max-w-[560px] text-[19px] leading-[1.6] text-pretty"
            style={{ color: T.ink.dim }}
          >
            {heroText ??
              "An open index of the world's libraries — where they are, when they're open, what they hold — kept accurate by the people who use and run them."}
          </p>

          <HomeSearch />

          {/* Record-count line — under the search, per the tightened layout */}
          <p
            className="mt-5 flex max-w-[560px] items-start gap-2 text-[14px] leading-[1.5]"
            style={{ color: T.ink.dim }}
          >
            <Globe
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
              strokeWidth={1.7}
              style={{ color: T.ink.low }}
            />
            <span>
              The globe shows every published record:{" "}
              <strong style={{ color: T.ink.base }}>
                {libraryCount != null
                  ? `${libraryCount.toLocaleString("en-US")} so far`
                  : "growing"}
                {coverageNote ? `, ${coverageNote}` : ""}.
              </strong>{" "}
              <GlobalLink
                href="/index"
                className="underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                View them as a list
              </GlobalLink>
            </span>
          </p>
        </div>

        {/* Mobile globe — modest, in-flow */}
        <div className="mx-auto mt-10 aspect-square w-[min(100%,340px)] md:hidden">
          <KnowledgeGlobeCanvas
            markers={markers}
            overrides={{
              globeY: 0,
              cameraY: 0,
              cameraZ: 17.5,
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
