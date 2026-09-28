import { type LucideIcon, Download, Layers, MapPin, Timer } from "lucide-react"

import GlobalLink from "@/components/global/GlobalLink"
import Emphasis from "@/components/home/Emphasis"
import type { CtaBand } from "@/components/home/homepage.types"
import { T } from "@/lib/design-tokens"
import { PRO_FEATURE_COPY } from "@/lib/plans"

type Access = "free" | "account" | "pro"

const ACCESS_BADGE: Record<Access, { label: string; bg: string; fg: string }> =
  {
    free: { label: "Free", bg: "#E6EFE6", fg: "#2F5D3A" },
    account: { label: "Free account", bg: T.bg.muted, fg: T.ink.dim },
    pro: { label: "Pro", bg: T.accent.chip, fg: T.accent.primary },
  }

const FEATURES: {
  title: string
  text: string
  access: Access
  Icon: LucideIcon
  /** Built today? Pro features read it from the plan copy. */
  live: boolean
}[] = [
  {
    title: "Every library on one map",
    text: "Clustered pins you can filter by type, hours and services.",
    access: "free",
    Icon: MapPin,
    live: true,
  },
  {
    title: "Access and events layers",
    text: "Step-free entry, events feeds and how complete each record is.",
    access: "account",
    Icon: Layers,
    live: true,
  },
  {
    title: "Reach analysis",
    text: "Who lives within a 15-minute walk, ride or bus trip.",
    access: "pro",
    Icon: Timer,
    live: PRO_FEATURE_COPY["atlas.analysis"].status === "live",
  },
  {
    title: "Export, draw and compare",
    text: "Export any list as CSV or GeoJSON. Drawing and comparing areas come next.",
    access: "pro",
    Icon: Download,
    live: PRO_FEATURE_COPY["atlas.export"].status === "live",
  },
]

/** What the atlas is for, and which parts are free, need an account or Pro. */
export function AtlasSection({ band }: { readonly band: CtaBand }) {
  if (!band.title) return null

  return (
    <section
      aria-labelledby="atlas-title"
      className="mx-auto grid w-full max-w-[1360px] items-center gap-[clamp(28px,4vw,56px)] px-4 pt-[clamp(64px,8vw,104px)] sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
    >
      <div>
        <h2
          id="atlas-title"
          className="m-0 text-balance"
          style={{
            fontFamily: T.font.serif,
            fontWeight: 500,
            fontSize: "clamp(34px,4vw,50px)",
            lineHeight: 1.08,
            letterSpacing: "-0.015em",
            color: T.ink.base,
          }}
        >
          <Emphasis text={band.title} emStyle={{ color: T.accent.primary }} />
        </h2>
        {band.text ? (
          <p
            className="mt-3 max-w-[500px] text-[18px] leading-[1.6] text-pretty"
            style={{ color: T.ink.dim }}
          >
            {band.text}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2.5">
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
      </div>

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {FEATURES.map(({ title, text, access, Icon, live }) => {
          const badge = ACCESS_BADGE[access]

          return (
            <li
              key={title}
              className="flex flex-col gap-2 rounded-[20px] border bg-white p-5"
              style={{ borderColor: T.border.line }}
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 items-center justify-center rounded-full"
                  style={{ background: badge.bg, color: badge.fg }}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                </span>
                <span className="flex flex-wrap justify-end gap-1.5">
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                    style={{ background: badge.bg, color: badge.fg }}
                  >
                    {badge.label}
                  </span>
                  {live ? null : (
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-[13px] font-medium"
                      style={{ borderColor: T.border.line, color: T.ink.dim }}
                    >
                      Coming soon
                    </span>
                  )}
                </span>
              </div>
              <h3
                className="m-0 mt-1 text-[17px] font-bold"
                style={{ color: T.ink.base }}
              >
                {title}
              </h3>
              <p
                className="m-0 text-[15px] leading-[1.5]"
                style={{ color: T.ink.dim }}
              >
                {text}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

AtlasSection.displayName = "AtlasSection"

export default AtlasSection
