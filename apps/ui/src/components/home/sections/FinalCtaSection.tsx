import {
  type LucideIcon,
  Bookmark,
  PencilLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import type { CtaBand, Step } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Cycled across the benefit list — decorative, so order is all that matters. */
const BENEFIT_ICONS: LucideIcon[] = [
  PencilLine,
  Bookmark,
  ShieldCheck,
  Sparkles,
]

const LAVENDER = "#B9B4F5"
const MUTED = "#D6D4E4"

/** Closing ask: "Know a library? Put it on the map." — with a reason for an
 * account (what it gets you) instead of a bare sign-up. Members skip the
 * sign-up and go straight to contributing. */
export function FinalCtaSection({
  band,
  benefits,
  signedIn,
}: {
  readonly band: CtaBand
  readonly benefits: readonly Step[]
  readonly signedIn: boolean
}) {
  if (!band.title) return null

  const primary = signedIn
    ? { label: "Start contributing", href: band.secondaryHref ?? "/contribute" }
    : band.primaryLabel && band.primaryHref
      ? { label: band.primaryLabel, href: band.primaryHref }
      : null
  const secondary =
    !signedIn && band.secondaryLabel && band.secondaryHref
      ? { label: band.secondaryLabel, href: band.secondaryHref }
      : null

  return (
    <section
      aria-labelledby="final-cta-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div
        className="grid items-center gap-[clamp(28px,4vw,56px)] rounded-[32px] p-[clamp(28px,5vw,64px)] text-white lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
        style={{ background: "#17162B" }}
      >
        <div>
          <h2
            id="final-cta-title"
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(38px,4.6vw,60px)",
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            <Emphasis text={band.title} emStyle={{ color: LAVENDER }} />
          </h2>
          {band.text ? (
            <p
              className="mt-5 max-w-[520px] text-[18px] leading-[1.6] text-pretty"
              style={{ color: MUTED }}
            >
              {band.text}
            </p>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-2.5">
            {primary ? (
              <GlobalLink
                href={primary.href}
                className="rounded-full px-5 py-3.5 font-semibold no-underline transition-colors hover:bg-(--t-accent-chip)"
                style={{ background: "#fff", color: "#17162B" }}
              >
                {primary.label}
              </GlobalLink>
            ) : null}
            {secondary ? (
              <GlobalLink
                href={secondary.href}
                className="rounded-full border px-5 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48]"
                style={{ borderColor: "#6E6B8C" }}
              >
                {secondary.label}
              </GlobalLink>
            ) : null}
          </div>
        </div>

        {benefits.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {benefits.map((benefit, i) => {
              const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length]!

              return (
                <li
                  key={benefit.title}
                  className="flex items-center gap-4 rounded-[16px] border px-4 py-3.5"
                  style={{ background: "#23213C", borderColor: "#34315A" }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full"
                    style={{ background: "#2E2B52", color: LAVENDER }}
                  >
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <span>
                    <strong className="block text-[16px]">
                      {benefit.title}
                    </strong>
                    {benefit.text ? (
                      <span
                        className="text-[15px] leading-[1.5]"
                        style={{ color: MUTED }}
                      >
                        {benefit.text}
                      </span>
                    ) : null}
                  </span>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </section>
  )
}

FinalCtaSection.displayName = "FinalCtaSection"

export default FinalCtaSection
