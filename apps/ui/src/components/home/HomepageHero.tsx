import { ArrowDown } from "lucide-react"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
import HeroSearchBox from "@/components/home/HeroSearchBox"
import KnowledgeGlobeCanvas from "@/components/home/KnowledgeGlobeCanvas"

export function HomepageHero({
  heroEyebrow,
  heroTitle,
  heroText,
}: {
  readonly heroEyebrow?: string | null
  readonly heroTitle?: string | null
  readonly heroText?: string | null
}) {
  return (
    <section
      className="relative h-[calc(100svh-4.5rem)] overflow-hidden"
      id="explore"
    >
      <div className="absolute inset-y-0 left-1/2 z-0 h-full w-screen -translate-x-1/2">
        <KnowledgeGlobeCanvas />
      </div>

      <Container className="relative z-20 box-border grid h-full grid-rows-[1fr_auto] pt-6 pb-6 sm:pt-8 sm:pb-8">
        <div className="flex min-h-0 items-center">
          <div className="max-w-[760px] pb-4 sm:pb-8">
            {heroEyebrow ? (
              <div className="mb-6 inline-flex items-center rounded-full border border-white/12 bg-white/5 px-4 py-2 text-xs tracking-[0.24em] text-white/60 uppercase backdrop-blur-sm">
                {heroEyebrow}
              </div>
            ) : null}

            {heroTitle ? (
              <h1 className="max-w-[10ch] text-[clamp(3.6rem,9vw,7.8rem)] leading-[0.92] font-semibold tracking-[-0.06em] text-white [text-shadow:0_0_28px_rgba(174,226,255,0.22)]">
                {heroTitle}
              </h1>
            ) : null}

            {heroText ? (
              <p className="mt-6 max-w-[48ch] text-base leading-7 text-white/68 sm:text-lg md:text-xl">
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
    </section>
  )
}

HomepageHero.displayName = "HomepageHero"

export default HomepageHero
