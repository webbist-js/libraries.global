"use client"
import { T } from "@/lib/design-tokens"
import type { MobileStopHit, MobileVisitFilter } from "@/lib/mobile-stop-search"

import { Icon, Segmented } from "./atlas-ui"

const PERIOD_COPY: Record<MobileVisitFilter, string> = {
  any: "Every stop on every timetable.",
  today: "Stops with a scheduled visit today, in each service’s timezone.",
  week: "Stops with a scheduled visit in the next seven days.",
  live: "Stops on services sharing live updates now.",
}

export function AtlasMobileFilters({
  value,
  onChange,
  total = 0,
}: {
  readonly value: MobileVisitFilter
  readonly onChange: (value: MobileVisitFilter) => void
  readonly total?: number
}) {
  return (
    <section
      className="-mx-4 mb-5 border-b px-4 pt-1 pb-4 md:-mx-5 md:px-5"
      style={{ borderColor: T.border.line }}
      aria-label="Mobile libraries"
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-lg border-2"
          style={{ color: T.map.stopRing, borderColor: T.map.stopRing }}
        >
          <Icon name="bus" size={16} />
        </span>
        <h3 className="m-0 flex-1 text-[15px] font-bold">Mobile libraries</h3>
        <span
          className="text-[13px] font-semibold"
          style={{ color: T.ink.dim }}
          aria-live="polite"
        >
          {total.toLocaleString()} {total === 1 ? "stop" : "stops"}
        </span>
      </div>
      <Segmented
        className="w-full rounded-[16px] [&>button]:min-h-11 [&>button]:min-w-0 [&>button]:rounded-xl [&>button]:px-1.5 [&>button]:text-[13px]"
        label="Mobile library visits"
        value={value}
        onChange={onChange}
        options={[
          { value: "any", label: "All" },
          { value: "today", label: "Today" },
          { value: "week", label: "This week" },
          {
            value: "live",
            label: (
              <>
                <span
                  aria-hidden="true"
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: T.map.stopRing }}
                />
                Live
              </>
            ),
          },
        ]}
      />
      <p
        className="m-0 mt-2 text-[13px] leading-normal"
        style={{ color: T.ink.dim }}
      >
        {PERIOD_COPY[value]}
      </p>
    </section>
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
