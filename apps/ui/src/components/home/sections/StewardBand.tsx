import { ShieldCheck } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import type { CtaBand } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"

/** Speaks to library staff directly: community knowledge vs institutional
 * stewardship is the distinction the index can make that a wiki can't. */
export function StewardBand({ band }: { readonly band: CtaBand }) {
  if (!band.title) return null

  return (
    <section
      aria-labelledby="steward-title"
      className="mx-auto w-full max-w-[1360px] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8"
    >
      <div
        className="grid items-center gap-6 rounded-[28px] border p-[clamp(24px,4vw,44px)] md:grid-cols-[auto_minmax(0,1fr)_auto]"
        style={{ background: "#E4ECF5", borderColor: "#CFDCEB" }}
      >
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-full bg-white"
        >
          <ShieldCheck
            className="size-7"
            strokeWidth={1.6}
            style={{ color: "#28496E" }}
          />
        </span>
        <div>
          <h2
            id="steward-title"
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontWeight: 500,
              fontSize: "clamp(28px,3vw,38px)",
              lineHeight: 1.1,
              color: T.ink.base,
            }}
          >
            {band.title}
          </h2>
          {band.text ? (
            <p
              className="mt-2 max-w-[640px] text-[16px] leading-[1.6]"
              style={{ color: T.ink.dim }}
            >
              {band.text}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col items-start gap-2.5 md:items-center">
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
              className="text-[14px] font-semibold underline underline-offset-[3px]"
              style={{ color: T.ink.base }}
            >
              {band.secondaryLabel}
            </GlobalLink>
          ) : null}
        </div>
      </div>
    </section>
  )
}

StewardBand.displayName = "StewardBand"

export default StewardBand
