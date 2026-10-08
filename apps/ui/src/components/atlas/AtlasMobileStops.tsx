"use client"
import { SegmentedControl } from "@/components/ds"
import { T } from "@/lib/design-tokens"
import type { MobileStopHit, MobileVisitFilter } from "@/lib/mobile-stop-search"

export function AtlasMobileFilters({
  value,
  onChange,
}: {
  readonly value: MobileVisitFilter
  readonly onChange: (value: MobileVisitFilter) => void
}) {
  return (
    <div className="my-4">
      <p className="mb-2 text-sm font-bold">Mobile libraries</p>
      <SegmentedControl
        label="Mobile library visits"
        value={value}
        onChange={onChange}
        options={[
          { value: "any", label: "All stops" },
          { value: "today", label: "Visits today" },
          { value: "week", label: "This week" },
          { value: "live", label: "Live now" },
        ]}
      />
    </div>
  )
}
export function AtlasMobileStops({
  stops,
  total,
  zoomIn,
  onPick,
}: {
  readonly stops: MobileStopHit[]
  readonly total: number
  readonly zoomIn: boolean
  readonly onPick: (stop: MobileStopHit) => void
}) {
  return (
    <section
      className="max-h-80 overflow-auto border-t p-4"
      style={{ borderColor: T.border.line }}
      aria-label="Mobile stops in view"
    >
      <h3 className="text-lg font-bold">
        Stops in view · {total.toLocaleString()}
      </h3>
      {zoomIn || total > 200 ? (
        <p className="text-sm" style={{ color: T.ink.dim }}>
          Zoom in to see the rest.
        </p>
      ) : null}
      {!stops.length && !zoomIn ? (
        <p>No mobile stops match this view.</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {stops.slice(0, 200).map((stop) => (
            <li key={stop.id}>
              <button
                type="button"
                className="min-h-11 w-full rounded-[14px] px-3 py-2 text-left hover:bg-(--t-accent-chip)"
                onClick={() => onPick(stop)}
              >
                <span
                  className="font-semibold"
                  style={{ color: T.map.stopRing }}
                >
                  <span aria-hidden="true">▢ </span>
                  {stop.name}
                </span>
                <span className="block text-sm" style={{ color: T.ink.dim }}>
                  {stop.library_name} · {stop.where}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
