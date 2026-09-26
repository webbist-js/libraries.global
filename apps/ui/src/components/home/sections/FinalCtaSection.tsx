import {
  type LucideIcon,
  Award,
  Bookmark,
  CheckCheck,
  History,
  PencilLine,
} from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import type { CtaBand, Step } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Cycled across the benefit list — decorative, so order is all that matters. */
const BENEFIT_ICONS: LucideIcon[] = [
  PencilLine,
  Bookmark,
  History,
  Award,
  CheckCheck,
]

/** Closing ask: "Know a library? Put it on the map." — with a reason for an
 * account (what a contributor profile unlocks) instead of a bare sign-up. */
export function FinalCtaSection({
  band,
  benefitsTitle,
  benefits,
  progression,
}: {
  readonly band: CtaBand
  readonly benefitsTitle: string
  readonly benefits: readonly Step[]
  readonly progression: string
}) {
  if (!band.title) return null

  return (
    <section
      aria-labelledby="final-cta-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] pb-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div
        className="grid items-center gap-[clamp(28px,4vw,56px)] rounded-[32px] border p-[clamp(28px,5vw,64px)] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]"
        style={{ background: "#EEEBFA", borderColor: "#DEDAF3" }}
      >
        <div>
          <h2
            id="final-cta-title"
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(40px,5vw,66px)",
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              color: T.ink.base,
            }}
          >
            <Emphasis
              text={band.title}
              emStyle={{ color: T.accent.primary, display: "block" }}
            />
          </h2>
          {band.text ? (
            <p
              className="mt-5 max-w-[540px] text-[18px] leading-[1.6] text-pretty"
              style={{ color: T.ink.dim }}
            >
              {band.text}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-2.5">
            {band.primaryLabel && band.primaryHref ? (
              <GlobalLink
                href={band.primaryHref}
                className="rounded-full px-5 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-(--t-accent-primary-hover)"
                style={{ background: T.accent.primary }}
              >
                {band.primaryLabel}
              </GlobalLink>
            ) : null}
            {band.secondaryLabel && band.secondaryHref ? (
              <GlobalLink
                href={band.secondaryHref}
                className="rounded-full border bg-white px-5 py-3.5 font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
                style={{ borderColor: T.border.hi, color: T.ink.base }}
              >
                {band.secondaryLabel}
              </GlobalLink>
            ) : null}
          </div>
        </div>

        {benefits.length > 0 ? (
          <div
            className="rounded-[22px] border bg-white p-[clamp(20px,3vw,32px)]"
            style={{ borderColor: T.border.line }}
          >
            <p
              className="m-0 text-[17px] font-bold"
              style={{ color: T.ink.base }}
            >
              {benefitsTitle}
            </p>
            <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
              {benefits.map((benefit, i) => {
                const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length]!

                return (
                  <li
                    key={benefit.title}
                    className="flex items-center gap-3 text-[16px]"
                    style={{ color: T.ink.base }}
                  >
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: T.accent.chip,
                        color: T.accent.primary,
                      }}
                    >
                      <Icon className="size-4" strokeWidth={1.8} />
                    </span>
                    {benefit.title}
                  </li>
                )
              })}
            </ul>
            {progression ? (
              <p
                className="m-0 mt-5 border-t pt-4 text-[14px] leading-[1.5]"
                style={{ color: T.ink.dim, borderColor: T.border.divider }}
              >
                {progression}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

FinalCtaSection.displayName = "FinalCtaSection"

export default FinalCtaSection
