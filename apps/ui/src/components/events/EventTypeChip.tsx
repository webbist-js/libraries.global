import { Icon } from "@iconify/react"

import { eventTypeTint } from "@/components/events/event-display"

export const EVENT_TYPE_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  talk: {
    label: "Talk",
    icon: "mdi:microphone-outline",
    color: "var(--tint-national-fg)",
  },
  exhibition: {
    label: "Exhibition",
    icon: "mdi:image-frame",
    color: "var(--tint-special-fg)",
  },
  storytime: {
    label: "Storytime",
    icon: "mdi:book-open-page-variant-outline",
    color: "var(--tint-special-fg)",
  },
  book_club: {
    label: "Book club",
    icon: "mdi:book-multiple-outline",
    color: "#6B5420",
  },
  workshop: {
    label: "Workshop",
    icon: "mdi:code-tags",
    color: "var(--tint-academic-fg)",
  },
  tour: {
    label: "Tour",
    icon: "mdi:map-marker-outline",
    color: "var(--tint-public-fg)",
  },
  screening: {
    label: "Screening",
    icon: "mdi:film-outline",
    color: "var(--tint-national-fg)",
  },
  reading_group: {
    label: "Reading group",
    icon: "mdi:account-group-outline",
    color: "#6B5420",
  },
  performance: {
    label: "Performance",
    icon: "mdi:music-note-outline",
    color: "var(--tint-national-fg)",
  },
  drop_in: {
    label: "Drop-in",
    icon: "mdi:home-outline",
    color: "var(--tint-public-fg)",
  },
  other: {
    label: "Event",
    icon: "mdi:calendar-blank-outline",
    color: "var(--tint-neutral-fg)",
  },
}

interface EventTypeChipProps {
  readonly type: string
  readonly size?: "xs" | "sm"
}

export function EventTypeChip({ type, size = "sm" }: EventTypeChipProps) {
  const meta = EVENT_TYPE_META[type] ?? EVENT_TYPE_META.other!
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
      {meta.label}
    </span>
  )
}
