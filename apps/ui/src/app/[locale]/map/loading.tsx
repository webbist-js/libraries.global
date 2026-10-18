import { MapLoading } from "@/components/map/MapLoading"

export default function MapPageLoading() {
  return (
    <div
      className="absolute inset-0 bg-(--t-bg-surface)"
      data-hide-footer="true"
    >
      <MapLoading />
    </div>
  )
}
