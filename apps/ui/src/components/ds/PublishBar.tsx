"use client"
import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import { T } from "@/lib/design-tokens"
import { primaryCtaSm } from "@/lib/styles"

/**
 * The staff editors' publish control. With unpublished changes it is a
 * sticky bar: the count, Discard and Publish. With none it collapses to a
 * quiet "No unpublished changes" line (or the last status, e.g. "Timetable
 * published.") with no buttons, so a page never offers an action it can't
 * take. The live region is always mounted, so a status change is announced.
 */
export function PublishBar({
  count,
  status,
  busy,
  onDiscard,
  onPublish,
  publishLabel = "Publish changes",
}: {
  count: number
  /** A line in place of the count: "Timetable published.", with links. */
  status?: ReactNode
  busy?: boolean
  onDiscard: () => void
  onPublish: () => void
  publishLabel?: string
}) {
  const quiet = count === 0 && !busy

  return (
    <div
      className={
        quiet
          ? "mt-6 flex items-center gap-2 px-1 text-sm"
          : "sticky bottom-4 z-20 mt-8 flex flex-wrap items-center gap-4 rounded-[20px] border p-4"
      }
      style={
        quiet
          ? { color: T.ink.dim }
          : { background: T.bg.deep, borderColor: T.border.hi }
      }
    >
      {quiet ? (
        <Icon
          aria-hidden="true"
          icon="mdi:check-circle-outline"
          width={16}
          height={16}
          className="shrink-0"
          style={{ color: status ? T.accent.ok : T.ink.dim }}
        />
      ) : null}
      <p className="m-0 flex-1" aria-live="polite">
        {status ??
          (quiet
            ? "No unpublished changes"
            : `${count} unpublished change${count === 1 ? "" : "s"}`)}
      </p>
      {quiet ? null : (
        <>
          <button
            type="button"
            onClick={onDiscard}
            disabled={busy || !count}
            className="inline-flex min-h-11 items-center rounded-full border bg-white px-5 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
            style={{ borderColor: T.border.hi, color: T.ink.base }}
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={busy || !count}
            className={`${primaryCtaSm} min-h-11 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {busy ? "Publishing…" : publishLabel}
          </button>
        </>
      )}
    </div>
  )
}
