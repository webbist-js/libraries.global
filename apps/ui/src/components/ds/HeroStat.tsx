import { T } from "@/lib/design-tokens"

// ── HeroStat ──────────────────────────────────────────────────────────────────

export function HeroStat({
  label,
  value,
  note,
}: {
  readonly label: string
  readonly value: string | number
  readonly note?: string
}) {
  return (
    <div
      style={{
        padding: "20px 22px",
        background: "rgba(5,8,22,.5)",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
      }}
    >
      <span
        style={{
          fontFamily: T.font.mono,
          fontSize: "10px",
          letterSpacing: ".2em",
          textTransform: "uppercase",
          color: T.ink.low,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: T.font.serif,
          fontWeight: 400,
          fontSize: "40px",
          letterSpacing: "-.02em",
          lineHeight: 1,
          color: T.ink.base,
        }}
      >
        {value}
      </span>
      {note ? (
        <span
          style={{
            fontSize: "12px",
            color: T.ink.low,
            fontWeight: 300,
            marginTop: "2px",
          }}
        >
          {note}
        </span>
      ) : null}
    </div>
  )
}

// ── HeroStatsGrid ─────────────────────────────────────────────────────────────

export function HeroStatsGrid({
  children,
  cols = 2,
}: {
  readonly children: React.ReactNode
  readonly cols?: 1 | 2 | 3 | 4
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "2px",
        border: `1px solid ${T.border.line}`,
        borderRadius: "18px",
        overflow: "hidden",
        background: "rgba(8,12,30,.55)",
        backdropFilter: "blur(10px)",
      }}
    >
      {children}
    </div>
  )
}

// ── HeroInlineTabNav ──────────────────────────────────────────────────────────

export function HeroInlineTabNav({
  tabs,
}: {
  readonly tabs: readonly { id: string; label: string }[]
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        padding: "3px",
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        background: T.bg.surface,
        marginTop: "28px",
        width: "fit-content",
      }}
    >
      {tabs.map((tab, i) => (
        <a
          key={tab.id}
          href={`#${tab.id}`}
          style={{
            padding: "8px 16px",
            borderRadius: "10px",
            fontSize: "13px",
            color: i === 0 ? T.accent.aurora : T.ink.dim,
            background: i === 0 ? "rgba(127,223,255,.1)" : "transparent",
            textDecoration: "none",
            transition: "color 200ms",
            whiteSpace: "nowrap",
          }}
          className={i !== 0 ? "hover:text-(--t-ink-base)" : ""}
        >
          {tab.label}
        </a>
      ))}
    </div>
  )
}
