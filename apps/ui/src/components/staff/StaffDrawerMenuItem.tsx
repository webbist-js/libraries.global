"use client"

import { Icon } from "@iconify/react"

import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { T } from "@/lib/design-tokens"
import { openStaffDrawer } from "@/lib/staff/drawer"

/** "Staff drawer" as a dropdown item: opens the drawer instead of a page. */
export function StaffDrawerMenuItem({
  iconColor = T.ink.dim,
}: {
  readonly iconColor?: string
}) {
  return (
    <DropdownMenuItem
      className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-[15px] font-medium focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base)"
      onSelect={() => openStaffDrawer()}
      style={{ color: T.ink.base }}
    >
      <Icon
        aria-hidden="true"
        className="shrink-0"
        height={19}
        icon="mdi:dock-right"
        style={{ color: iconColor }}
        width={19}
      />
      <span className="min-w-0 flex-1">Staff drawer</span>
      <kbd
        aria-label="Shortcut: Alt S"
        className="rounded-md border px-1.5 text-[11px] font-semibold"
        style={{
          borderColor: T.border.hi,
          color: T.ink.dim,
          fontFamily: T.font.sans,
        }}
      >
        ⌥S
      </kbd>
    </DropdownMenuItem>
  )
}
