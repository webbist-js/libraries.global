import { type LucideIcon, Globe2, ShieldCheck, Users } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import type {
  Journey,
  JourneyTone,
  SectionIntro,
} from "@/components/home/homepage.types"
import SectionHeader from "@/components/home/sections/SectionHeader"
import { T } from "@/lib/design-tokens"

const TONES: Record<
  JourneyTone,
  { bg: string; border: string; eyebrow: string; Icon: LucideIcon }
> = {
  explore: {
    bg: "#fff",
    border: "var(--t-border-line)",
    eyebrow: T.accent.primary,
    Icon: Globe2,
  },
  contribute: {
    bg: "#F8EEDC",
    border: "#EBDDC0",
    eyebrow: "#8A5A16",
    Icon: Users,
  },
  steward: {
    bg: "#E4ECF5",
    border: "#CFDCEB",
    eyebrow: "#28496E",
    Icon: ShieldCheck,
  },
}

/** The three primary journeys: explore, contribute, represent a library. */
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
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(56px,7vw,96px)] sm:px-8"
    >
      <SectionHeader id="journeys-title" intro={intro} />
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-4 p-0">
        {journeys.map((journey) => {
          const { bg, border, eyebrow, Icon } =
            TONES[journey.tone ?? "explore"] ?? TONES.explore

          return (
            <li key={journey.title}>
              <GlobalLink
                href={journey.ctaHref ?? "/"}
                className="group flex h-full flex-col gap-2 rounded-[22px] border p-6 no-underline transition-colors hover:border-(--t-accent-primary)"
                style={{ background: bg, borderColor: border }}
              >
                <span
                  aria-hidden="true"
                  className="mb-2 flex size-11 items-center justify-center rounded-full border bg-white"
                  style={{ borderColor: T.border.line }}
                >
                  <Icon
                    className="size-5"
                    strokeWidth={1.7}
                    style={{ color: eyebrow }}
                  />
                </span>
                {journey.eyebrow ? (
                  <span
                    className="text-[14px] font-semibold"
                    style={{ color: eyebrow }}
                  >
                    {journey.eyebrow}
                  </span>
                ) : null}
                <span
                  className="text-[26px] leading-[1.15]"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    color: T.ink.base,
                  }}
                >
                  {journey.title}
                </span>
                {journey.text ? (
                  <span
                    className="text-[16px] leading-[1.55]"
                    style={{ color: T.ink.dim }}
                  >
                    {journey.text}
                  </span>
                ) : null}
                {journey.ctaLabel ? (
                  <span
                    className="mt-auto pt-3 text-[15px] font-semibold"
                    style={{ color: T.ink.base }}
                  >
                    {journey.ctaLabel}{" "}
                    <span
                      aria-hidden="true"
                      className="inline-block transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                ) : null}
              </GlobalLink>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

JourneysSection.displayName = "JourneysSection"

export default JourneysSection
