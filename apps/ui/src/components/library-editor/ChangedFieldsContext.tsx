"use client"

import { createContext, useContext } from "react"

import type { FormData } from "./wizard.types"

/**
 * Improve mode marks the fields a contributor has changed. Field primitives
 * read this so the step components don't have to thread a prop through
 * every input.
 */
export const ChangedFieldsContext = createContext<ReadonlySet<keyof FormData>>(
  new Set()
)

export function useIsChanged(key: keyof FormData): boolean {
  return useContext(ChangedFieldsContext).has(key)
}
