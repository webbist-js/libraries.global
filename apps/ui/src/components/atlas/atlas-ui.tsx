"use client"

// Small presentational pieces shared by the Atlas Explorer panels.

import type React from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"
import { cn } from "@/lib/styles"

import { RAMP, TYPE_SHAPE } from "./atlas-map.style"
import { TYPE_GROUPS, type TypeGroupKey } from "./atlas.logic"

// ── Icons (stroke paths from the Atlas Explorer design) ─────────────────────

const PATHS = {
  search: "M11 18a7 7 0 100-14 7 7 0 000 14zM20 20l-4-4",
  filter: "M4 5h16M7 12h10M10 19h4",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v6M12 7.5v.5",
  lock: "M6 11h12v10H6zM8.5 11V8a3.5 3.5 0 017 0v3",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  locate: "M12 3v3M12 18v3M3 12h3M18 12h3M12 17a5 5 0 100-10 5 5 0 000 10z",
  globe:
    "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18",
  check: "M5 12l4 4 10-10",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  pin: "M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  x: "M6 6l12 12M18 6L6 18",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  map: "M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  book: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16",
  route:
    "M6 19a2 2 0 100-4 2 2 0 000 4zM18 9a2 2 0 100-4 2 2 0 000 4zM8 17h7a3 3 0 000-6H9a3 3 0 010-6h7",
  chev: "M9 6l6 6-6 6",
  chevD: "M6 9l6 6 6-6",
  acc: "M12 5.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM5 8h14M12 8v6M9 21l3-7 3 7",
  warn: "M12 3l10 18H2zM12 10v5M12 18v.5",
  off: "M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 014-2.3M19 12.5a10 10 0 00-3-2M2 8.8a15 15 0 015-2.9M22 8.8a15 15 0 00-9.5-3.7",
  ext: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  hist: "M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2",
  sort: "M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4",
  cmp: "M12 3v18M4 7h5M4 12h5M4 17h5M15 7h5M15 12h5M15 17h5",
  panel: "M4 5h16v14H4zM9 5v14",
} as const

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  size = 18,
  color = "currentColor",
  stroke = 1.8,
  className,
}: {
  readonly name: IconName
  readonly size?: number
  readonly color?: string
  readonly stroke?: number
  readonly className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flexShrink: 0 }}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

// ── Pins, badges and chips ──────────────────────────────────────────────────

export function tintOfGroup(key: TypeGroupKey) {
  const g = TYPE_GROUPS.find((x) => x.key === key)!

  return TYPE_TINT[g.tint]
}

/** CSS pin glyph matching the map pin shape for a type group. */
export function PinGlyph({
  group,
  size = 11,
}: {
  readonly group: TypeGroupKey
  readonly size?: number
}) {
  const shape = TYPE_SHAPE[group]
  const fg = tintOfGroup(group).fg

  return (
    <i
      aria-hidden="true"
      className="inline-block shrink-0"
      style={{
        width: size,
        height: size,
        background: shape === "ring" ? "#fff" : fg,
        border: shape === "ring" ? `3px solid ${fg}` : "1.5px solid #fff",
        boxShadow: "0 0 0 1px rgba(23,22,43,.25)",
        borderRadius:
          shape === "circle" || shape === "ring"
            ? "50%"
            : shape === "square"
              ? 3
              : 2,
        transform: shape === "diamond" ? "rotate(45deg) scale(.9)" : undefined,
      }}
    />
  )
}

export function TypeBadge({ group }: { readonly group: TypeGroupKey }) {
  const tint = tintOfGroup(group)
  const label = TYPE_GROUPS.find((g) => g.key === group)!.label

  return (
    <span
      className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold whitespace-nowrap"
      style={{ background: tint.bg, color: tint.fg }}
    >
      <PinGlyph group={group} size={10} />
      {label}
    </span>
  )
}

export function ProChip({ locked = true }: { readonly locked?: boolean }) {
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-bold whitespace-nowrap text-white"
      style={{ background: T.ink.base }}
    >
      {locked ? <Icon name="lock" size={11} stroke={2.4} /> : null}
      Pro
    </span>
  )
}

export function MutedChip({
  children,
}: {
  readonly children: React.ReactNode
}) {
  return (
    <span
      className="inline-flex h-[22px] shrink-0 items-center rounded-full px-2 text-[12px] font-bold whitespace-nowrap"
      style={{ background: T.bg.muted, color: T.ink.dim }}
    >
      {children}
    </span>
  )
}

/** Toggleable filter chip. Selected state is conveyed by tick + weight + colour. */
export function Chip({
  on,
  onClick,
  children,
  tint,
  count,
}: {
  readonly on: boolean
  readonly onClick: () => void
  readonly children: React.ReactNode
  readonly tint?: { bg: string; fg: string }
  readonly count?: number
}) {
  const style: React.CSSProperties = on
    ? tint
      ? { background: tint.bg, borderColor: tint.fg, color: tint.fg }
      : {
          background: T.accent.chip,
          borderColor: T.accent.primary,
          color: "#3730A3",
        }
    : { background: "#fff", borderColor: T.border.hi, color: T.ink.base }

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold whitespace-nowrap"
      style={style}
    >
      {on ? <Icon name="check" size={14} stroke={2.4} /> : null}
      {children}
      {count !== undefined ? (
        <span
          className="font-medium"
          style={{ color: on ? undefined : T.ink.dim }}
        >
          {count.toLocaleString()}
        </span>
      ) : null}
    </button>
  )
}

