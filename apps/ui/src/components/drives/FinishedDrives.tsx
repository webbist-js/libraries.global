import { Icon } from "@iconify/react"
import { driveDateLabel } from "@repo/shared-data"

import GlobalLink from "@/components/global/GlobalLink"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import type { DriveView } from "@/lib/drives/drive-view"

import { DriveTitle } from "./DriveTitle"
import { focusChipOf, unitNoun } from "./focus-meta"

const fmt = (n: number) => n.toLocaleString("en-GB")

/** "Closed 12 Sep · 31 of 52 libraries · 9 helpers": one line that wraps. */
function finishedLine({
  drive,
  progress,
  helpers,
}: Pick<DriveView, "drive" | "progress" | "helpers">): string {
  return [
    driveDateLabel(drive, new Date()).text,
    progress
      ? `${fmt(progress.done)} of ${fmt(progress.total)} ${unitNoun(drive.unit, progress.total)}`
      : null,
    helpers == null
      ? null
      : `${fmt(helpers)} ${helpers === 1 ? "helper" : "helpers"}`,
  ]
    .filter(Boolean)
    .join(" · ")
}

/**
 * "Recently finished" on the Noticeboard: the last closed drives, one
 * compact row each with the close date, the final count and the helpers.
 * Renders nothing when no drive has finished.
 */
export function FinishedDrives({
  views,
}: {
  readonly views: readonly DriveView[]
}) {
  if (views.length === 0) return null

  return (
    <section
      aria-labelledby="finished-drives-heading"
      className="flex flex-col gap-3.5"
    >
      <h2
        id="finished-drives-heading"
        className="type-h2 m-0"
        style={{
          color: T.ink.base,
        }}
      >
        Recently finished
      </h2>
      <ul
        className="m-0 list-none overflow-hidden p-0"
        style={{
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          borderRadius: 24,
        }}
      >
        {views.map(({ drive, href, progress, helpers }, i) => {
          const look = focusChipOf(drive.focus)

          return (
            <li
              key={drive.documentId}
              className="flex flex-wrap items-center gap-3.5"
              style={{
                padding: "14px 18px",
                borderTop: i > 0 ? `1px solid ${T.border.divider}` : undefined,
              }}
            >
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-[12px]"
                style={{ background: look.tint.bg, color: look.tint.fg }}
              >
                <Icon height={18} icon={look.icon} width={18} />
              </span>
              <span
                className="flex min-w-0 flex-col gap-0.5"
                style={{ flex: "1 1 240px" }}
              >
                <GlobalLink
                  href={href}
                  className="no-underline hover:underline"
                  style={{
                    fontFamily: T.font.sans,
                    fontSize: "var(--type-body-xl-size)",
                    fontWeight: 500,
                    lineHeight: 1.2,
                    color: T.ink.base,
                  }}
                >
                  <DriveTitle title={drive.title} />
                </GlobalLink>
                <span className="text-sm" style={{ color: T.ink.dim }}>
                  {finishedLine({ drive, progress, helpers })}
                </span>
              </span>
              {drive.closedReason === "goal" ? (
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold"
                  style={{
                    background: TYPE_TINT.public.bg,
                    color: T.accent.ok,
                  }}
                >
                  <Icon
                    aria-hidden="true"
                    height={14}
                    icon="mdi:check-circle-outline"
                    width={14}
                  />
                  Goal met
                </span>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
