import { ShieldCheck } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import type { CtaBand } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Speaks to library staff directly: community knowledge vs institutional
 * stewardship is the distinction the index can make that a wiki can't. */
export function StewardCard({ band }: { readonly band: CtaBand }) {
  if (!band.title) return null

  return (
    <section
      aria-labelledby="steward-title"
      className="flex flex-col rounded-[24px] border p-[clamp(24px,3vw,36px)]"
      style={{ background: "#E4ECF5", borderColor: "#CFDCEB" }}
    >
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-white"
      >
        <ShieldCheck
          className="size-5"
          strokeWidth={1.7}
          style={{ color: "#28496E" }}
        />
      </span>
      <h2
        id="steward-title"
        className="m-0 mt-5"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: "clamp(28px,3vw,36px)",
          lineHeight: 1.1,
          color: T.ink.base,
        }}
      >
        {band.title}
      </h2>
      {band.text ? (
        <p
          className="mt-3 max-w-[520px] text-[16px] leading-[1.6]"
          style={{ color: T.ink.dim }}
        >
          {band.text}
        </p>
      ) : null}
      <div className="mt-auto flex flex-wrap gap-2.5 pt-6">
        {band.primaryLabel && band.primaryHref ? (
          <GlobalLink
            href={band.primaryHref}
            className="rounded-full px-5 py-3 font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48]"
            style={{ background: T.ink.base }}
          >
            {band.primaryLabel}
          </GlobalLink>
        ) : null}
        {band.secondaryLabel && band.secondaryHref ? (
          <GlobalLink
            href={band.secondaryHref}
            className="rounded-full border bg-white px-5 py-3 font-semibold no-underline transition-colors hover:border-(--t-accent-primary)"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            {band.secondaryLabel}
          </GlobalLink>
        ) : null}
      </div>
    </section>
  )
}

StewardCard.displayName = "StewardCard"

export default StewardCard
