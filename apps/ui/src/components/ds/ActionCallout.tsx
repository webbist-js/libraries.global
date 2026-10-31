import { Icon } from "@iconify/react"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { buttonVariants } from "@/components/ui/button"

/** A compact promotional panel with a single action beside its copy. */
export function ActionCallout({
  headingId,
  title,
  eyebrow,
  icon,
  children,
  action,
}: {
  readonly headingId: string
  readonly title: ReactNode
  readonly eyebrow?: ReactNode
  readonly icon?: string
  readonly children: ReactNode
  readonly action: { readonly href: string; readonly label: string }
}) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-wrap items-center gap-5 rounded-3xl border border-(--t-accent-primary)/15 bg-(--t-accent-chip) p-5 sm:p-7 lg:gap-x-10"
    >
      <div className="max-w-[72ch] min-w-0 flex-[1_1_24rem]">
        {eyebrow ? (
          <p className="m-0 mb-2 text-xs font-semibold text-(--t-accent-primary)">
            {eyebrow}
          </p>
        ) : null}
        <h2 id={headingId} className="type-h2 m-0 flex items-center gap-2">
          {icon ? (
            <Icon
              aria-hidden="true"
              className="shrink-0 text-(--t-accent-primary)"
              height={22}
              icon={icon}
              width={22}
            />
          ) : null}
          <span>{title}</span>
        </h2>
        <p className="mt-3 mb-0 text-base leading-relaxed text-(--t-ink-dim)">
          {children}
        </p>
      </div>
      <GlobalLink
        href={action.href}
        className={buttonVariants({
          variant: "surface",
          size: "pill-sm",
          className: "border-(--t-border-hi) px-5 py-3",
        })}
      >
        {action.label}
        <Icon aria-hidden="true" icon="mdi:arrow-right" width={17} />
      </GlobalLink>
    </section>
  )
}
