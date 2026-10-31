"use client"

import { useSearchParams } from "next/navigation"
import { createContext } from "react"

import type { WorkspaceView } from "@/components/moderation/workspace"
import { usePathname } from "@/lib/navigation"

export type ModerationPageNavigation = {
  readonly route: string
  readonly active: WorkspaceView["id"] | "overview"
  readonly views: readonly WorkspaceView[]
}

/** Queue pages supply their server-filtered counts and return URLs to the rail. */
export const ModerationNavigationContext = createContext<
  ((navigation: ModerationPageNavigation) => () => void) | null
>(null)

export function useModerationRoute() {
  return `${usePathname()}?${useSearchParams().toString()}`
}
