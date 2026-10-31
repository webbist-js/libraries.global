"use client"

import { useId, useMemo, useState, type ReactNode } from "react"

import { Drawer } from "@/components/ds/Drawer"
import { useHydratedSession } from "@/lib/access-client"
import { DASHBOARD_LAYOUT_STYLE } from "@/lib/dashboard-layout"
import { useEditorialDrawer } from "@/lib/editorial/drawer"
import { usePathname } from "@/lib/navigation"
import { useProfileDrawer } from "@/lib/profile-drawer"
import { useStaffDrawer } from "@/lib/staff/drawer"

import {
  DashboardOverlayContext,
  useDashboardOverlay,
  type DashboardPanel as Panel,
} from "./DashboardOverlayContext"
import { useDashboardHistory } from "./useDashboardScroll"

export {
  useDashboardOverlay,
  useOptionalDashboardOverlay,
} from "./DashboardOverlayContext"

type Overlay = {
  panel: Panel
  pathname: string
  actor: string
  trigger: HTMLElement
}

/** Route-local adoption boundary. Children keep their own feature state. */
export function DashboardFrame({
  navigation,
  children,
}: {
  readonly navigation: ReactNode
  readonly children: ReactNode
}) {
  useDashboardHistory()
  const pathname = usePathname()
  const { data: session } = useHydratedSession()
  const actor = session?.user?.id ?? "guest"
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const staff = useStaffDrawer()
  const editorial = useEditorialDrawer()
  const profile = useProfileDrawer()
  // Invalidate rather than merely hide: returning to a route/account must not
  // resurrect a previously open panel. Workspace shortcuts supersede the shell.
  const valid = overlay?.pathname === pathname && overlay.actor === actor
  if (overlay && (!valid || staff.open || editorial || profile.open))
    setOverlay(null)
  const panel =
    valid && !staff.open && !editorial && !profile.open ? overlay.panel : null
  const trigger = valid ? overlay.trigger : null
  const controls = useMemo(
    () => ({
      panel,
      trigger,
      handleToggle: (next: Panel, opener: HTMLElement) =>
        setOverlay((current) =>
          current?.panel === next &&
          current.pathname === pathname &&
          current.actor === actor
            ? null
            : { panel: next, pathname, actor, trigger: opener }
        ),
      handleClose: () => setOverlay(null),
    }),
    [actor, panel, pathname, trigger]
  )

  return (
    <DashboardOverlayContext.Provider value={controls}>
      <div
        className="dashboard-shell"
        style={DASHBOARD_LAYOUT_STYLE}
        data-dashboard-shell="true"
        data-dashboard-workspace={pathname === "/map" ? "atlas" : "pages"}
      >
        {navigation}
        {children}
      </div>
    </DashboardOverlayContext.Provider>
  )
}

/** One modal contract for shell panels, with existing Radix focus behavior. */
export function DashboardDrawer({
  panel,
  title,
  children,
  wide = false,
  onAfterClose,
  footer,
}: {
  readonly panel: Panel
  readonly title: string
  readonly children: ReactNode
  readonly wide?: boolean
  readonly onAfterClose?: () => void
  readonly footer?: ReactNode
}) {
  const overlay = useDashboardOverlay()
  const id = useId()

  return (
    <Drawer
      open={overlay.panel === panel}
      onClose={overlay.handleClose}
      onAfterClose={onAfterClose}
      returnFocusTo={overlay.trigger}
      titleId={id}
      title={title}
      side="left"
      initialFocus={(element) =>
        element.querySelector<HTMLElement>(
          panel === "contribute" ? ".contribute-hub-link" : "button"
        )
      }
      className={`dashboard-drawer ${wide ? "dashboard-drawer-wide" : ""}`}
      footer={footer}
    >
      {children}
    </Drawer>
  )
}
