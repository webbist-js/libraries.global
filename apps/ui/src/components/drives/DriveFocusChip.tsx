import { Icon } from "@iconify/react"

import type { DriveFocus } from "@/lib/drives/types"

import { focusChipOf } from "./focus-meta"

/** A Drive's Focus as a tinted pill: icon plus label, never colour alone. */
export function DriveFocusChip({ focus }: { readonly focus: DriveFocus }) {
  const { label, icon, tint } = focusChipOf(focus)

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-[5px] text-[14px] font-semibold"
      style={{ background: tint.bg, color: tint.fg }}
    >
      <Icon aria-hidden="true" height={14} icon={icon} width={14} />
      {label}
    </span>
  )
}
