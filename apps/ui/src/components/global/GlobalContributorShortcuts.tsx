"use client"

import { Icon } from "@iconify/react"
import { useId } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { useContributorShortcuts } from "@/hooks/useContributorShortcuts"
import { T } from "@/lib/design-tokens"

const STYLES = {
  mobile: {
    wrapper: "mt-3 flex flex-col gap-4 border-t pt-4",
    group: "flex flex-col gap-1",
    title: "m-0 px-4 pb-1 text-[13px] font-semibold",
    list: "m-0 flex list-none flex-col gap-1 p-0",
    link: "flex min-h-12 items-center gap-3 rounded-2xl px-4 text-[17px] font-medium text-(--t-ink-base) hover:bg-(--t-bg-muted-2)",
  },
  footer: {
    wrapper: "flex flex-col gap-8 border-t pt-8 md:flex-row",
    group: "flex flex-col gap-4 md:flex-1",
    title: "m-0 text-[18px] font-bold",
    list: "m-0 flex list-none flex-wrap gap-2 p-0",
    link: "inline-flex items-center gap-2 rounded-full border border-(--t-border-hi) bg-white px-3.5 py-2 text-[15px] font-medium text-(--t-ink-base) transition-colors hover:border-(--t-accent-primary) hover:text-(--t-accent-primary)",
  },
} as const

/**
 * The signed-in user's role shortcuts as headed link lists: a section in the
 * mobile menu, or a row of pills under the footer's link columns. Renders
 * nothing for people without an editor role.
 */
export function GlobalContributorShortcuts({
  variant,
}: {
  readonly variant: "mobile" | "footer"
}) {
  const groups = useContributorShortcuts()
  const baseId = useId()
  if (groups.length === 0) return null
  const s = STYLES[variant]

  return (
    <div
      className={s.wrapper}
      style={{
        borderColor: variant === "mobile" ? T.border.divider : T.border.line,
      }}
    >
      {groups.map((group) => {
        const titleId = `${baseId}-${group.key}`

        return (
          <nav key={group.key} aria-labelledby={titleId} className={s.group}>
            <p id={titleId} className={s.title} style={{ color: T.ink.dim }}>
              {group.title}
            </p>
            <ul className={s.list}>
              {group.items.map((item) => (
                <li key={`${item.href}:${item.label}`}>
                  <GlobalLink href={item.href} className={s.link}>
                    <Icon
                      icon={item.icon}
                      width={18}
                      height={18}
                      aria-hidden="true"
                      className="shrink-0"
                      style={{ color: T.accent.primary }}
                    />
                    {item.label}
                    {item.external ? (
                      <>
                        <Icon
                          icon="mdi:open-in-new"
                          width={14}
                          height={14}
                          aria-hidden="true"
                          className="shrink-0"
                          style={{ color: T.ink.dim }}
                        />
                        <span className="sr-only">
                          {" "}
                          (opens the CMS in a new tab)
                        </span>
                      </>
                    ) : null}
                  </GlobalLink>
                </li>
              ))}
            </ul>
          </nav>
        )
      })}
    </div>
  )
}

GlobalContributorShortcuts.displayName = "GlobalContributorShortcuts"

export default GlobalContributorShortcuts
