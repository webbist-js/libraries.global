"use client"

import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

/**
 * The staff drawer's edge tab: fixed to the right edge on desktop, a 44 px
 * white tab with an icon disc and the word "Staff" turned on its side.
 * Hidden below `lg`, where the menu items open the drawer instead.
 */
export function StaffDrawerTab({ onOpen }: { readonly onOpen: () => void }) {
  return (
    <button
      aria-label="Open the staff drawer"
      className="fixed right-0 z-[60] hidden w-11 flex-col items-center gap-2 border border-r-0 pt-2 pb-3 transition-colors hover:bg-(--t-bg-surface) lg:flex"
      onClick={onOpen}
      style={{
        top: "50%",
        transform: "translateY(-50%)",
        background: T.bg.deep,
        borderColor: T.border.line,
        borderRadius: "20px 0 0 20px",
        color: T.ink.base,
      }}
      title="Staff drawer (Alt+S)"
      type="button"
    >
      <span
        aria-hidden="true"
        className="flex size-8 items-center justify-center rounded-full"
        style={{ background: T.accent.chip, color: T.accent.primary }}
      >
        <Icon height={17} icon="mdi:account-group-outline" width={17} />
      </span>
      <span
        aria-hidden="true"
        className="text-[13px] font-semibold tracking-wide"
        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
      >
        Staff
      </span>
    </button>
  )
}
