import { useTranslations } from "next-intl"

import { DriveDates } from "@/components/drives/DriveDates"
import { DriveFocusChip } from "@/components/drives/DriveFocusChip"
import { DriveProgress } from "@/components/drives/DriveProgress"
import { DriveTitle } from "@/components/drives/DriveTitle"
import { focusChipOf, gapPhraseOf } from "@/components/drives/focus-meta"
import GlobalLink from "@/components/global/GlobalLink"
import {
  homepageLinkAttributes,
  homepageContentAttributes,
} from "@/components/home/homepage.analytics"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"

const fmt = (n: number) => n.toLocaleString("en-GB")

/** Real progress, a clear focus and one route into the drive's public task list. */
export function HomeDriveCard({
  view,
  index,
}: {
  readonly view: DriveView
  readonly index: number
}) {
  const { drive, progress, helpers, href, place } = view
  const { tint } = focusChipOf(drive.focus)
  const t = useTranslations("homepageContribute")

  return (
    <article
      className="home-drive-card"
      lang={drive.locale}
      style={{ borderTopColor: tint.fg }}
    >
      <div className="home-drive-index">
        <span>{t("cardIndex", { index: String(index).padStart(2, "0") })}</span>
        <DriveDates drive={drive} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DriveFocusChip focus={drive.focus} />
          {place ? (
            <span
              className="inline-flex items-center rounded-full px-3 py-[5px] text-sm font-semibold"
              style={{ background: T.bg.muted, color: T.ink.base }}
            >
              {place}
            </span>
          ) : null}
        </div>
      </div>

      <h4
        className="type-h3 m-0"
        style={{
          color: T.ink.base,
        }}
      >
        <DriveTitle title={drive.title} />
      </h4>

      <p
        className="m-0 line-clamp-2 text-base leading-[1.55]"
        style={{ color: T.ink.dim }}
      >
        {drive.summary}
      </p>

      <div className="home-drive-progress">
        {progress ? (
          <DriveProgress
            progress={progress}
            unit={drive.unit}
            gapPhrase={gapPhraseOf(drive.focus)}
            goalPercent={drive.goalPercent}
            meta={
              helpers != null
                ? t("helping", { count: fmt(helpers) })
                : undefined
            }
            color={tint.fg}
          />
        ) : (
          <p className="m-0 text-base" style={{ color: T.ink.dim }}>
            {t("notCounted")}
          </p>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <GlobalLink
          href={href}
          {...homepageContentAttributes("drive", drive.documentId)}
          className="inline-flex min-h-11 items-center rounded-full bg-(--t-action-primary) px-6 py-3 text-base font-semibold text-white no-underline hover:bg-(--t-action-primary-hover)"
        >
          {t("joinDrive")}
        </GlobalLink>
        <GlobalLink
          href="/community"
          {...homepageLinkAttributes("/community")}
          className="text-base font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          {t("howDrivesWork")}
        </GlobalLink>
      </div>
    </article>
  )
}

HomeDriveCard.displayName = "HomeDriveCard"

export default HomeDriveCard