/** Accessible switch; `locked` renders the dashed Pro variant. */
export function Switch({
  checked,
  onChange,
  label,
  locked = false,
  disabled = false,
}: {
  readonly checked: boolean
  readonly onChange: () => void
  readonly label: string
  readonly locked?: boolean
  readonly disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="relative h-6 w-10 shrink-0 rounded-full disabled:cursor-not-allowed"
      style={{
        background: checked
          ? T.accent.primary
          : locked || disabled
            ? T.bg.surface
            : "#fff",
        border: `1.5px ${locked || disabled ? "dashed" : "solid"} ${checked ? T.accent.primary : "#8A8799"}`,
      }}
    >
      <i
        className="absolute top-[3px] h-[15px] w-[15px] rounded-full transition-[left] motion-reduce:transition-none"
        style={{
          left: checked ? 19 : 3,
          background: checked ? "#fff" : "#8A8799",
        }}
      />
    </button>
  )
}

/** Segmented control (radiogroup). */
export function Segmented<V extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  readonly value: V
  readonly options: { value: V; label: string; icon?: IconName }[]
  readonly onChange: (v: V) => void
  readonly label: string
  readonly className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex gap-0.5 rounded-full p-[3px]", className)}
      style={{ background: T.bg.muted }}
    >
      {options.map((o) => {
        const on = o.value === value

        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-[14px] font-semibold whitespace-nowrap"
            style={
              on
                ? {
                    background: "#fff",
                    color: T.ink.base,
                    boxShadow: `inset 0 0 0 1px ${T.border.hi}`,
                  }
                : { color: T.ink.dim }
            }
          >
            {o.icon ? <Icon name={o.icon} size={15} /> : null}
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Legends ─────────────────────────────────────────────────────────────────

export function RampLegend({
  title,
  source,
  ramp,
  ticks,
  width = 170,
}: {
  readonly title: string
  readonly source: string
  readonly ramp: keyof typeof RAMP
  readonly ticks: string[]
  readonly width?: number
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <span className="text-[13px] font-bold whitespace-nowrap">{title}</span>
      <span
        className="flex h-2.5 overflow-hidden rounded-[3px]"
        style={{ width }}
        aria-hidden="true"
      >
        {RAMP[ramp].map((c) => (
          <span key={c} className="flex-1" style={{ background: c }} />
        ))}
      </span>
      <span
        className="flex justify-between text-[12px]"
        style={{ width, color: "#45435A" }}
      >
        {ticks.map((t, i) => (
          <span key={`${t}-${i}`}>{t}</span>
        ))}
      </span>
      <span
        className="text-[12px] whitespace-nowrap"
        style={{ color: T.ink.dim }}
      >
        {source}
      </span>
    </div>
  )
}

export function KeyLegend({
  title,
  source,
  items,
}: {
  readonly title: string
  readonly source: string
  readonly items: { key: string; label: string; swatch: React.ReactNode }[]
}) {
  return (
    <div className="flex min-w-0 flex-col gap-[5px]">
      <span className="text-[13px] font-bold whitespace-nowrap">{title}</span>
      <span className="flex flex-wrap gap-2.5 text-[13px]">
        {items.map((i) => (
          <span
            key={i.key}
            className="flex items-center gap-[5px] whitespace-nowrap"
          >
            {i.swatch}
            {i.label}
          </span>
        ))}
      </span>
      <span
        className="text-[12px] whitespace-nowrap"
        style={{ color: T.ink.dim }}
      >
        {source}
      </span>
    </div>
  )
}

// ── Range ───────────────────────────────────────────────────────────────────

/** Two native range inputs over one track: keyboard and screen-reader friendly. */
export function YearRange({
  min,
  max,
  value,
  onChange,
}: {
  readonly min: number
  readonly max: number
  readonly value: [number, number]
  readonly onChange: (v: [number, number]) => void
}) {
  const pct = (v: number) => ((v - min) / Math.max(1, max - min)) * 100
  const thumb =
    "pointer-events-none absolute inset-0 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-(--t-accent-primary) [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-(--t-accent-primary) [&::-moz-range-thumb]:bg-white"

  return (
    <div className="relative h-5">
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full"
        style={{ background: T.border.divider }}
      />
      <span
        aria-hidden="true"
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
        style={{
          left: `${pct(value[0])}%`,
          width: `${pct(value[1]) - pct(value[0])}%`,
          background: T.accent.primary,
        }}
      />
      <input
        type="range"
        aria-label="Founded from"
        min={min}
        max={max}
        value={value[0]}
        onChange={(e) =>
          onChange([Math.min(Number(e.target.value), value[1]), value[1]])
        }
        className={thumb}
      />
      <input
        type="range"
        aria-label="Founded until"
        min={min}
        max={max}
        value={value[1]}
        onChange={(e) =>
          onChange([value[0], Math.max(Number(e.target.value), value[0])])
        }
        className={thumb}
      />
    </div>
  )
}

/** Card surface used by floating map panels. */
export const PANEL_STYLE: React.CSSProperties = {
  background: "#fff",
  border: `1px solid ${T.border.line}`,
}
