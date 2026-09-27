"use client"

import { Icon } from "@iconify/react"

export function LegalPrintButton() {
  return (
    <button
      className="inline-flex items-center gap-1.5 rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) px-3.5 py-2 text-[14px] font-semibold text-(--t-ink-base) transition-colors hover:bg-(--t-bg-muted)"
      onClick={() => window.print()}
      type="button"
    >
      <Icon
        aria-hidden="true"
        height={15}
        icon="mdi:printer-outline"
        width={15}
      />
      Print or save PDF
    </button>
  )
}
