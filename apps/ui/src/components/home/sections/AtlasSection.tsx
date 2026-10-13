import {
  type LucideIcon,
  Accessibility,
  Download,
  Globe,
  Map as MapIcon,
  Target,
} from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import AtlasGlobePreview from "@/components/home/AtlasGlobePreview"
import Emphasis from "@/components/home/Emphasis"
import { displayStyle } from "@/components/home/homepage.constants"
import type { CtaBand } from "@/components/home/homepage.types"
import type { LibraryMarker } from "@/components/home/knowledge-globe-data"
import { T } from "@/lib/design-tokens"
import { PRO_FEATURE_COPY } from "@/lib/plans"

// Ink band palette: text and rules tuned for the #17162B ground.
const LAVENDER = "#B9B4F5"
const BODY = "#C9C7D8"
const MUTED = "#A9A7BC"
const RULE = "#2E2C47"
const TILE = "#2B2A48"
const OUTLINE = "#4A4866"

type Access = "free" | "account" | "pro"

const ACCESS_BADGE: Record<Access, { label: string; bg: string; fg: string }> =
  {
    free: { label: "Free", bg: "#E6EFE6", fg: "#2F5D3A" },
    account: { label: "Free account", bg: T.bg.space, fg: T.ink.base },
    pro: { label: "Pro / Team", bg: T.accent.chip, fg: T.accent.primary },
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
    text: "Clustered pins you can filter by type, hours and services",
    access: "free",
    Icon: MapIcon,
    live: true,
  },
  {
    title: "Access and events layers",
    text: "Accessibility features, events feeds and record completeness",
    access: "account",
    Icon: Accessibility,
    live: true,
  },
  {
    title: "Library access",
    text: "Libraries per 100k people or people per library, across countries and UK local areas",
    access: "pro",
    Icon: Globe,
    live: true,
  },
  {
    title: "Reach analysis",
    text: "Who lives within a 15-minute walk, ride or bus trip",
    access: "pro",
    Icon: Target,
    live: PRO_FEATURE_COPY["atlas.analysis"].status === "live",
  },
  {
    title: "Export, draw and compare",
    text: "Export any list as CSV or GeoJSON; drawing and comparing areas come next",
    access: "pro",
    Icon: Download,
    live: PRO_FEATURE_COPY["atlas.export"].status === "live",
  },
]

/** What the atlas is for, and which parts are free, need an account or
 * Pro, on a full-width ink band beside a globe preview of library locations. */
export function AtlasSection({
  band,
  markers,
}: {
  readonly band: CtaBand
  readonly markers: readonly LibraryMarker[]
}) {
  const tUi = useUiTranslations("ui")

  if (!band.title) return null

  return (
    <section
      aria-labelledby="atlas-title"
      className="w-full text-white"
      style={{ background: T.ink.base }}
    >
      <div className="mx-auto grid w-full max-w-[1360px] grid-cols-1 items-stretch gap-[clamp(40px,7vw,120px)] px-4 sm:px-8 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)]">
        <div>
          <p
            className="m-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[14px] font-semibold"
            style={{ borderColor: OUTLINE }}
          >
            <Globe aria-hidden="true" className="size-3.5" strokeWidth={2} />
            The Atlas
          </p>
          <h2
            id="atlas-title"
            className="m-0 mt-[18px] text-balance"
            style={displayStyle("band")}
          >
            <Emphasis text={band.title} emStyle={{ color: LAVENDER }} />
          </h2>
          {band.text ? (
            <p
              className="mt-8 max-w-[500px] text-[18px] leading-[1.65] text-pretty"
              style={{ color: BODY }}
            >
              {band.text}
            </p>
          ) : null}

          <ul
            className="m-0 mt-7 list-none border-t p-0"
            style={{ borderColor: RULE }}
          >
            {FEATURES.map(({ title, text, access, Icon, live }) => {
              const badge = ACCESS_BADGE[access]

              return (
                <li
                  key={title}
                  className="flex items-center gap-3.5 border-b py-3.5"
                  style={{ borderColor: RULE }}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-10 shrink-0 items-center justify-center rounded-[10px]"
                    style={{ background: TILE }}
                  >
                    <Icon className="size-[18px]" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">
                      {title}
                    </span>
                    <span
                      className="block text-[14px] leading-[1.45]"
                      style={{ color: MUTED }}
                    >
                      {text}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[13px] font-semibold"
                      style={{ background: badge.bg, color: badge.fg }}
                    >
                      {badge.label}
                    </span>
                    {live ? null : (
                      <span
                        className="rounded-full border px-2.5 py-0.5 text-[13px] font-medium"
                        style={{ borderColor: OUTLINE, color: MUTED }}
                      >
                        {tUi("soon")}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {band.primaryLabel && band.primaryHref ? (
              <GlobalLink
                href={band.primaryHref}
                className="rounded-full bg-white px-6 py-3.5 font-semibold no-underline transition-colors hover:bg-(--t-accent-chip)"
                style={{ color: T.ink.base }}
              >
                {band.primaryLabel}
              </GlobalLink>
            ) : null}
            {band.secondaryLabel && band.secondaryHref ? (
              <GlobalLink
                href={band.secondaryHref}
                className="rounded-full border px-6 py-3.5 font-semibold text-white no-underline transition-colors hover:bg-[#2C2A48]"
                style={{ borderColor: OUTLINE }}
              >
                {band.secondaryLabel}
              </GlobalLink>
            ) : null}
          </div>
        </div>

        <AtlasGlobePreview
          markers={markers}
          href={band.primaryHref ?? "/map"}
        />
      </div>
    </section>
  )
}

AtlasSection.displayName = "AtlasSection"

export default AtlasSection
