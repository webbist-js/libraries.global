"use client"

import { Icon } from "@iconify/react"
import { useTranslations as useUiTranslations } from "next-intl"
import { useEffect } from "react"

import { useCapabilities, useStaff } from "@/lib/access-client"
import { T } from "@/lib/design-tokens"
import {
  closeEditorialDrawer,
  openEditorialDrawer,
  toggleEditorialDrawer,
  useEditorialDrawer,
} from "@/lib/editorial/drawer"
import { usePathname } from "@/lib/navigation"
import { useStaffDrawer } from "@/lib/staff/drawer"

import { EDITORIAL_CAPABILITIES, EditorialDrawer } from "./EditorialDrawer"

/** Sections with no room for an edge tab. */
const NO_TAB_PREFIXES = ["/map", "/live"]
/** Where the staff tab hides (`StaffDrawerMount`). */
const NO_STAFF_TAB_PREFIXES = ["/map", "/live", "/staff"]

const under = (pathname: string, prefixes: readonly string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

/** Text fields where Alt+E types a character (macOS "´"). */
const isTyping = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  if (target.tagName === "TEXTAREA" || target.isContentEditable) return true
  if (target.tagName !== "INPUT") return false
  const type = (target as HTMLInputElement).type

  return !["button", "checkbox", "radio", "range", "submit", "reset"].includes(
    type
  )
}

/**
 * The editorial drawer's edge tab: the staff tab's twin, sitting under it
 * when the viewer has both.
 */
function EditorialDrawerTab({ belowStaff }: { readonly belowStaff: boolean }) {
  const tUi = useUiTranslations("ui")

  return (
    <button
      aria-label={tUi("open_the_editorial_drawer")}
      className="fixed right-0 z-[60] hidden w-11 flex-col items-center gap-2 border border-r-0 pt-2 pb-3 transition-colors hover:bg-(--t-bg-surface) lg:flex"
      onClick={openEditorialDrawer}
      style={{
        top: belowStaff ? "calc(50% + 64px)" : "50%",
        transform: belowStaff ? undefined : "translateY(-50%)",
        background: T.bg.deep,
        borderColor: T.border.line,
        borderRadius: "20px 0 0 20px",
        color: T.ink.base,
      }}
      title={tUi("editorial_drawer_alte")}
      type="button"
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full"
        style={{ background: T.accent.chip, color: T.accent.primary }}
      >
        <Icon height={17} icon="mdi:feather" width={17} />
      </span>
      <span
        aria-hidden="true"
        className="text-sm font-semibold tracking-wide"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        {tUi("editorial")}
      </span>
    </button>
  )
}

/**
 * Mounts the editorial drawer for editors, Moderators and the editorial
 * board: the edge tab (desktop, outside the map and the live console), the
 * Alt+E shortcut, and the drawer itself while open. Renders nothing for
 * everyone else.
 */
export function EditorialDrawerMount() {
  const { has, ready } = useCapabilities()
  const { libraries } = useStaff()
  const open = useEditorialDrawer()
  const { open: staffOpen } = useStaffDrawer()
  const pathname = usePathname()
  const editorial = ready && EDITORIAL_CAPABILITIES.some((cap) => has(cap))

  useEffect(() => {
    if (!editorial) return
    const onKey = (event: KeyboardEvent) => {
      if (
        !event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isTyping(event.target)
      )
        return
      // `code` survives Alt producing a different character on macOS.
      if (event.code === "KeyE" || event.key.toLowerCase() === "e") {
        event.preventDefault()
        toggleEditorialDrawer()
      }
    }
    window.addEventListener("keydown", onKey)

    return () => window.removeEventListener("keydown", onKey)
  }, [editorial])

  // Leaving the page, or opening the staff drawer, closes it.
  useEffect(() => {
    closeEditorialDrawer()
  }, [pathname])
  useEffect(() => {
    if (staffOpen) closeEditorialDrawer()
  }, [staffOpen])

  if (!editorial) return null
  const hideTab = open || staffOpen || under(pathname, NO_TAB_PREFIXES)
  const belowStaff =
    libraries.length > 0 && !under(pathname, NO_STAFF_TAB_PREFIXES)

  return (
    <>
      {hideTab ? null : <EditorialDrawerTab belowStaff={belowStaff} />}
      {open ? <EditorialDrawer /> : null}
    </>
  )
}
