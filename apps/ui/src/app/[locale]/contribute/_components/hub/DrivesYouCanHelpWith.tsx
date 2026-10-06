import { DriveCard } from "@/components/drives/DriveCard"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"

/**
 * The hub's drives section (spec §9): pinned drives (featured first), or
 * the first three open drives, as a grid of `DriveCard`s. Rendered in place
 * of `RecordsThatNeedYou` whenever at least one drive is shown.
 */
export function DrivesYouCanHelpWith({
  views,
}: {
  readonly views: readonly DriveView[]
}) {
  return (
    <section className="mx-auto w-full max-w-[1360px] px-4 py-12 sm:px-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2
            className="m-0"
            style={{
              fontFamily: T.font.serif,
              fontSize: "clamp(26px,3vw,32px)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
              color: T.ink.base,
            }}
          >
            Drives you can help with
          </h2>
          <p className="mt-2 mb-0 text-[15px]" style={{ color: T.ink.dim }}>
            Small tasks, each checked by a reviewer. Pick a drive and work
            through a few.
          </p>
        </div>
        <GlobalLink
          href="/community"
          className="text-[14px] font-semibold underline underline-offset-[3px]"
          style={{ color: T.accent.primary }}
        >
          All drives
        </GlobalLink>
      </div>

      <ul
        className="m-0 grid list-none gap-3.5 p-0"
        style={{
          gridTemplateColumns:
            "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
        }}
      >
        {views.map((view) => (
          <li key={view.drive.documentId}>
            <DriveCard view={view} />
          </li>
        ))}
      </ul>
    </section>
  )
}

DrivesYouCanHelpWith.displayName = "DrivesYouCanHelpWith"

export default DrivesYouCanHelpWith
