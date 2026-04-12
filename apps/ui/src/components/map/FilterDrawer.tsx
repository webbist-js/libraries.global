"use client"

import { LIBRARY_TYPES, OPERATIONAL_STATUSES } from "@/lib/meilisearch"
import { cn } from "@/lib/styles"

export interface MapFilterState {
  libraryTypes: string[]
  operationalStatuses: string[]
  continentSlugs: string[]
}

export const DEFAULT_FILTER_STATE: MapFilterState = {
  libraryTypes: [],
  operationalStatuses: [],
  continentSlugs: [],
}

interface FilterDrawerProps {
  open: boolean
  onClose: () => void
  filters: MapFilterState
  onChange: (filters: MapFilterState) => void
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm text-white/70 hover:text-white">
      <span
        className={cn(
          "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors",
          checked
            ? "border-indigo-500 bg-indigo-500"
            : "border-white/20 bg-white/4"
        )}
        onClick={() => onChange(!checked)}
      >
        {checked && (
          <svg viewBox="0 0 10 8" fill="none" className="h-2.5 w-2.5">
            <path
              d="M1 4l3 3 5-6"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span onClick={() => onChange(!checked)}>{label}</span>
    </label>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-semibold tracking-widest text-white/30 uppercase">
      {children}
    </h3>
  )
}

export default function FilterDrawer({
  open,
  onClose,
  filters,
  onChange,
}: FilterDrawerProps) {
  const activeCount =
    filters.libraryTypes.length +
    filters.operationalStatuses.length +
    filters.continentSlugs.length

  function toggle<K extends keyof MapFilterState>(key: K, value: string) {
    const current = filters[key] as string[]
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ ...filters, [key]: next })
  }

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div className="absolute inset-0 z-30 bg-black/40" onClick={onClose} />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "absolute top-0 bottom-0 left-0 z-40 flex w-72 flex-col bg-[#080d1c]/95 shadow-2xl backdrop-blur-xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">Filters</span>
            {activeCount > 0 && (
              <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {activeCount}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-white/50 hover:bg-white/8 hover:text-white"
          >
            <svg viewBox="0 0 14 14" fill="none" className="h-4 w-4">
              <path
                d="M2 2l10 10M12 2L2 12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Library Type */}
          <div className="mb-6">
            <SectionHeading>Library Type</SectionHeading>
            {LIBRARY_TYPES.map((type) => (
              <CheckRow
                key={type}
                label={type}
                checked={filters.libraryTypes.includes(type)}
                onChange={() => toggle("libraryTypes", type)}
              />
            ))}
          </div>

          {/* Operational Status */}
          <div className="mb-6">
            <SectionHeading>Status</SectionHeading>
            {OPERATIONAL_STATUSES.map(({ value, label }) => (
              <CheckRow
                key={value}
                label={label}
                checked={filters.operationalStatuses.includes(value)}
                onChange={() => toggle("operationalStatuses", value)}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        {activeCount > 0 && (
          <div className="border-t border-white/8 p-4">
            <button
              onClick={() => onChange(DEFAULT_FILTER_STATE)}
              className="w-full rounded-lg border border-white/12 py-2 text-sm text-white/60 hover:border-white/24 hover:text-white"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </>
  )
}
