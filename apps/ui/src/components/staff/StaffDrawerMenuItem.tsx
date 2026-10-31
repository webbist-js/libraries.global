"use client"

import { Icon } from "@iconify/react"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { T } from "@/lib/design-tokens"
import { openEditorialDrawer } from "@/lib/editorial/drawer"
import { openStaffDrawer } from "@/lib/staff/drawer"

const DRAWERS = {
  staff: {
    label: "Staff drawer",
    icon: "mdi:dock-right",
    key: "S",
    open: () => openStaffDrawer(),
  },
  editorial: {
    label: "Editorial drawer",
    icon: "mdi:feather",
    key: "E",
    open: openEditorialDrawer,
  },
} as const

/** "Staff drawer" or "Editorial drawer" as a dropdown item: opens the
 * drawer instead of a page. */
export function StaffDrawerMenuItem({
  drawer = "staff",
  iconColor = T.ink.dim,
  presentation = "menu",
  onOpen,
  compact = false,
  label,
}: {
  readonly drawer?: keyof typeof DRAWERS
  readonly iconColor?: string
  readonly presentation?: "menu" | "button"
  readonly compact?: boolean
  readonly label?: string
  readonly onOpen?: (open: () => void) => void
}) {
  const d = DRAWERS[drawer]
  const content = (
    <>
      <Icon
        aria-hidden
        className="shrink-0"
        height={19}
        icon={d.icon}
        style={{ color: iconColor }}
        width={19}
      />
      <span className="min-w-0 flex-1">{label ?? d.label}</span>
      <kbd
        aria-label={`Shortcut: Alt ${d.key}`}
        className="rounded-md border px-1.5 text-xs font-semibold"
        style={{
          borderColor: T.border.hi,
          color: T.ink.dim,
          fontFamily: T.font.sans,
        }}
      >
        ⌥{d.key}
      </kbd>
    </>
  )
  const open = () => (onOpen ? onOpen(d.open) : d.open())
  const className = `flex ${compact ? "min-h-10 w-auto text-sm" : "min-h-11 w-full text-base"} cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2.5 font-medium hover:bg-(--t-bg-muted-2) focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base)`

  if (presentation === "button")
    return (
      <button
        type="button"
        className={className}
        style={{ color: T.ink.base }}
        onClick={open}
      >
        {content}
      </button>
    )

  return (
    <DropdownMenuItem
      className={className}
      onSelect={open}
      style={{ color: T.ink.base }}
    >
      {content}
    </DropdownMenuItem>
  )
}
