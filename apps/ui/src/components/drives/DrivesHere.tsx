import { useTranslations } from "next-intl"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"

import { DriveDates } from "./DriveDates"
import { DriveFocusChip } from "./DriveFocusChip"
import { DriveTitle } from "./DriveTitle"
import { unitNoun } from "./focus-meta"

const fmt = (n: number) => n.toLocaleString("en-GB")

/** At most three drives, with accepted progress and work remaining here. */
export function DrivesHere({
  placeName,
  items,
  addHref = "/contribute/index/new",
  proposeHref = "/community/drives/propose",
}: {
  readonly addHref?: string
  readonly proposeHref?: string
  readonly placeName: string
  readonly items: readonly { view: DriveView; here: number }[] | null
}) {
  const tStatic = useTranslations("staticUi")

  const tExisting = useTranslations()

  if (!items?.length)
    return (
      <section
        id="drives-here"
        className="rounded-3xl p-6"
        style={{ background: T.bg.space }}
      >
        <h2 className="type-h2 m-0">
          {items
            ? `No drives are active in ${placeName} right now`
            : "Drives are temporarily unavailable"}
        </h2>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: T.ink.dim }}
        >
          {items
            ? "You can still help one library at a time. Add a missing library or improve a recorded detail."
            : "You can still contribute while drive information is unavailable."}
        </p>
        <div className="flex flex-wrap gap-5">
          <GlobalLink
            className="inline-flex min-h-11 items-center text-sm font-semibold underline"
            href={addHref}
          >
            {tExisting("ui.add_a_library")}
          </GlobalLink>
          <GlobalLink
            className="inline-flex min-h-11 items-center text-sm underline"
            href={proposeHref}
          >
            {tExisting("dashboard.proposeDrive")}
          </GlobalLink>
        </div>
      </section>
    )

  return (
    <section id="drives-here" className="scroll-mt-24">
      <h2 className="type-h2 m-0">Community drives in {placeName}</h2>
      <p
        className="mt-3 mb-6 max-w-[80ch] text-base leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        {tStatic(
          "drive.a_drive_is_a_shared_effort_to_improve_a_set_of_library_records_for_example_adding_a_photo_to_every_l"
        )}
      </p>
      <ul className="m-0 grid list-none gap-3 p-0">
        {items.slice(0, 3).map(({ view, here }) => (
          <li
            key={view.drive.documentId}
            className="grid items-center gap-6 rounded-[28px] border bg-(--t-bg-deep) p-6 sm:p-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]"
            style={{ borderColor: T.border.line }}
          >
            <div>
              <DriveFocusChip focus={view.drive.focus} />
              <h3 className="type-h3 mt-3 mb-3">
                <GlobalLink href={view.href} className="hover:underline">
                  <DriveTitle title={view.drive.title} />
                </GlobalLink>
              </h3>
              <div
                className="flex flex-wrap gap-x-2 text-sm"
                style={{ color: T.ink.dim }}
              >
                {view.place ? <span>{view.place} ·</span> : null}
                <DriveDates drive={view.drive} />
              </div>
            </div>
            <div>
              {view.progress ? (
                <>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <strong>
                      {fmt(view.progress.done)} {tExisting("widgetPublic.of")}{" "}
                      {fmt(view.progress.total)}{" "}
                      {unitNoun(view.drive.unit, view.progress.total)}{" "}
                      {tExisting("drivePage.done")}
                    </strong>
                    <span style={{ color: T.ink.dim }}>
                      {tStatic("drive.whole_drive")}
                    </span>
                  </div>
                  <span
                    aria-hidden="true"
                    className="mt-3 block h-2 overflow-hidden rounded-full"
                    style={{ background: T.bg.muted }}
                  >
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${view.progress.percent}%`,
                        background: T.action.primary,
                      }}
                    />
                  </span>
                </>
              ) : (
                <p className="m-0 text-sm">
                  {tStatic("drive.progress_is_temporarily_unavailable")}
                </p>
              )}
              <p
                className="mt-3 mb-2 text-sm leading-relaxed"
                style={{ color: T.ink.dim }}
              >
                {fmt(here)} still need this drive’s details in {placeName}.
              </p>
              <p className="m-0 text-sm" style={{ color: T.ink.dim }}>
                {tStatic("drive.counts_accepted_changes_only")}
              </p>
            </div>
            <GlobalLink
              href={view.href}
              className="inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-semibold text-white"
              style={{ background: T.action.primary }}
            >
              {tStatic("drive.help_with_this_drive")}
            </GlobalLink>
          </li>
        ))}
      </ul>
      <div
        className="mt-5 flex flex-wrap gap-x-5 text-sm leading-relaxed"
        style={{ color: T.ink.dim }}
      >
        <p className="m-0">
          {tStatic("drive.have_an_idea_for_a_drive")}{" "}
          <GlobalLink
            href={proposeHref}
            className="inline-flex min-h-11 items-center font-semibold underline"
            style={{ color: T.accent.primary }}
          >
            Propose a drive for {placeName}
          </GlobalLink>{" "}
          — available after 5 accepted changes and when no other proposal is
          awaiting review.
        </p>
        {items.length > 3 ? (
          <GlobalLink
            href="/community/drives"
            className="inline-flex min-h-11 items-center underline"
          >
            {tExisting("ui.all_drives")}
          </GlobalLink>
        ) : null}
      </div>
    </section>
  )
}
