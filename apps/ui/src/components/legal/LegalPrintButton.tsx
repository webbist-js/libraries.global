"use client"
import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"

export function LegalPrintButton({
  compact = false,
}: {
  readonly compact?: boolean
}) {
  const tStatic = useTranslations("staticUi")

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
      {tStatic("frontendExtra.print_or_save_pdf")}
    </Button>
  )
}
