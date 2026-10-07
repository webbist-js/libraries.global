import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"

import { DriveDates } from "./DriveDates"
import { DriveFocusChip } from "./DriveFocusChip"
import { DriveTitle } from "./DriveTitle"
import { focusChipOf, longDate, unitNoun } from "./focus-meta"

const fmt = (n: number) => n.toLocaleString("en-GB")

/**
 * One open drive in the Noticeboard grid, as the mockup: focus chip and
 * dates, a serif title linked to the drive page (the whole card is the
 * target), the place on one line and "Records from" on the next, then a
 * bar with "61 of 88 records" and how many are helping. The bar is
 * decorative: the count beside it says the same.
 *
 * `preview` draws a drive that doesn't exist yet, for the builder's live
 * preview: no link, "Opens 13 Oct 2026" in full, and its summary.
 */
export function DriveCard({
  view,
  now,
  preview = false,
}: {
  readonly view: DriveView
  readonly now?: Date
  readonly preview?: boolean
}) {
  const { drive, progress, helpers, href, place, source } = view
  const { tint } = focusChipOf(drive.focus)
  const opens = preview ? longDate(drive.startsAt) : ""

  return (
    <article
      className={`relative flex h-full flex-col gap-2.5 rounded-[24px] border border-(--t-border-line) bg-white p-5 ${preview ? "" : "transition-[border-color,box-shadow] focus-within:border-[#B9B4F5] hover:border-[#B9B4F5] hover:shadow-[0_12px_28px_rgba(23,22,43,.08)]"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DriveFocusChip focus={drive.focus} />
        {preview ? (
          opens ? (
            <span
              className="text-[14px] font-semibold whitespace-nowrap"
              style={{ color: T.ink.dim }}
            >
              Opens {opens}
            </span>
          ) : null
        ) : (
          <DriveDates drive={drive} now={now} />
        )}
      </div>
      <h3
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.15,
        }}
      >
        {preview ? (
          <span style={{ color: T.ink.base }}>
            <DriveTitle title={drive.title} />
          </span>
        ) : (
          <GlobalLink
            href={href}
            className="no-underline hover:underline"
            style={{ color: T.ink.base }}
          >
            <DriveTitle title={drive.title} />
            <span aria-hidden="true" className="absolute inset-0" />
          </GlobalLink>
        )}
      </h3>
      {place || source ? (
        <div className="flex flex-col gap-0.5">
          {place ? (
            <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
              {place}
            </p>
          ) : null}
          {source ? (
            <p className="m-0 text-[14px]" style={{ color: T.ink.dim }}>
              Records from {source}
            </p>
          ) : null}
        </div>
      ) : null}
      {preview && drive.summary ? (
        <p
          className="m-0 text-[14px] leading-[1.55]"
          style={{ color: T.ink.base }}
        >
          {drive.summary}
        </p>
      ) : null}

      <div className="mt-auto flex flex-col gap-1.5 pt-1">
        {progress ? (
          <>
            <span
              aria-hidden="true"
              className="block h-2 overflow-hidden rounded-full"
              style={{ background: T.border.divider }}
            >
              <span
                className="block h-full"
                style={{ width: `${progress.percent}%`, background: tint.fg }}
              />
            </span>
            <span className="flex flex-wrap justify-between gap-x-3 text-[14px]">
              <span style={{ color: T.ink.dim }}>
                <strong style={{ color: T.ink.base }}>
                  {fmt(progress.done)}
                </strong>{" "}
                of {fmt(progress.total)} {unitNoun(drive.unit, progress.total)}
              </span>
              {helpers != null ? (
                <span style={{ color: T.ink.dim }}>{fmt(helpers)} helping</span>
              ) : null}
            </span>
          </>
        ) : (
          <span className="text-[14px]" style={{ color: T.ink.dim }}>
            Not counted yet
          </span>
        )}
      </div>
    </article>
  )
}
