import type React from "react"

import { T } from "@/lib/design-tokens"

/** Stroke icon rendered from a POC path — server-safe (no iconify). */
export function LibIcon({
  d,
  size = 17,
  className,
}: {
  readonly d: string
  readonly size?: number
  readonly className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <path d={d} />
    </svg>
  )
}

/** Icon paths shared across the library page (POC set). */
export const LIB_ICONS = {
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  photos: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  access:
    "M12 6.5a2 2 0 100-4 2 2 0 000 4zM5 9l7 1.5L19 9M12 10.5V15l-3 6M12 15l3 6",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 21V5M8 7h7",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
  building: "M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18",
  bookmark: "M6 3h12v18l-6-4-6 4z",
  pencil: "M4 20h4L19 9l-4-4L4 16v4z",
  camera: "M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z",
  globe:
    "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18",
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  db: "M12 8c4.4 0 8-1.3 8-3s-3.6-3-8-3-8 1.3-8 3 3.6 3 8 3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  shield: "M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5",
  people:
    "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 6.5M18.5 14a6 6 0 013 6",
  bars: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  train:
    "M7 3h10a2 2 0 012 2v9a3 3 0 01-3 3H8a3 3 0 01-3-3V5a2 2 0 012-2zM5 10h14M8 21l2-4M16 21l-2-4M9 14h.01M15 14h.01",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  plus: "M12 5v14M5 12h14",
} as const

/** Icon-square tints for section headings. */
const TONES = {
  indigo: { bg: T.accent.chip, fg: T.accent.primary },
  public: { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" },
  special: { bg: "var(--tint-special-bg)", fg: "var(--tint-special-fg)" },
  neutral: { bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-fg)" },
} as const

export type SectionTone = keyof typeof TONES

/**
 * White section card: a tinted icon square beside a serif heading, an
 * optional intro line, then the body. `dashed` is the empty-state border;
 * `compact` is the smaller card used three to a row.
 */
export function LibrarySectionCard({
  id,
  title,
  iconPath,
  intro,
  tone = "indigo",
  dashed = false,
  compact = false,
  showIcon = false,
  titleClassName,
  children,
}: {
  readonly id: string
  readonly title: string
  readonly iconPath: string
  readonly intro?: React.ReactNode
  readonly tone?: SectionTone
  readonly dashed?: boolean
  readonly compact?: boolean
  readonly showIcon?: boolean
  readonly titleClassName?: string
  readonly children: React.ReactNode
}) {
  const t = TONES[tone]

  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className={
        compact
          ? "library-section-card flex scroll-mt-8 flex-col"
          : "library-section-card scroll-mt-8"
      }
    >
      <div className="library-section-heading flex items-start gap-3">
        {showIcon ? (
          <span
            aria-hidden="true"
            className={
              compact
                ? "flex size-8 shrink-0 items-center justify-center rounded-[10px]"
                : "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[11px]"
            }
            style={{ background: t.bg, color: t.fg }}
          >
            <LibIcon d={iconPath} size={compact ? 17 : 19} />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2
            id={`${id}-h`}
            className={`type-small-heading ${
              titleClassName ? `m-0 ${titleClassName} ` : "m-0"
            }`}
            style={{
              color: T.ink.base,
            }}
          >
            {title}
          </h2>
          {intro ? (
            <p
              className="mt-1 mb-0 text-sm leading-normal"
              style={{ color: T.ink.dim }}
            >
              {intro}
            </p>
          ) : null}
        </div>
      </div>
      <div
        className={`library-section-body ${dashed ? "missing-content" : ""} ${compact ? "flex flex-1 flex-col" : ""}`}
        style={{
          ...(dashed
            ? {}
            : { background: T.bg.deep, border: `1px solid ${T.border.line}` }),
        }}
      >
        {children}
      </div>
    </section>
  )
}
