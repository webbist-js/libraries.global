import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import type { CtaBand, Step } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

export function ContributeBand({
  band,
  steps,
}: {
  readonly band: CtaBand
  readonly steps: readonly Step[]
}) {
  return (
    <section
      id="contribute"
      aria-labelledby="community-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div
        className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,380px),1fr))] gap-[clamp(28px,4vw,56px)] rounded-[32px] p-[clamp(28px,5vw,64px)] text-white"
        style={{ background: "#17162B" }}
      >
        <div>
          <h2
            id="community-title"
            className="m-0 text-balance"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(34px,4.2vw,54px)",
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
            }}
          >
            <Emphasis text={band.title ?? ""} emStyle={{ color: "#B9B4F5" }} />
          </h2>
          <p
            className="mt-4 max-w-[480px] text-[18px] leading-[1.6]"
            style={{ color: "#D6D4E4" }}
          >
            {band.text}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {band.primaryLabel && band.primaryHref ? (
              <GlobalLink
                href={band.primaryHref}
                className="rounded-full px-5 py-3.5 font-semibold no-underline transition-colors hover:bg-(--t-accent-chip)"
                style={{ background: "#fff", color: "#17162B" }}
              >
                {band.primaryLabel}
              </GlobalLink>
            ) : null}
            {band.secondaryLabel && band.secondaryHref ? (
              <GlobalLink
                href={band.secondaryHref}
                className="rounded-full border px-5 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48]"
                style={{ borderColor: "#6E6B8C" }}
              >
                {band.secondaryLabel}
              </GlobalLink>
            ) : null}
          </div>
        </div>
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {steps.map((step, i) => (
            <li
              key={step.title}
              className="flex gap-4 rounded-[18px] p-5"
              style={{ background: "#23213C" }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "30px",
                  lineHeight: 1,
                  color: "#B9B4F5",
                }}
              >
                {i + 1}
              </span>
              <span>
                <strong className="block text-[18px]">{step.title}</strong>
                {step.text ? (
                  <span
                    className="text-[16px] leading-[1.5]"
                    style={{ color: "#D6D4E4" }}
                  >
                    {step.text}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

ContributeBand.displayName = "ContributeBand"

export default ContributeBand
