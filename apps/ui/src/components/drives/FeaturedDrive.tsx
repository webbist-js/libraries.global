import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { buttonVariants } from "@/components/ui/button"
import { T } from "@/lib/design-tokens"
import { type DriveView, progressMeta } from "@/lib/drives/drive-view"

import { DriveDates } from "./DriveDates"
import { DriveFocusChip } from "./DriveFocusChip"
import { DriveProgress } from "./DriveProgress"
import { DriveTitle } from "./DriveTitle"
import { focusChipOf, gapPhraseOf } from "./focus-meta"

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-sm"

/**
 * The Noticeboard's big drive card (mockup: the pinned card). Chips for
 * "Pinned drive" (or "Featured drive" when it isn't pinned), the focus and
 * the place, the dates on the right in serif, a serif title and summary,
 * progress, then "Join this drive" and "How drives work". `children` is the
 * task list slot.
 */
export function FeaturedDrive({
  view,
  howHref,
  now,
  children,
}: {
  readonly view: DriveView
  /** The "How drives work" Knowledge article; null falls back to the drive's rules. */
  readonly howHref: string | null
  readonly now?: Date
  readonly children?: ReactNode
}) {
  const { drive, progress, helpers, href, place } = view
  const { tint } = focusChipOf(drive.focus)

  return (
    <article
      aria-labelledby="featured-drive-heading"
      className="flex flex-col"
      style={{
        background: T.bg.deep,
        border: `1px solid ${T.border.line}`,
        borderRadius: 28,
        padding: "clamp(22px,3vw,36px)",
        gap: 18,
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`${CHIP} font-bold`}
          style={{ background: T.action.primary, color: T.ink.inverse }}
        >
          <Icon
            aria-hidden="true"
            height={14}
            icon={drive.pinned ? "mdi:pin-outline" : "mdi:star-outline"}
            width={14}
          />
          {drive.pinned ? "Pinned drive" : "Featured drive"}
        </span>
        <DriveFocusChip focus={drive.focus} />
        {place ? (
          <span
            className={`${CHIP} font-semibold`}
            style={{ background: T.bg.muted, color: T.ink.base }}
          >
            {place}
          </span>
        ) : null}
        <span className="ml-auto">
          <DriveDates drive={drive} now={now} size="lg" />
        </span>
      </div>

      <h2
        id="featured-drive-heading"
        className="type-h2 m-0 text-balance"
        style={{
          color: T.ink.base,
        }}
      >
        <DriveTitle title={drive.title} />
      </h2>
      <p
        className="m-0 max-w-[62ch] text-base leading-[1.6]"
        style={{ color: T.ink.base }}
      >
        {drive.summary}
      </p>

      {progress ? (
        <DriveProgress
          progress={progress}
          unit={drive.unit}
          gapPhrase={gapPhraseOf(drive.focus)}
          goalPercent={drive.goalPercent}
          meta={progressMeta(progress.percent, helpers)}
          color={tint.fg}
        />
      ) : (
        <p className="m-0 text-base" style={{ color: T.ink.dim }}>
          Progress shows once the drive is counted, within the hour.
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <GlobalLink
          href={href}
          className={buttonVariants({ variant: "primary", size: "pill" })}
        >
          Join this drive
        </GlobalLink>
        <GlobalLink
          href={howHref ?? `${href}#rules`}
          className={buttonVariants({
            variant: "surface",
            size: "pill",
            className:
              "border-(--t-border-hi) hover:border-(--t-accent-primary)",
          })}
          style={{ color: T.ink.base }}
        >
          How drives work
        </GlobalLink>
      </div>

      {children}
    </article>
  )
}
