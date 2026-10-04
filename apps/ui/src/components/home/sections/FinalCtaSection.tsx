import {
  type LucideIcon,
  Bookmark,
  PencilLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { PromptDismissButton } from "@/components/ds/DismissiblePrompt"
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

/** `full` closes the homepage; `compact` is a short band above a list (Find
 * libraries): benefits in a 2×2 grid, left out on phones. */
const SIZES = {
  full: {
    section: "pt-[clamp(64px,8vw,104px)]",
    band: "gap-[clamp(28px,4vw,56px)] rounded-[32px] p-[clamp(28px,5vw,64px)] lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]",
    titleSize: "clamp(38px,4.6vw,60px)",
    text: "mt-5 max-w-[520px] text-[18px] leading-[1.6]",
    actions: "mt-7",
    button: "px-5 py-3.5",
    list: "flex flex-col",
    item: "gap-4 rounded-[16px] px-4 py-3.5",
    icon: "size-9",
    itemTitle: "text-[16px]",
    itemText: "text-[15px] leading-[1.5]",
  },
  compact: {
    section: "pt-8",
    band: "gap-6 rounded-[24px] p-[clamp(22px,3vw,36px)] lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]",
    titleSize: "clamp(28px,2.6vw,36px)",
    text: "mt-3 max-w-[480px] text-[16px] leading-[1.55]",
    actions: "mt-5",
    button: "px-5 py-2.5 text-[15px]",
    list: "hidden md:grid md:grid-cols-2",
    item: "gap-3 rounded-[14px] px-3.5 py-3",
    icon: "size-8",
    itemTitle: "text-[15px]",
    itemText: "text-[14px] leading-[1.45]",
  },
} as const

/** Closing ask: "Know a library? Put it on the map." — with a reason for an
 * account (what it gets you) instead of a bare sign-up. Members skip the
 * sign-up and go straight to contributing. Inside a `DismissiblePrompt`,
 * `dismissLabel` adds a close button to the band's corner. */
export function FinalCtaSection({
  band,
  benefits,
  signedIn,
  compact = false,
  dismissLabel,
}: {
  readonly band: CtaBand
  readonly benefits: readonly Step[]
  readonly signedIn: boolean
  readonly compact?: boolean
  readonly dismissLabel?: string
}) {
  if (!band.title) return null

  const size = SIZES[compact ? "compact" : "full"]
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
      className={`mx-auto w-full max-w-[1360px] px-4 sm:px-8 ${size.section}`}
    >
      <div
        className={`relative grid items-center text-white ${size.band}`}
        style={{ background: "#17162B" }}
      >
        {dismissLabel ? (
          <PromptDismissButton
            label={dismissLabel}
            className="absolute top-3 right-3 flex size-9 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-[#2C2A48] hover:text-white"
            style={{ color: MUTED }}
          />
        ) : null}
        <div>
          <h2
            id="final-cta-title"
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: size.titleSize,
              lineHeight: 1.04,
              letterSpacing: "-0.02em",
            }}
          >
            <Emphasis text={band.title} emStyle={{ color: LAVENDER }} />
          </h2>
          {band.text ? (
            <p className={`${size.text} text-pretty`} style={{ color: MUTED }}>
              {band.text}
            </p>
          ) : null}
          <div className={`flex flex-wrap gap-2.5 ${size.actions}`}>
            {primary ? (
              <GlobalLink
                href={primary.href}
                className={`rounded-full font-semibold no-underline transition-colors hover:bg-(--t-accent-chip) ${size.button}`}
                style={{ background: "#fff", color: "#17162B" }}
              >
                {primary.label}
              </GlobalLink>
            ) : null}
            {secondary ? (
              <GlobalLink
                href={secondary.href}
                className={`rounded-full border font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48] ${size.button}`}
                style={{ borderColor: "#6E6B8C" }}
              >
                {secondary.label}
              </GlobalLink>
            ) : null}
          </div>
        </div>

        {benefits.length > 0 ? (
          <ul className={`m-0 list-none gap-2.5 p-0 ${size.list}`}>
            {benefits.map((benefit, i) => {
              const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length]!

              return (
                <li
                  key={benefit.title}
                  className={`flex items-center border ${size.item}`}
                  style={{ background: "#23213C", borderColor: "#34315A" }}
                >
                  <span
                    aria-hidden="true"
                    className={`flex shrink-0 items-center justify-center rounded-full ${size.icon}`}
                    style={{ background: "#2E2B52", color: LAVENDER }}
                  >
                    <Icon className="size-4" strokeWidth={1.8} />
                  </span>
                  <span>
                    <strong className={`block ${size.itemTitle}`}>
                      {benefit.title}
                    </strong>
                    {benefit.text ? (
                      <span className={size.itemText} style={{ color: MUTED }}>
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
