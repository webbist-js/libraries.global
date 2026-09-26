"use client"

import {
  FilterGroup,
  FilterHelper,
  FilterOption,
  FilterPanelHeader,
} from "@/components/ds"
import {
  type EventsFilters,
  type TimeSlot,
  type WhenScope,
  DEFAULT_EVENTS_FILTERS,
  TIME_SLOT_LABEL,
} from "@/components/events/event-display"
import { EVENT_TYPE_META } from "@/components/events/EventTypeChip"

const WHEN_OPTIONS: { value: WhenScope; label: string }[] = [
  { value: "any", label: "Any time" },
  { value: "today", label: "Today" },
  { value: "weekend", label: "This weekend" },
  { value: "7d", label: "Next 7 days" },
  { value: "30d", label: "Next 30 days" },
]

const TIME_SLOTS: TimeSlot[] = ["morning", "afternoon", "evening", "allday"]

/** Number of active (non-default) facet selections, excluding search. */
export function activeEventsFilterCount(filters: EventsFilters): number {
  return (
    (filters.when === DEFAULT_EVENTS_FILTERS.when ? 0 : 1) +
    filters.types.length +
    filters.times.length +
    (filters.freeOnly ? 1 : 0)
  )
}

export function EventsFilterPanel({
  filters,
  onChange,
  typeCounts,
  timeCounts,
  freeCount,
}: {
  readonly filters: EventsFilters
  readonly onChange: (next: EventsFilters) => void
  readonly typeCounts: Map<string, number>
  readonly timeCounts: Map<TimeSlot, number>
  readonly freeCount: number
}) {
  const toggleType = (type: string) => {
    const types = filters.types.includes(type)
      ? filters.types.filter((t) => t !== type)
      : [...filters.types, type]
    onChange({ ...filters, types })
  }

  const toggleTime = (slot: TimeSlot) => {
    const times = filters.times.includes(slot)
      ? filters.times.filter((t) => t !== slot)
      : [...filters.times, slot]
    onChange({ ...filters, times })
  }

  // Only offer types that exist in the data (or are selected)
  const typeOptions = Object.entries(EVENT_TYPE_META).filter(
    ([key]) =>
      key !== "other" &&
      ((typeCounts.get(key) ?? 0) > 0 || filters.types.includes(key))
  )

  return (
    <div>
      <FilterPanelHeader onReset={() => onChange(DEFAULT_EVENTS_FILTERS)} />

      <FilterGroup
        title="When"
        icon={
          <>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </>
        }
      >
        {WHEN_OPTIONS.map((option) => (
          <FilterOption
            key={option.value}
            type="radio"
            name="events-when"
            label={option.label}
            checked={filters.when === option.value}
            onChange={() => onChange({ ...filters, when: option.value })}
          />
        ))}
      </FilterGroup>

      <FilterGroup
        title="Type"
        icon={<path d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" />}
      >
        {typeOptions.length === 0 ? (
          <FilterHelper>Types appear as events are listed.</FilterHelper>
        ) : (
          typeOptions.map(([key, meta]) => (
            <FilterOption
              key={key}
              type="checkbox"
              name="events-type"
              label={meta.label}
              count={typeCounts.get(key) ?? 0}
              checked={filters.types.includes(key)}
              onChange={() => toggleType(key)}
            />
          ))
        )}
      </FilterGroup>

      <FilterGroup
        title="Time of day"
        icon={
          <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </>
        }
      >
        {TIME_SLOTS.map((slot) => (
          <FilterOption
            key={slot}
            type="checkbox"
            name="events-time"
            label={TIME_SLOT_LABEL[slot]}
            count={timeCounts.get(slot) ?? 0}
            checked={filters.times.includes(slot)}
            onChange={() => toggleTime(slot)}
          />
        ))}
      </FilterGroup>

      <FilterGroup
        title="Price"
        icon={
          <>
            <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
            <circle cx="8" cy="8" r="1.5" />
          </>
        }
      >
        <FilterOption
          type="checkbox"
          name="events-price"
          label="Free"
          count={freeCount}
          checked={filters.freeOnly}
          onChange={() => onChange({ ...filters, freeOnly: !filters.freeOnly })}
        />
      </FilterGroup>
    </div>
  )
}
