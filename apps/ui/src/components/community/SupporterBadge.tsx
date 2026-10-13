import { useTranslations as useUiTranslations } from "next-intl"

import { Badge } from "@/components/ds/Badge"

export function SupporterBadge() {
  const tUi = useUiTranslations("ui")

  return (
    <Badge label={tUi("supporter")} color="aurora" icon="mdi:heart-outline" />
  )
}
