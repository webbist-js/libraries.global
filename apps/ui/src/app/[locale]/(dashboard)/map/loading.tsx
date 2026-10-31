import { useTranslations } from "next-intl"

import { RecordToolbar } from "@/components/dashboard/RecordToolbar"
import { MapLoading } from "@/components/map/MapLoading"

export default function MapPageLoading() {
  const ui = useTranslations("ui")

  return (
    <div
      className="flex min-h-0 flex-1 flex-col bg-(--t-bg-surface)"
      data-hide-footer="true"
    >
      <RecordToolbar items={[{ label: ui("atlas") }]} />
      <div className="relative min-h-0 flex-1">
        <MapLoading />
      </div>
    </div>
  )
}
