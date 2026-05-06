import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

export const EVENT_TYPE_META: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  talk: { label: "Talk", icon: "mdi:microphone-outline", color: "#a390ff" },
  exhibition: {
    label: "Exhibition",
    icon: "mdi:image-frame",
    color: "#7fdfff",
  },
  storytime: {
    label: "Storytime",
    icon: "mdi:book-open-page-variant-outline",
    color: "#ffb88a",
  },
  book_club: {
    label: "Book Club",
    icon: "mdi:book-multiple-outline",
    color: "#e8c98a",
  },
  workshop: { label: "Workshop", icon: "mdi:laptop", color: "#7fdfff" },
  tour: { label: "Tour", icon: "mdi:map-marker-path", color: "#8ef0b3" },
  screening: { label: "Screening", icon: "mdi:film-outline", color: "#a390ff" },
  reading_group: {
    label: "Reading Group",
    icon: "mdi:account-group-outline",
    color: "#ffb88a",
  },
  performance: {
    label: "Performance",
    icon: "mdi:music-note-outline",
    color: "#e8c98a",
  },
  drop_in: {
    label: "Drop-in",
    icon: "mdi:calendar-check-outline",
    color: "#8ef0b3",
  },
  other: {
    label: "Event",
    icon: "mdi:calendar-blank-outline",
    color: "#7fdfff",
  },
}

interface EventTypeChipProps {
  readonly type: string
  readonly size?: "xs" | "sm"
}

export function EventTypeChip({ type, size = "sm" }: EventTypeChipProps) {
  const meta = EVENT_TYPE_META[type] ?? EVENT_TYPE_META.other!
  const fontSize = "10px"
  const padding = size === "xs" ? "2px 6px" : "3px 8px"

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border"
      style={{
        fontFamily: T.font.mono,
        fontSize,
        letterSpacing: ".14em",
        textTransform: "uppercase",
        color: meta.color,
        borderColor: `${meta.color}28`,
        background: `${meta.color}0d`,
        padding,
        flexShrink: 0,
      }}
    >
      <Icon
        icon={meta.icon}
        className={size === "xs" ? "size-2" : "size-2.5"}
      />
      {meta.label}
    </span>
  )
}
