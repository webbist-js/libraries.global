import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import { displayStyle } from "@/components/home/homepage.constants"
import { CLOSING_MEMBER_STEP } from "@/components/home/homepage.content"
import type {
  CtaBand,
  LinkCard,
  SectionIntro,
  Step,
} from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

// Indigo band palette: white at falling strengths over #4338CA.
const SOFT = "#E2E0FB"
const NUMBER = "#C9C5F5"
const RULE = "rgba(255,255,255,.3)"
const DIVIDER = "rgba(255,255,255,.18)"

/**
 * The homepage's closing ask on a full-width indigo band: the title, then one
 * numbered step per column, the band's primary call to action under the
 * first (join) and the secondary under the second (contribute). Members get
 * `CLOSING_MEMBER_STEP` as the first step instead. The open-by-design links
 * close the band. The band's `text` isn't shown here; the steps carry the
 * explanation.
 */
export function ClosingSection({
  band,
  steps,
  signedIn,
  openIntro,
  openLinks,
}: {
  readonly band: CtaBand
  readonly steps: readonly Step[]
  readonly signedIn: boolean
  readonly openIntro: SectionIntro
  readonly openLinks: readonly LinkCard[]
}) {
  if (!band.title) return null

  const primary = signedIn
    ? { label: CLOSING_MEMBER_STEP.ctaLabel, href: CLOSING_MEMBER_STEP.ctaHref }
    : { label: band.primaryLabel, href: band.primaryHref }
  const ctas = [
    primary.label && primary.href
      ? { label: primary.label, href: primary.href, solid: true }
      : null,
    band.secondaryLabel && band.secondaryHref
      ? { label: band.secondaryLabel, href: band.secondaryHref, solid: false }
      : null,
  ]
  const columns = steps.slice(0, 2).map((step, i) => ({
    step: signedIn && i === 0 ? CLOSING_MEMBER_STEP : step,
    number: i + 1,
    cta: ctas[i] ?? null,
  }))

  return (
    <section
      aria-labelledby="closing-title"
      className="mt-[clamp(80px,10vw,140px)] w-full text-white"
      style={{ background: T.accent.primary }}
    >
      <div className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(72px,9vw,120px)] pb-[clamp(40px,5vw,64px)] sm:px-8">
        <h2
          id="closing-title"
          className="m-0 text-balance"
          style={displayStyle("closing")}
        >
          <Emphasis
            text={band.title}
            emStyle={{ color: SOFT, display: "block" }}
          />
        </h2>

        {columns.length > 0 ? (
          <ol
            className={`m-0 mt-[clamp(40px,5vw,72px)] grid list-none border-t p-0 ${
              columns.length > 1 ? "md:grid-cols-2" : ""
            }`}
            style={{ borderColor: RULE }}
          >
            {columns.map(({ step, number, cta }, i) => (
              <li
                key={step.title}
                className={`flex flex-col items-start py-10 ${
                  i > 0
                    ? "border-t md:border-t-0 md:border-l md:pl-12"
                    : "md:pr-12"
                }`}
                style={{ borderColor: DIVIDER }}
              >
                <span
                  aria-hidden="true"
                  className="text-[15px]"
                  style={{ fontFamily: T.font.mono, color: NUMBER }}
                >
                  {String(number).padStart(2, "0")}
                </span>
                <h3
                  className="m-0 mt-[12px]"
                  style={{
                    fontFamily: T.font.serif,
                    fontWeight: 500,
                    fontSize: "clamp(32px,3vw,44px)",
                    lineHeight: 1.1,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {step.title}
                </h3>
                {step.text ? (
                  <p
                    className="m-0 mt-4 max-w-[520px] text-[17px] leading-[1.65] text-pretty"
                    style={{ color: SOFT }}
                  >
                    {step.text}
                  </p>
                ) : null}
                {cta ? (
                  <GlobalLink
                    href={cta.href}
                    className={
                      cta.solid
                        ? "mt-7 rounded-full bg-white px-6 py-3.5 font-semibold no-underline transition-colors hover:bg-(--t-accent-chip)"
                        : "mt-7 rounded-full border-[1.5px] border-white px-6 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-white/10"
                    }
                    style={cta.solid ? { color: T.ink.base } : undefined}
                  >
                    {cta.label}
                  </GlobalLink>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}

        {openLinks.length > 0 ? (
          <nav
            aria-labelledby="open-title"
            className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-t pt-6 text-[15px]"
            style={{ borderColor: RULE }}
          >
            <h2
              id="open-title"
              className="m-0 text-[15px] font-normal"
              style={{ color: SOFT }}
            >
              {openIntro.title}:
            </h2>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
              {openLinks.map((link) => (
                <li key={link.title}>
                  <GlobalLink
                    href={link.href ?? "/knowledge"}
                    title={link.text ?? undefined}
                    className="text-white underline underline-offset-[3px] hover:text-(--t-accent-chip)"
                  >
                    {link.title}
                  </GlobalLink>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>
    </section>
  )
}

ClosingSection.displayName = "ClosingSection"

export default ClosingSection
