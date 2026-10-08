"use client"

import { useTransition } from "react"

import { Notice } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

/**
 * A staff page's inline failure: the part that couldn't load, why in one
 * line, and "Try again", which re-renders the segment. Used in place of
 * throwing, so the shell, tabs and header stay on screen. A 429 gets its
 * own line so the reader knows to wait rather than retry at once.
 */
export function StaffLoadError({
  what,
  status,
  onRetry,
}: {
  /** What couldn't load, e.g. "Notices". */
  readonly what: string
  /** The upstream HTTP status, when known. */
  readonly status?: number
  /** Replaces the default `router.refresh()`. */
  readonly onRetry?: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const limited = status === 429
  const title = limited
    ? `${what} paused for a moment`
    : `${what} couldn’t be loaded`

  return (
    <Notice icon="mdi:alert-circle-outline" tone="warn" title={title}>
      <p className="m-0" style={{ color: T.ink.base }}>
        {limited
          ? "Too many requests in a short time. Wait a few seconds, then try again."
          : "The Staff area is temporarily unavailable. Try again in a moment."}
      </p>
      <p className="m-0 mt-1">
        <button
          type="button"
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-full border bg-white px-4 text-[14px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:opacity-60"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
          onClick={() =>
            startTransition(() => {
              if (onRetry) onRetry()
              else router.refresh()
            })
          }
        >
          {pending ? "Trying again…" : "Try again"}
        </button>
      </p>
    </Notice>
  )
}
