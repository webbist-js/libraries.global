"use client"

import dynamic from "next/dynamic"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { DrawerPresence } from "@/components/ds/DrawerPresence"
import { useHydratedSession } from "@/lib/access-client"
import { betaPath } from "@/lib/beta/scope"
import {
  betaWelcomeVisit,
  BETA_WELCOME_KEY,
  type BetaWelcomeVisit,
} from "@/lib/beta/welcome"

const BetaWelcome = dynamic(() => import("./BetaWelcome"), { ssr: false })

/** Mounted only inside the protected beta shell. No polling or persistent dismissal. */
export function BetaWelcomeMount({ sandbox }: { readonly sandbox: boolean }) {
  const pathname = betaPath(usePathname() ?? "/")
  const { data, isPending, error } = useHydratedSession()
  const scope = data?.user?.id ?? "guest"
  const [open, setOpen] = useState(false)
  const visit = useRef<BetaWelcomeVisit | null>(null)
  const excluded =
    /^\/(?:auth|beta|live)(?:\/|$)/.test(pathname) ||
    pathname === "/staff/teams/new" ||
    pathname === "/staff/teams/billing"

  useEffect(() => {
    if (isPending || error || excluded) return
    let active = true
    const readVisit = () => {
      if (!active) return
      let raw: string | null = null
      try {
        raw = sessionStorage.getItem(BETA_WELCOME_KEY)
      } catch {
        /* Use the mounted visit when storage is unavailable. */
      }
      visit.current = betaWelcomeVisit(
        raw ?? (visit.current ? JSON.stringify(visit.current) : null),
        scope,
        Date.now()
      )
      try {
        sessionStorage.setItem(BETA_WELCOME_KEY, JSON.stringify(visit.current))
      } catch {
        /* Optional persistence. */
      }
      setOpen(!visit.current.dismissed)
    }
    const leaving = () => {
      if (!visit.current) return
      visit.current.lastSeen = Date.now()
      try {
        sessionStorage.setItem(BETA_WELCOME_KEY, JSON.stringify(visit.current))
      } catch {
        /* Optional persistence. */
      }
    }
    const visible = () => {
      if (document.visibilityState === "visible") readVisit()
      else leaving()
    }
    // Read browser persistence after the current route/session render settles.
    queueMicrotask(readVisit)
    document.addEventListener("visibilitychange", visible)
    window.addEventListener("pagehide", leaving)

    return () => {
      active = false
      document.removeEventListener("visibilitychange", visible)
      window.removeEventListener("pagehide", leaving)
    }
  }, [scope, isPending, error, excluded, pathname])

  const dismiss = () => {
    visit.current = { scope, lastSeen: Date.now(), dismissed: true }
    try {
      sessionStorage.setItem(BETA_WELCOME_KEY, JSON.stringify(visit.current))
    } catch {
      /* Optional persistence. */
    }
    setOpen(false)
  }

  return !isPending && !error && !excluded ? (
    <DrawerPresence key={scope} open={open}>
      {(onAfterClose) => (
        <BetaWelcome
          open={open}
          onAfterClose={onAfterClose}
          sandbox={sandbox}
          onClose={dismiss}
        />
      )}
    </DrawerPresence>
  ) : null
}
