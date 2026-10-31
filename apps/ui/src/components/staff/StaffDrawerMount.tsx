"use client"

import { useEffect } from "react"

import { DrawerPresence } from "@/components/ds/DrawerPresence"
import { useHydratedSession, useStaff } from "@/lib/access-client"
import { contributionAccountScope } from "@/lib/contribution-account-scope"
import { usePathname } from "@/lib/navigation"
import {
  closeStaffDrawer,
  openStaffDrawer,
  toggleStaffDrawer,
  useStaffDrawer,
} from "@/lib/staff/drawer"

import { StaffDrawer } from "./StaffDrawer"
import { StaffDrawerTab } from "./StaffDrawerTab"

/** Sections that carry their own staff entry points, or none at all. */
const NO_TAB_PREFIXES = ["/map", "/live", "/staff"]

/** Inputs where Alt+S may type a character (macOS "ß"), so the shortcut
 * stays out of the way. A select or a button has no text to type into: the
 * drawer's own autofocused library select must still close with Alt+S. */
const TEXTLESS_INPUTS = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
])

const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === "TEXTAREA" || target.isContentEditable) return true
  if (tag === "INPUT")
    return !TEXTLESS_INPUTS.has((target as HTMLInputElement).type)

  return false
}

/**
 * Mounts the staff drawer for staff: the edge tab (desktop, outside the
 * map, the live console and the staff area), the Alt+S shortcut, and the
 * drawer itself while open. Renders nothing for everyone else.
 */
export function StaffDrawerMount() {
  const session = useHydratedSession()
  const certain = !session.isPending && !session.error
  const scope = contributionAccountScope(
    certain ? session.data?.user : undefined
  )
  const { libraries, ready } = useStaff()
  const { open } = useStaffDrawer()
  const pathname = usePathname()
  const staff = certain && ready && libraries.length > 0

  useEffect(() => {
    if (!staff) return
    const onKey = (event: KeyboardEvent) => {
      if (
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTyping(event.target)
      )
        return
      // `code` survives Alt producing a different character on macOS.
      if (event.code === "KeyS" || event.key.toLowerCase() === "s") {
        event.preventDefault()
        toggleStaffDrawer()
      }
    }
    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [staff])

  // Leaving the page closes it, like any other overlay.
  useEffect(() => {
    closeStaffDrawer()
  }, [pathname, scope])

  if (!staff) return null
  const hideTab =
    open ||
    NO_TAB_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))

  return (
    <>
      <span hidden={hideTab}>
        <StaffDrawerTab onOpen={() => openStaffDrawer()} />
      </span>
      <DrawerPresence key={scope} open={open}>
        {(onAfterClose) => (
          <StaffDrawer open={open} onAfterClose={onAfterClose} />
        )}
      </DrawerPresence>
    </>
  )
}
