import { ArrowRight, MapPin, ShieldCheck, UsersRound } from "lucide-react"
import { useTranslations as useUiTranslations } from "next-intl"

import { DriveDates } from "@/components/drives/DriveDates"
import { DriveFocusChip } from "@/components/drives/DriveFocusChip"
import { DriveTitle } from "@/components/drives/DriveTitle"
import { focusChipOf, unitNoun } from "@/components/drives/focus-meta"
import GlobalLink from "@/components/global/GlobalLink"
import { analyticsAttributes } from "@/lib/analytics-events"
import type { DriveView } from "@/lib/drives/drive-view"

const fmt = (value: number) => value.toLocaleString("en-GB")

/** Compact opportunities keep the task, place and real progress together. */
function HubDriveRow({ view }: { readonly view: DriveView }) {
  const tUi = useUiTranslations("ui")
  const { drive, progress, helpers, href, place, source } = view
  const { tint } = focusChipOf(drive.focus)
  const titleId = "hub-drive-" + drive.documentId

  return (
    <article
      aria-labelledby={titleId}
      className="group relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-4 rounded-[20px] p-5 text-(--t-ink-base) no-underline transition-colors focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-(--t-accent-primary) hover:bg-(--t-bg-surface) sm:p-6 md:grid-cols-[minmax(0,1fr)_220px_auto]"
    >
      <div className="min-w-0">
        <div className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <DriveFocusChip focus={drive.focus} compact />
          <DriveDates drive={drive} />
        </div>
        <h3
          id={titleId}
          className="type-h3 m-0 group-hover:text-(--t-accent-primary)"
        >
          <GlobalLink
            href={href}
            {...analyticsAttributes("select_content", {
              interaction_source: "drive",
              content_type: "drive",
              content_id: drive.documentId,
            })}
            className="text-inherit no-underline after:absolute after:inset-0 after:rounded-[20px] focus-visible:outline-none"
          >
            <DriveTitle title={drive.title} />
          </GlobalLink>
        </h3>
        {place || source ? (
          <p className="mt-2 mb-0 flex items-start gap-1.5 text-sm leading-relaxed text-(--t-ink-dim)">
            <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              {place}
              {place && source ? " · " : ""}
              {source ? tUi("records_from") + " " + source : ""}
            </span>
          </p>
        ) : null}
      </div>
      <div className="col-start-1 grid min-w-0 gap-2 md:col-start-auto">
        {progress ? (
          <>
            <p className="m-0 text-sm text-(--t-ink-dim)">
              <strong className="font-bold text-(--t-ink-base)">
                {fmt(progress.done)}
              </strong>{" "}
              of {fmt(progress.total)} {unitNoun(drive.unit, progress.total)}
            </p>
            <span
              aria-hidden
              className="block h-1.5 overflow-hidden rounded-full bg-(--t-divider)"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width:
                    Math.min(100, Math.max(0, progress.percent)).toFixed(2) +
                    "%",
                  background: tint.fg,
                }}
              />
            </span>
          </>
        ) : (
          <p className="m-0 text-sm text-(--t-ink-dim)">Not counted yet</p>
        )}
        {helpers != null ? (
          <p className="m-0 flex items-center gap-1.5 text-xs text-(--t-ink-dim)">
            <UsersRound size={14} aria-hidden />
            {helpers === 0 ? "Be the first to help" : fmt(helpers) + " helping"}
          </p>
        ) : null}
      </div>
      <span className="col-start-2 row-start-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-(--t-border-line) bg-(--t-bg-deep) text-(--t-accent-primary) group-hover:border-[#b9b4f5] md:col-start-3">
        <ArrowRight size={18} aria-hidden />
      </span>
    </article>
  )
}

/** The hub offers up to three drives; a list adapts naturally to any count. */
export function DrivesYouCanHelpWith({
  views,
}: {
  readonly views: readonly DriveView[]
}) {
  const tUi = useUiTranslations("ui")
  if (views.length === 0) return null

  return (
    <section
      aria-labelledby="hub-drives"
      className="mx-auto w-full max-w-[1360px] px-4 pt-10 pb-2 sm:px-8"
    >
      <div className="overflow-hidden rounded-[28px] border border-(--t-border-line) bg-(--t-bg-deep)">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 pt-6 pb-4 sm:px-8 sm:pt-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 id="hub-drives" className="type-h2 m-0 text-(--t-ink-base)">
                Drives you can help with
              </h2>
              <span className="rounded-full bg-(--t-bg-muted) px-2.5 py-0.5 text-sm font-bold text-(--t-ink-dim)">
                {views.length}
              </span>
            </div>
            <p className="mt-2 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
              Choose a place and a task. Start with a few changes you can
              source.
            </p>
          </div>
          <GlobalLink
            href="/community"
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-(--t-border-hi) px-4 py-2 text-sm font-semibold text-(--t-accent-primary) no-underline hover:bg-(--t-bg-surface)"
          >
            {tUi("all_drives")}
            <ArrowRight size={16} aria-hidden />
          </GlobalLink>
        </div>

        <ul className="mx-3 my-0 grid list-none divide-y divide-(--t-border-line) p-0 sm:mx-4">
          {views.map((view) => (
            <li key={view.drive.documentId} className="min-w-0">
              <HubDriveRow view={view} />
            </li>
          ))}
        </ul>
        <p className="m-0 flex items-center gap-2 border-t border-(--t-border-line) bg-(--t-bg-surface) px-6 py-4 text-sm text-(--t-ink-dim) sm:px-8">
          <ShieldCheck
            size={16}
            className="shrink-0 text-(--t-accent-primary)"
            aria-hidden
          />
          Every change is reviewed before it reaches a library’s record.
        </p>
      </div>
    </section>
  )
}

DrivesYouCanHelpWith.displayName = "DrivesYouCanHelpWith"

export default DrivesYouCanHelpWith
