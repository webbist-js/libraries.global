"use client"

import { useSyncExternalStore } from "react"

import { workspaceView } from "@/lib/workspace-analytics"

export const PROFILE_SECTIONS = [
  "overview",
  "contributions",
  "following",
  "recognition",
  "notifications",
  "membership",
  "settings",
] as const
export type ProfileSection = (typeof PROFILE_SECTIONS)[number]
type State = {
  open: boolean
  section: ProfileSection
  actor: string | null
  trigger: HTMLElement | null
  anchor?: string
}
const closed: State = {
  open: false,
  section: "overview",
  actor: null,
  trigger: null,
}
let state = closed
let guard: (() => boolean) | undefined
let pendingHandoff: (() => void) | null = null
const listeners = new Set<() => void>()
function set(next: State) {
  state = next
  listeners.forEach((listener) => listener())
}

export function openProfileDrawer(
  section: ProfileSection,
  actor: string,
  trigger?: HTMLElement | null,
  anchor?: string
) {
  if (
    state.open &&
    state.actor === actor &&
    state.section !== section &&
    guard &&
    !guard()
  )
    return
  const changed =
    !state.open || state.section !== section || state.actor !== actor
  set({ open: true, section, actor, trigger: trigger ?? state.trigger, anchor })
  if (changed && section !== "membership")
    workspaceView({
      workspace_area: "account",
      workspace_section: section,
      workspace_surface: "drawer",
    })
}
export function closeProfileDrawer(force = false) {
  if (force) pendingHandoff = null
  if (!state.open) return true
  if (!force && guard && !guard()) return false
  set(closed)

  return true
}

/** Keyboard shortcuts and account actions share the same focus/dirty handoff. */
export function handoffProfileDrawer(action: () => void) {
  if (!state.open) {
    action()

    return
  }
  if (closeProfileDrawer()) pendingHandoff = action
}

export function finishProfileHandoff() {
  const action = pendingHandoff
  pendingHandoff = null
  action?.()
}
export function setProfileNavigationGuard(next: () => boolean) {
  guard = next

  return () => {
    if (guard === next) guard = undefined
  }
}
const subscribe = (listener: () => void) => {
  listeners.add(listener)

  return () => {
    listeners.delete(listener)
  }
}

export function useProfileDrawer() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => closed
  )
}

/** Account links are actions; explicit public-profile links opt out in Link. */
export function profileSectionForHref(
  href: string,
  username?: string | null
): { section: ProfileSection; anchor?: string } | null {
  const [path, anchor] = href.split("#")
  if (path === "/profile" || (username && path === `/profile/${username}`))
    return { section: "overview", anchor }
  const routes: Record<string, ProfileSection> = {
    "/profile/settings": "settings",
    "/profile/notifications": "notifications",
    "/profile/membership": "membership",
    ...(username
      ? {
          [`/profile/${username}/following`]: "following",
          [`/profile/${username}/badges`]: "recognition",
          [`/profile/${username}/contributions`]: "contributions",
        }
      : {}),
  }
  const section = path ? routes[path] : undefined

  return section ? { section, anchor } : null
}
