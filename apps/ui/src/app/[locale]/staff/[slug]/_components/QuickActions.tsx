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
      className="rounded-[20px] border p-6"
      style={{ background: T.bg.deep, borderColor: T.border.line }}
      aria-labelledby="quick-actions-heading"
    >
      <h2
        id="quick-actions-heading"
        className="m-0 text-[16px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Quick actions
      </h2>
      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {actions.map((action) => (
          <li key={action.href + action.label}>
            <Link
              href={action.href}
              className="group flex min-h-12 items-center gap-3 rounded-[14px] border px-3.5 py-2 no-underline transition-colors hover:bg-(--t-bg-surface)"
              style={{ borderColor: T.border.line, color: T.ink.base }}
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-full"
                style={{ background: T.accent.chip, color: T.accent.primary }}
              >
                <Icon icon={action.icon} width={17} height={17} />
              </span>
              <span className="flex-1 text-[15px] font-semibold">
                {action.label}
                {action.tag ? (
                  <span
                    className="ml-2 rounded-full px-2 py-0.5 text-[12px] font-semibold"
                    style={{
                      background: TYPE_TINT.public.bg,
                      color: TYPE_TINT.public.fg,
                    }}
                  >
                    {action.tag}
                  </span>
                ) : null}
              </span>
              <Icon
                aria-hidden="true"
                icon="mdi:arrow-right"
                width={16}
                height={16}
                className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                style={{ color: T.ink.dim }}
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
