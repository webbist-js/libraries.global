"use client"

import { createContext, useContext } from "react"

export type DashboardPanel = "navigation" | "contribute" | "section"

/** Reading shell context must not import session, drawer stores or history effects. */
export const DashboardOverlayContext = createContext<{
  panel: DashboardPanel | null
  trigger: HTMLElement | null
  handleToggle: (panel: DashboardPanel, trigger: HTMLElement) => void
  handleClose: () => void
} | null>(null)

export function useDashboardOverlay() {
  const context = useContext(DashboardOverlayContext)
  if (!context) throw new Error("Dashboard panels require DashboardFrame")

  return context
}

export function useOptionalDashboardOverlay() {
  return useContext(DashboardOverlayContext)
}
