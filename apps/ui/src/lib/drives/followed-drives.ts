/**
 * The drives a profile follows, as the Following tab lists them. Pure: the
 * server loader is `followed-drives-server.ts`.
 */
import type { Drive } from "./types"

/** At most this many followed drives are loaded for one profile page. */
export const FOLLOWED_DRIVES_SHOWN = 48

/** Drives still running (open, then scheduled) come before finished ones. */
const RANK: Record<Drive["status"], number> = {
  open: 0,
  scheduled: 1,
  closed: 2,
  cancelled: 3,
  draft: 4,
}

/**
 * Open and scheduled drives first, then closed and cancelled ones, each
 * group in the order given (the order they were followed). Never a draft.
 */
export function orderFollowedDrives<T extends { status: Drive["status"] }>(
  drives: readonly T[]
): T[] {
  return drives
    .filter((d) => d.status !== "draft")
    .map((d, i) => ({ d, i }))
    .sort((a, b) => RANK[a.d.status] - RANK[b.d.status] || a.i - b.i)
    .map(({ d }) => d)
}
