import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { eventTypeTint } from "@/components/events/event-display"

export const EVENT_TYPE_META = {
  talk: {
    icon: "mdi:microphone-outline",
    color: "var(--tint-national-fg)",
  },
  exhibition: {
    icon: "mdi:image-frame",
    color: "var(--tint-special-fg)",
  },
  storytime: {
    icon: "mdi:book-open-page-variant-outline",
    color: "var(--tint-special-fg)",
  },
  book_club: {
    icon: "mdi:book-multiple-outline",
    color: "var(--t-palette-amber-fg)",
  },
  workshop: {
    icon: "mdi:code-tags",
    color: "var(--tint-academic-fg)",
  },
  tour: {
    icon: "mdi:map-marker-outline",
    color: "var(--tint-public-fg)",
  },
  screening: {
    icon: "mdi:film-outline",
    color: "var(--tint-national-fg)",
  },
  reading_group: {
    icon: "mdi:account-group-outline",
    color: "var(--t-palette-amber-fg)",
  },
  performance: {
    icon: "mdi:music-note-outline",
    color: "var(--tint-national-fg)",
  },
  drop_in: {
    icon: "mdi:home-outline",
    color: "var(--tint-public-fg)",
  },
  other: {
    icon: "mdi:calendar-blank-outline",
    color: "var(--tint-neutral-fg)",
  },
}

export type EventTypeKey = keyof typeof EVENT_TYPE_META
export function eventTypeKey(type: string): EventTypeKey {
  return Object.hasOwn(EVENT_TYPE_META, type) ? (type as EventTypeKey) : "other"
}

interface EventTypeChipProps {
  readonly type: string
  readonly size?: "xs" | "sm"
}

export function EventTypeChip({ type, size = "sm" }: EventTypeChipProps) {
  const t = useTranslations("eventListing.types")
  const meta = EVENT_TYPE_META[eventTypeKey(type)]
  const tint = eventTypeTint(type)

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full font-semibold"
      style={{
        fontSize: size === "xs" ? "12px" : "13px",
        color: tint.fg,
        background: tint.bg,
        padding: size === "xs" ? "2px 8px" : "3px 10px",
      }}
    >
      <Icon
        icon={meta.icon}
        className={size === "xs" ? "size-3" : "size-3.5"}
      />
      {t(eventTypeKey(type))}
    </span>
  )
}
