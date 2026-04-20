import { ArrowDown } from "lucide-react"

import { StatBlock } from "@/components/ds"
import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import GlobeParallaxWrapper from "@/components/home/GlobeParallaxWrapper"
import HeroSearchBox from "@/components/home/HeroSearchBox"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"
import { T } from "@/lib/design-tokens"

// Render title with optional *italic* word syntax from CMS
function RichTitle({ text }: { text: string }) {
  // Split on *...* patterns and render italics
  const parts = text.split(/(\*[^*]+\*)/g)

  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("*") && part.endsWith("*")) {
          return (
            <em key={i} style={{ fontStyle: "italic", color: T.ink.dim }}>
              {part.slice(1, -1)}
            </em>
          )
        }

        return <span key={i}>{part}</span>
      })}
    </>
  )
}

const STATS = [
  {
    label: "LIBRARIES INDEXED",
    sub: "Across countries & territories",
  },
  {
    label: "COLLECTIONS",
    value: null, // TODO: add when collections feature ships
    sub: "Items catalogued",
  },
  {
    label: "LANGUAGES",
    value: null, // TODO: fetch distinct language count from Strapi
    sub: "Living, liturgical, extinct",
  },
  {
    label: "CONTRIBUTORS",
    value: null, // TODO: add when auth and user contributions ship
    sub: "Librarians, scholars, researchers",
  },
] as const

function formatCount(n: number | null | undefined): string {
  if (n == null) return "—"

  return n.toLocaleString("en-US")
}

export function HomepageHero({
  heroEyebrow,
  heroTitle,
  heroText,
  libraryCount,
}: {
  readonly heroEyebrow?: string | null
  readonly heroTitle?: string | null
  readonly heroText?: string | null
  readonly libraryCount?: number | null
}) {
  const statValues = [
    formatCount(libraryCount),
    "—", // Collections TODO
    "—", // Languages TODO
    "—", // Contributors TODO
  ]

  return (
    <section
      className="relative flex h-[calc(100svh-4.5rem)] flex-col overflow-hidden"
      id="explore"
    >
      {/* Outer div handles X-centering; inner GlobeParallaxWrapper handles Y on scroll */}
      <div className="absolute inset-y-0 left-1/2 z-0 h-full w-screen -translate-x-1/2">
        <GlobeParallaxWrapper>
          <KnowledgeGlobeCanvas />
        </GlobeParallaxWrapper>
      </div>

      <Container className="relative z-20 box-border grid flex-1 grid-rows-[1fr_auto] pt-6 pb-0 sm:pt-8">
        <div className="flex min-h-0 items-start pt-[7vh] sm:pt-[5vh]">
          <div className="max-w-[800px] pb-4 sm:pb-8">
            {/* Coordinate / project eyebrow */}
            <div className="mb-6 space-y-2">
              <p className="font-mono text-[11px] tracking-[0.22em] text-white/35 uppercase">
                PROJECT · 001&nbsp;&nbsp;51.5308° N&nbsp;&nbsp;0.1238° W
              </p>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "5px 11px",
                  borderRadius: "999px",
                  fontSize: "10px",
                  border: `1px solid ${T.border.line}`,
                  background: "rgba(255,255,255,.03)",
                  fontFamily: T.font.mono,
                  letterSpacing: ".22em",
                  color: T.ink.dim,
                  textTransform: "uppercase",
                }}
              >
                <span>★</span>
                <span>
                  {heroEyebrow ?? "AN ATLAS OF HUMAN KNOWLEDGE · V.2026"}
                </span>
              </div>
            </div>

            {heroTitle ? (
              <h1
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 400,
                  fontSize: "clamp(56px,8.4vw,128px)",
                  lineHeight: 0.92,
                  letterSpacing: "-.045em",
                  margin: 0,
                  color: T.ink.base,
                }}
              >
                <RichTitle text={heroTitle} />
              </h1>
            ) : null}

            {heroText ? (
              <p className="mt-6 max-w-[48ch] text-base leading-7 text-white/60 sm:text-lg">
                {heroText}
              </p>
            ) : null}

            <HeroSearchBox />
          </div>
        </div>

        <div className="flex justify-center py-4 text-white/42 sm:py-6">
          <GlobalLink
            href="#homepage-content"
            aria-label="Scroll below the hero"
            className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/54 transition-colors hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
          >
            <ArrowDown className="size-4" strokeWidth={1.8} />
          </GlobalLink>
        </div>
      </Container>

      {/* Stats bar — pinned to hero bottom */}
      <div className="relative z-20 border-t border-white/8 bg-[#050816]/60 backdrop-blur-md">
        <Container>
          <div className="grid grid-cols-2 divide-x divide-white/8 lg:grid-cols-4">
            {STATS.map((stat, i) => (
              <div
                key={stat.label}
                className="flex flex-col gap-1 px-5 py-5 sm:px-6 sm:py-6"
              >
                <StatBlock
                  value={statValues[i] ?? "—"}
                  label={stat.label}
                  size="lg"
                />
                <p className="text-[11px] text-white/35">{stat.sub}</p>
              </div>
            ))}
          </div>
        </Container>
      </div>
    </section>
  )
}

HomepageHero.displayName = "HomepageHero"

export default HomepageHero
