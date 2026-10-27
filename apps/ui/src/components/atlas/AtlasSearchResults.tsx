import type { ReactNode } from "react"

import { T, TYPE_TINT } from "@/lib/design-tokens"

import { Icon } from "./atlas-ui"

export function ResultGroup({
  title,
  children,
}: {
  readonly title: string
  readonly children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-1" aria-label={title}>
      <h3 className="type-small-heading m-0 mb-1">{title}</h3>
      <ul className="m-0 flex list-none flex-col p-0">{children}</ul>
    </section>
  )
}

export function ResultRow({
  icon,
  glyph,
  title,
  sub,
  trailing,
  badge,
  onClick,
}: {
  readonly icon?: "pin" | "book" | "bus"
  readonly glyph?: ReactNode
  readonly title: string
  readonly sub: string
  readonly trailing?: "hist"
  readonly badge?: string
  readonly onClick: () => void
}) {
  const mobile = icon === "bus"

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="-mx-2.5 flex min-h-14 w-[calc(100%+20px)] items-center gap-3 rounded-[14px] px-2.5 py-2 text-left hover:bg-(--t-bg-surface)"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: mobile ? T.bg.deep : T.bg.muted,
            color: mobile ? T.map.stopRing : T.ink.dim,
            border: mobile ? `2px solid ${T.map.stopRing}` : undefined,
          }}
        >
          {glyph ?? <Icon name={icon ?? "pin"} size={18} />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-base font-semibold"
            style={{ color: T.ink.base }}
          >
            {title}
          </span>
          <span className="block truncate text-sm" style={{ color: T.ink.dim }}>
            {sub}
          </span>
        </span>
        {badge ? (
          <span
            className="shrink-0 rounded-full px-2 py-1 text-xs font-bold"
            style={{
              color: TYPE_TINT.public.fg,
              background: TYPE_TINT.public.bg,
            }}
          >
            {badge}
          </span>
        ) : trailing ? (
          <Icon name="hist" size={16} color={T.ink.dim} />
        ) : null}
      </button>
    </li>
  )
}
