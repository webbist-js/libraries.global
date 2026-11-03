"use client"

import { useCallback, useEffect, useRef, useState } from "react"

/** How often the review page renews its lock while visible (ADR-0008). */
export const RENEW_MS = 45_000

export type ReviewLockView =
  | { state: "checking" }
  | { state: "mine" }
  | { state: "held"; holderName: string | null; takenOver: boolean }
  | { state: "free" }
  | { state: "unavailable" }

type LockResponse = {
  data?: { state: "mine" | "held" | "free"; holderName?: string | null }
}

const lockUrl = (documentId: string) =>
  `/api/moderation/locks/${encodeURIComponent(documentId)}`

/**
 * Holds the Review Lock on a pending submission while its review page is
 * open: takes it on mount, renews it every 45 seconds while the tab is
 * visible, and releases it on leaving. Strapi enforces the lock on writes;
 * if this can't reach the lock service the page stays usable.
 */
export function useReviewLock(documentId: string, active: boolean) {
  const [view, setView] = useState<ReviewLockView>(
    active ? { state: "checking" } : { state: "free" }
  )
  const held = useRef(false)

  const send = useCallback(
    async (action: "acquire" | "takeover") => {
      const res = await fetch(lockUrl(documentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }).catch(() => null)
      if (!res?.ok) {
        if (!held.current) setView({ state: "unavailable" })

        return
      }
      const lock = ((await res.json()) as LockResponse).data
      if (lock?.state === "mine") {
        held.current = true
        setView({ state: "mine" })
      } else if (lock?.state === "held") {
        setView({
          state: "held",
          holderName: lock.holderName ?? null,
          takenOver: held.current,
        })
        held.current = false
      } else setView({ state: "free" })
    },
    [documentId]
  )

  useEffect(() => {
    if (!active) return
    const renew = () => {
      if (document.visibilityState === "visible") void send("acquire")
    }
    renew()
    const timer = window.setInterval(renew, RENEW_MS)
    const release = () => {
      if (!held.current) return
      held.current = false
      fetch(lockUrl(documentId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "release" }),
        keepalive: true,
      }).catch(() => {})
    }
    document.addEventListener("visibilitychange", renew)
    window.addEventListener("pagehide", release)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", renew)
      window.removeEventListener("pagehide", release)
      release()
    }
  }, [active, documentId, send])

  return {
    view,
    takeOver: () => send("takeover"),
  }
}
