import { CircleHelp, ArrowRight } from "lucide-react"
import type { ReactNode } from "react"

import GlobalLink from "@/components/global/GlobalLink"
import { navigationAttributes } from "@/lib/analytics-events"

/** One fixed-footer card for contextual contributions and next actions. */
export function DashboardSidebarCta({
  title,
  body,
  action,
  secondary,
  children,
}: {
  readonly title: string
  readonly body: string
  readonly action:
    | { label: string; href: string }
    | { label: string; onClick: () => void }
  readonly secondary?: { label: string; href: string }
  readonly children?: ReactNode
}) {
  const handleAction = "onClick" in action ? action.onClick : undefined

  return (
    <section className="dashboard-sidebar-cta">
      <CircleHelp
        className="dashboard-sidebar-cta-icon"
        size={26}
        aria-hidden
      />
      <div className="dashboard-sidebar-cta-content">
        <h2 className="type-small-heading m-0">{title}</h2>
        <p className="sr-only">{body}</p>
        {"href" in action ? (
          <GlobalLink
            className="dashboard-sidebar-cta-action"
            href={action.href}
            {...navigationAttributes(action.href, "sidebar")}
          >
            {action.label}
            <ArrowRight size={14} aria-hidden />
          </GlobalLink>
        ) : (
          <button
            type="button"
            className="dashboard-sidebar-cta-action"
            onClick={handleAction}
          >
            {action.label}
            <ArrowRight size={14} aria-hidden />
          </button>
        )}

        {secondary ? (
          <GlobalLink
            className="dashboard-sidebar-cta-secondary"
            href={secondary.href}
            {...navigationAttributes(secondary.href, "sidebar")}
          >
            {secondary.label}
          </GlobalLink>
        ) : null}
        {children}
      </div>
    </section>
  )
}
