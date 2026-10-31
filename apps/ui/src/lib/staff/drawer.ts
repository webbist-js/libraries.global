"use client"

import { useSyncExternalStore } from "react"

import { handoffProfileDrawer } from "@/lib/profile-drawer"
import { workspaceView } from "@/lib/workspace-analytics"

/**
 * Whether the staff drawer is open, and which library it should show when
 * a menu item opens it for one. A tiny store so the user menu, the
 * Contribute dropdown, the edge tab and the Alt+S shortcut share one state.
 */
type DrawerState = { open: boolean; libraryDocumentId: string | null }
let state: DrawerState = { open: false, libraryDocumentId: null }
const listeners = new Set<() => void>()

function set(next: DrawerState): void {
  state = next
  for (const fn of listeners) fn()
}

export function openStaffDrawer(libraryDocumentId?: string): void {
  handoffProfileDrawer(() => {
    const changed = !state.open
    set({ open: true, libraryDocumentId: libraryDocumentId ?? null })
    if (changed)
      workspaceView({
        workspace_area: "staff",
        workspace_section: "overview",
        workspace_surface: "drawer",
      })
  })
}

export function closeStaffDrawer(): void {
  set({ open: false, libraryDocumentId: null })
}

export function toggleStaffDrawer(): void {
  if (state.open) closeStaffDrawer()
  else openStaffDrawer()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)

  return () => {
    listeners.delete(fn)
  }
}
const read = () => state
const closed: DrawerState = { open: false, libraryDocumentId: null }
const serverRead = () => closed

export function useStaffDrawer(): DrawerState {
  return useSyncExternalStore(subscribe, read, serverRead)
}

/** The library the drawer last showed, kept per browser. */
export const DRAWER_LIBRARY_KEY = "lg.staff.drawer.library"

export function readLastDrawerLibrary(): string | null {
  try {
    return globalThis.localStorage?.getItem(DRAWER_LIBRARY_KEY) ?? null
  } catch {
    return null
  }
}

export function rememberDrawerLibrary(documentId: string): void {
  try {
    globalThis.localStorage?.setItem(DRAWER_LIBRARY_KEY, documentId)
  } catch {
    // Private windows and blocked storage: the default still works.
  }
}
