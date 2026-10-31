"use client"

import { useSyncExternalStore } from "react"

const KEY = "libraries-global:journal-saved:v1"
const EVENT = "journal-saved-changed"

export function parseSavedJournal(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]")

    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string =>
                typeof id === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(id)
            )
          ),
        ].slice(0, 100)
      : []
  } catch {
    return []
  }
}
function snapshot() {
  try {
    return localStorage.getItem(KEY) ?? "[]"
  } catch {
    return "[]"
  }
}
function subscribe(listener: () => void) {
  const storage = (event: StorageEvent) => {
    if (event.key === KEY || event.key === null) listener()
  }
  window.addEventListener(EVENT, listener)
  window.addEventListener("storage", storage)

  return () => {
    window.removeEventListener(EVENT, listener)
    window.removeEventListener("storage", storage)
  }
}

export function useSavedJournal() {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]")

  return parseSavedJournal(raw)
}
export function toggleSavedJournal(id: string): boolean {
  try {
    const current = parseSavedJournal(snapshot())
    localStorage.setItem(
      KEY,
      JSON.stringify(
        current.includes(id)
          ? current.filter((value) => value !== id)
          : [id, ...current].slice(0, 100)
      )
    )
    window.dispatchEvent(new Event(EVENT))

    return true
  } catch {
    return false
  }
}
