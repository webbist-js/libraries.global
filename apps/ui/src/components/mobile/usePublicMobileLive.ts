"use client"
import {
  dayRoute,
  localDateTime,
  toMinutes,
  type MobileTimetable,
  type PublicLiveState,
  type TimetableNotice,
} from "@repo/shared-data"
import { useEffect, useState } from "react"

const snapshots = new Map<
  string,
  { at: number; request: Promise<PublicLiveState | null> }
>()
async function snapshot(id: string): Promise<PublicLiveState | null> {
  const previous = snapshots.get(id)
  if (previous && Date.now() - previous.at < 25_000) return previous.request
  const request = fetch(`/api/mobile/live?ids=${id}`, { cache: "no-store" })
    .then(async (r) => {
      if (!r.ok) return null
      const value = (await r.json()) as { states: PublicLiveState[] }

      return value.states.find((s) => s.libraryDocumentId === id) ?? null
    })
    .catch(() => null)
  if (snapshots.size > 100) snapshots.delete(snapshots.keys().next().value!)
  snapshots.set(id, { at: Date.now(), request })

  return request
}

/** The strip and both maps share one request per library while visible. */
export function usePublicMobileLive(
  id: string | undefined,
  tt: MobileTimetable,
  notices: TimetableNotice[],
  timezone: string,
  status?: string | null
) {
  const [live, setLive] = useState<PublicLiveState | null>(null)
  useEffect(() => {
    let stopped = false,
      first = true,
      latest: PublicLiveState | null = null
    const poll = async () => {
      if (
        !id ||
        document.hidden ||
        ["permanently_closed", "temporarily_closed", "planned"].includes(
          status ?? ""
        )
      )
        return
      const local = localDateTime(new Date(), timezone),
        route = dayRoute(tt, notices, local.date).filter((v) => !v.cancelledBy)
      const active = latest && ["here", "road", "late"].includes(latest.kind)
      const window =
        route.length &&
        local.minute >= toMinutes(route[0]!.arrive) - 30 &&
        local.minute <= toMinutes(route.at(-1)!.depart) + 30
      if (!first && (!latest?.sharesLive || (!window && !active))) return
      first = false
      const state = await snapshot(id)
      if (!stopped) {
        latest = state
        setLive(state)
      }
    }
    void poll()
    const timer = setInterval(() => {
      void poll()
    }, 30_000)
    const visible = () => {
      void poll()
    }
    document.addEventListener("visibilitychange", visible)

    return () => {
      stopped = true
      clearInterval(timer)
      document.removeEventListener("visibilitychange", visible)
    }
  }, [id, tt, notices, timezone, status])

  return live
}
