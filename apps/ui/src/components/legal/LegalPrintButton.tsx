"use client"

import { Icon } from "@iconify/react"

import { Button } from "@/components/ui/button"

export function LegalPrintButton({
  compact = false,
}: {
  readonly compact?: boolean
}) {
  return (
    <Button
      variant="surface"
      size={compact ? "sm" : "pill"}
      onClick={() => window.print()}
      type="button"
    >
      <Icon
        aria-hidden="true"
        height={18}
        icon="mdi:printer-outline"
        width={18}
      />
      Print or save PDF
    </Button>
  )
}
