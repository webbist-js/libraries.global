"use client"

import { useSyncExternalStore } from "react"

/**
 * The library the current page is about, for the staff drawer's default
 * choice. `LibraryDetailPage` registers itself through `CurrentLibraryMarker`
 * and clears on unmount; everything else reads it with `useCurrentLibrary`.
 */
let current: string | null = null
const listeners = new Set<() => void>()

export function setCurrentLibrary(documentId: string | null): void {
  if (current === documentId) return
  current = documentId
  for (const fn of listeners) fn()
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)

  return () => {
    listeners.delete(fn)
  }
}
const read = () => current
const serverRead = () => null

export function useCurrentLibrary(): string | null {
  return useSyncExternalStore(subscribe, read, serverRead)
}
