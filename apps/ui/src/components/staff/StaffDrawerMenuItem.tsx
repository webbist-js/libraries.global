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
}: {
  readonly drawer?: keyof typeof DRAWERS
  readonly iconColor?: string
}) {
  const d = DRAWERS[drawer]

  return (
    <DropdownMenuItem
      className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-[15px] font-medium focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base)"
      onSelect={() => d.open()}
      style={{ color: T.ink.base }}
    >
      <Icon
        aria-hidden="true"
        className="shrink-0"
        height={19}
        icon={d.icon}
        style={{ color: iconColor }}
        width={19}
      />
      <span className="min-w-0 flex-1">{d.label}</span>
      <kbd
        aria-label={`Shortcut: Alt ${d.key}`}
        className="rounded-md border px-1.5 text-[11px] font-semibold"
        style={{
          borderColor: T.border.hi,
          color: T.ink.dim,
          fontFamily: T.font.sans,
        }}
      >
        ⌥{d.key}
      </kbd>
    </DropdownMenuItem>
  )
}
