import { DriveDates } from "@/components/drives/DriveDates"
import { DriveFocusChip } from "@/components/drives/DriveFocusChip"
import { DriveProgress } from "@/components/drives/DriveProgress"
import { DriveTitle } from "@/components/drives/DriveTitle"
import { focusChipOf, gapPhraseOf } from "@/components/drives/focus-meta"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"

const fmt = (n: number) => n.toLocaleString("en-GB")

/**
 * The homepage's one drive (spec §9): chips, dates, a serif title, a
 * two-line summary, progress and "Join this drive". Fills the Contribute
 * section's task card in place of `pickTasks`' three rows when a drive is
 * pinned or featured.
 */
export function HomeDriveCard({ view }: { readonly view: DriveView }) {
  const { drive, progress, helpers, href, place } = view
  const { tint } = focusChipOf(drive.focus)

  return (
    <div className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DriveFocusChip focus={drive.focus} />
          {place ? (
            <span
              className="inline-flex items-center rounded-full px-3 py-[5px] text-[14px] font-semibold"
              style={{ background: T.bg.muted, color: T.ink.base }}
            >
              {place}
            </span>
          ) : null}
        </div>
        <DriveDates drive={drive} />
      </div>

      <h4
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: 22,
          lineHeight: 1.2,
          color: T.ink.base,
        }}
      >
        <DriveTitle title={drive.title} />
      </h4>

      <p
        className="m-0 line-clamp-2 text-[15px] leading-[1.55]"
        style={{ color: T.ink.dim }}
      >
        {drive.summary}
      </p>

      {progress ? (
        <DriveProgress
          progress={progress}
          unit={drive.unit}
          gapPhrase={gapPhraseOf(drive.focus)}
          goalPercent={drive.goalPercent}
          meta={helpers != null ? `${fmt(helpers)} helping` : undefined}
          color={tint.fg}
        />
      ) : (
        <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
          Not counted yet.
        </p>
      )}

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
        <GlobalLink
          href={href}
          className="inline-flex min-h-11 items-center rounded-full bg-(--t-accent-primary) px-6 py-3 text-[15px] font-semibold text-white no-underline hover:bg-(--t-accent-primary-hover)"
        >
          Join this drive
        </GlobalLink>
        <GlobalLink
          href="/community"
          className="text-[14px] font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          How drives work
        </GlobalLink>
      </div>
    </div>
  )
}

HomeDriveCard.displayName = "HomeDriveCard"

export default HomeDriveCard
