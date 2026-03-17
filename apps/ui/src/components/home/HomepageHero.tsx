import { ArrowDown, Search } from "lucide-react"

import { Container } from "@/components/elementary/Container"
import GlobalLink from "@/components/global/GlobalLink"
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

            <div className="mt-10 max-w-[628px]" id="search">
              <label className="sr-only" htmlFor="library-search">
                Search libraries
              </label>

              <div className="group relative overflow-hidden rounded-[34px] border border-white/14 bg-white/[0.042] p-[3.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_20px_rgba(2,6,18,0.05)] backdrop-blur-[34px] transition-[border-color,box-shadow,background-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:border-white/20 focus-within:bg-white/[0.05] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_26px_rgba(54,126,194,0.08)]">
                <div className="pointer-events-none absolute inset-0 rounded-[34px] bg-[linear-gradient(135deg,rgba(255,255,255,0.28),rgba(255,255,255,0.08)_16%,rgba(255,255,255,0.02)_48%,rgba(164,228,255,0.1)_82%,rgba(255,255,255,0.18)_100%)] opacity-95" />
                <div className="pointer-events-none absolute inset-[1px] rounded-[33px] bg-[radial-gradient(circle_at_10%_0%,rgba(255,255,255,0.2),transparent_24%),radial-gradient(circle_at_84%_18%,rgba(182,234,255,0.14),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(150,220,255,0.1),transparent_30%)]" />
                <div className="pointer-events-none absolute inset-y-[-24%] right-[18%] w-24 rotate-[8deg] bg-[linear-gradient(180deg,transparent,rgba(168,228,255,0.2),transparent)] opacity-70 blur-2xl" />
                <div className="pointer-events-none absolute inset-x-7 top-[1px] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.88),rgba(173,232,255,0.62),transparent)] opacity-85" />
                <div className="pointer-events-none absolute inset-x-9 bottom-[1px] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.16),rgba(173,232,255,0.2),transparent)] opacity-50" />

                <div className="relative flex items-center gap-3 rounded-[29px] border border-white/7 bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(255,255,255,0.035)_36%,rgba(255,255,255,0.08)_100%)] px-4 py-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-10px_18px_rgba(7,11,24,0.04)] backdrop-blur-[34px] transition-[border-color,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] focus-within:border-white/10 focus-within:bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.04)_36%,rgba(255,255,255,0.09)_100%)] focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),inset_0_-10px_18px_rgba(7,11,24,0.05)] sm:px-5 sm:py-3">
                  <Search
                    className="size-[18px] text-white/74"
                    strokeWidth={1.8}
                  />

                  <input
                    className="w-full bg-transparent text-[15px] text-white/92 outline-none placeholder:text-white/50 sm:text-base"
                    id="library-search"
                    placeholder="Search for a library, city, or country..."
                    type="text"
                  />

                  <button
                    className="rounded-full border border-white/6 bg-slate-950/74 px-[18px] py-2 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_6px_16px_rgba(1,4,14,0.12)] transition-[background-color,box-shadow] duration-300 hover:bg-slate-950/82 focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:outline-none sm:px-5 sm:text-[15px]"
                    type="button"
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>
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
