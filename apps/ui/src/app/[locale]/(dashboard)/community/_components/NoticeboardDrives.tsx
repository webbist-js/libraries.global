import { DriveFocusFilter } from "@/components/drives/DriveFocusFilter"
import { FeaturedDrive } from "@/components/drives/FeaturedDrive"
import { FinishedDrives } from "@/components/drives/FinishedDrives"
import {
  FOCUS_FILTER_META,
  type FocusFilterKey,
} from "@/components/drives/focus-meta"
import { OpenDrivesGrid } from "@/components/drives/OpenDrivesGrid"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import {
  type DriveView,
  filterByFocus,
  focusFilterOptions,
  pickFeatured,
} from "@/lib/drives/drive-view"

/**
 * The Noticeboard's drives, when any are open: the focus filter, the big
 * drive card, "Other open drives" and "Recently finished". `focus` narrows
 * the open drives; a focus no open drive has says so honestly.
 */
export function NoticeboardDrives({
  open,
  finished,
  focus,
  howHref,
  followed,
  now,
}: {
  readonly open: readonly DriveView[]
  readonly finished: readonly DriveView[]
  readonly focus: FocusFilterKey | null
  readonly howHref: string | null
  /** Drive documentIds with work in a place the reader follows; null when signed out. */
  readonly followed: string[] | null
  readonly now?: Date
}) {
  const shown = filterByFocus(open, focus)
  const { featured, others } = pickFeatured(shown)

  return (
    <>
      <div
        id="drives"
        className="flex scroll-mt-24 flex-col"
        style={{ gap: "clamp(18px,2.4vw,28px)" }}
      >
        <DriveFocusFilter
          options={focusFilterOptions(open.map((v) => v.drive))}
          total={open.length}
          active={focus}
        />

        {featured ? (
          <FeaturedDrive view={featured} howHref={howHref} now={now} />
        ) : (
          <p
            className="m-0 text-base"
            style={{
              background: T.bg.deep,
              border: `1px solid ${T.border.line}`,
              borderRadius: 24,
              padding: "22px 24px",
              color: T.ink.dim,
            }}
          >
            No open drives match “
            {focus ? FOCUS_FILTER_META[focus].label : "this filter"}” right now.{" "}
            <GlobalLink
              href="/community#drives"
              className="font-semibold underline underline-offset-[3px]"
              style={{ color: T.accent.primary }}
            >
              Show all open drives
            </GlobalLink>
          </p>
        )}

        {others.length > 0 ? (
          <section
            aria-labelledby="other-drives-heading"
            className="flex flex-col gap-3.5"
          >
            <h2
              id="other-drives-heading"
              className="type-h2 m-0"
              style={{
                color: T.ink.base,
              }}
            >
              Other open drives
            </h2>
            <OpenDrivesGrid views={others} followed={followed} now={now} />
          </section>
        ) : null}
      </div>

      <FinishedDrives views={finished} />
    </>
  )
}
