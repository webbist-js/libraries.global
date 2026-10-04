import { ArrowRight } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import { SECTION_RULE } from "@/components/home/homepage.constants"
import type {
  Journey,
  JourneyTone,
  SectionIntro,
} from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { T } from "@/lib/design-tokens"

/** Each journey's eyebrow colour: the audience it speaks to. */
const TONE_COLOUR: Record<JourneyTone, string> = {
  explore: T.accent.primary,
  contribute: "#2F5D3A",
  analyse: "#28496E",
  steward: "#28496E",
}

/** The three primary journeys as a numbered index: find a library, help
 * build the index, analyse access. Each row is one link. */
export function JourneysSection({
  intro,
  journeys,
}: {
  readonly intro: SectionIntro
  readonly journeys: readonly Journey[]
}) {
  return (
    <section
      aria-labelledby="journeys-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,120px)] sm:px-8"
    >
      <SectionHeader id="journeys-title" intro={intro} />
      <ol
        className="m-0 mt-12 list-none border-t-2 p-0"
        style={{ borderColor: SECTION_RULE }}
      >
        {journeys.map((journey, i) => (
          <li
            key={journey.title}
            className="border-b"
            style={{ borderColor: T.border.line }}
          >
            <GlobalLink
              href={journey.ctaHref ?? "/"}
              className="group grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 py-7 no-underline md:grid-cols-[72px_minmax(0,1fr)_minmax(0,400px)_64px] md:gap-x-8 md:py-9"
            >
              <span
                aria-hidden="true"
                className="text-[15px]"
                style={{ fontFamily: T.font.mono, color: T.ink.dim }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className="text-[clamp(34px,4.4vw,62px)] leading-none transition-colors group-hover:text-(--t-accent-primary)"
                style={{
                  fontFamily: T.font.serif,
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: T.ink.base,
                }}
              >
                {journey.title}
              </span>
              <span className="col-span-2 col-start-2 row-start-2 md:col-span-1 md:col-start-3 md:row-start-1">
                {journey.eyebrow ? (
                  <span
                    className="block text-[14px] font-semibold"
                    style={{ color: TONE_COLOUR[journey.tone ?? "explore"] }}
                  >
                    {journey.eyebrow}
                  </span>
                ) : null}
                {journey.text ? (
                  <span
                    className="mt-1 block text-[16px] leading-[1.6]"
                    style={{ color: T.ink.dim }}
                  >
                    {journey.text}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className="col-start-3 row-start-1 flex size-11 items-center justify-center rounded-full text-white transition-colors group-hover:bg-(--t-accent-primary) md:col-start-4 md:size-16"
                style={{ background: T.ink.base }}
              >
                <ArrowRight
                  className="size-5 transition-transform group-hover:translate-x-0.5"
                  strokeWidth={2}
                />
              </span>
            </GlobalLink>
          </li>
        ))}
      </ol>
    </section>
  )
}

JourneysSection.displayName = "JourneysSection"

export default JourneysSection
