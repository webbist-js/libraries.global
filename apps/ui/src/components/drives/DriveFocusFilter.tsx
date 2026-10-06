import { Icon } from "@iconify/react"

import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import type { FocusFilterOption } from "@/lib/drives/drive-view"

import type { FocusFilterKey } from "./focus-meta"

const PILL =
  "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold no-underline transition-colors"

function FilterLink({
  href,
  label,
  icon,
  count,
  current,
}: {
  readonly href: string
  readonly label: string
  readonly icon?: string
  readonly count: number
  readonly current: boolean
}) {
  return (
    <li className="shrink-0">
      <GlobalLink
        href={href}
        aria-current={current ? "page" : undefined}
        className={`${PILL} whitespace-nowrap ${current ? "" : "hover:border-(--t-accent-primary)"}`}
        style={{
          borderColor: current ? T.accent.primary : T.border.hi,
          background: current ? T.accent.chip : T.bg.deep,
          color: current ? T.accent.primaryHover : T.ink.base,
        }}
      >
        {icon ? (
          <Icon aria-hidden="true" height={16} icon={icon} width={16} />
        ) : null}
        {label}
        <span
          className="rounded-full px-2 text-[13px] font-bold"
          style={{ background: T.bg.muted, color: T.ink.dim }}
        >
          {count}
        </span>
      </GlobalLink>
    </li>
  )
}

/**
 * The Noticeboard's focus filter (spec §5.5): "All drives", then a
 * `?focus=` link per kind with an open drive, with counts and
 * `aria-current` on the active one. With one kind or none there is nothing
 * to choose between, so it renders nothing.
 */
export function DriveFocusFilter({
  options,
  total,
  active,
}: {
  readonly options: readonly FocusFilterOption[]
  /** Every open drive, for "All drives". */
  readonly total: number
  readonly active: FocusFilterKey | null
}) {
  if (options.length < 2) return null

  return (
    <nav aria-label="Filter drives by focus">
      <ul className="m-0 flex list-none gap-2 overflow-x-auto p-0 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        <FilterLink
          href="/community#drives"
          label="All drives"
          count={total}
          current={active === null}
        />
        {options.map((o) => (
          <FilterLink
            key={o.key}
            href={`/community?focus=${o.key}#drives`}
            label={o.label}
            icon={o.icon}
            count={o.count}
            current={active === o.key}
          />
        ))}
      </ul>
    </nav>
  )
}
