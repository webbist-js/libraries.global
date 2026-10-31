import { Icon } from "@iconify/react"

import { T, TYPE_TINT } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

export type QuickAction = {
  icon: string
  label: string
  href: string
  /** A short tag after the label, e.g. "Mobile". */
  tag?: string
}

/** The Overview's quick actions: bordered icon rows that each go somewhere. */
export function QuickActions({
  actions,
}: {
  readonly actions: readonly QuickAction[]
}) {
  return (
    <section
      className="rounded-[28px] border p-5 sm:p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby="quick-actions-heading"
    >
      <h2
        id="quick-actions-heading"
        className="type-panel-title m-0"
        style={{ color: T.ink.base }}
      >
        Quick actions
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {actions.map((action) => (
          <li key={action.href + action.label}>
            <Link
              href={action.href}
              className="flex min-h-14 items-center gap-3 rounded-[16px] border px-4 py-3 no-underline transition-colors hover:bg-(--t-bg-muted)"
              style={{
                background: T.bg.surface,
                borderColor: T.border.line,
                color: T.ink.base,
              }}
            >
              <span
                aria-hidden="true"
                className="flex shrink-0 items-center justify-center"
                style={{ color: T.accent.primary }}
              >
                <Icon icon={action.icon} width={20} height={20} />
              </span>
              <span className="flex-1 text-base font-semibold">
                {action.label}
                {action.tag ? (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-xs font-semibold"
                    style={{
                      background: TYPE_TINT.public.bg,
                      color: TYPE_TINT.public.fg,
                    }}
                  >
                    {action.tag}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
