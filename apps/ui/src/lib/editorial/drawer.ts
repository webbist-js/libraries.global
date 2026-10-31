"use client"

import { useSyncExternalStore } from "react"

import { handoffProfileDrawer } from "@/lib/profile-drawer"
import { closeStaffDrawer } from "@/lib/staff/drawer"
import { workspaceView } from "@/lib/workspace-analytics"

/**
 * Whether the editorial drawer is open. A tiny store so the user menu, the
 * edge tab and the Alt+E shortcut share one state. Opening it closes the
 * staff drawer: one drawer at a time.
 */
let open = false
const listeners = new Set<() => void>()

function set(next: boolean): void {
  open = next
  for (const fn of listeners) fn()
}

export function openEditorialDrawer(): void {
  closeStaffDrawer()
  handoffProfileDrawer(() => {
    const changed = !open
    set(true)
    if (changed)
      workspaceView({
        workspace_area: "editorial",
        workspace_section: "overview",
        workspace_surface: "drawer",
      })
  })
}

export function closeEditorialDrawer(): void {
  if (open) set(false)
}

export function toggleEditorialDrawer(): void {
  if (open) closeEditorialDrawer()
  else openEditorialDrawer()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)

  return () => {
    listeners.delete(fn)
  }
}

export function useEditorialDrawer(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => open,
    () => false
  )
}
