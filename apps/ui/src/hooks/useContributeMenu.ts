"use client"

import type { PlanKey } from "@repo/access"
import { useQuery } from "@tanstack/react-query"
import { useState } from "react"

import { useModerationSummary } from "@/hooks/useModerationSummary"
import { useHydratedSession } from "@/lib/access-client"
import {
  sessionCapabilities,
  sessionTeamsOf,
  staffLibrariesOf,
} from "@/lib/access-server"
import {
  buildContributeMenu,
  type ContributeMenuModel,
  type ContributeMenuStatus,
  type FeaturedDriveSummary,
  namedLibraries,
  selectedLibrary,
} from "@/lib/contributor-shortcuts"
import { useCurrentLibrary } from "@/lib/staff/current-library"
import {
  readLastDrawerLibrary,
  rememberDrawerLibrary,
} from "@/lib/staff/drawer"

const STALE = 60_000

/** Shared between the Contribute menu and the staff drawer. */
export function useFeaturedDrive(enabled: boolean) {
  return useQuery({
    queryKey: ["featured-drive"],
    enabled,
    staleTime: STALE,
    queryFn: async (): Promise<FeaturedDriveSummary | null> => {
      const res = await fetch("/api/drives/featured")
      if (!res.ok) return null
      const json = (await res.json()) as {
        data?: FeaturedDriveSummary | null
      }

      return json.data ?? null
    },
  })
}

/** Actionable submissions and discussions in the current review scope. */
export function useModerationWaiting(enabled: boolean) {
  const summary = useModerationSummary(enabled)
  const rows = summary.data

  return {
    ...summary,
    data:
      rows?.length && rows.every((row) => row.pending !== null)
        ? rows.reduce((sum, row) => sum + row.pending!, 0)
        : null,
  }
}

/** Suggested changes waiting on one staff library (the drawer's summary). */
function useSuggestionsWaiting(
  userId: string | undefined,
  libraryId: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["contribute-menu", userId, "suggestions", libraryId],
    enabled: enabled && !!userId && !!libraryId,
    staleTime: STALE,
    queryFn: async ({ signal }): Promise<number | null> => {
      const res = await fetch(
        `/api/staff/${encodeURIComponent(libraryId ?? "")}/drawer`,
        { cache: "no-store", signal }
      )
      if (!res.ok) return null
      const json = (await res.json()) as { suggestions?: unknown }

      return typeof json.suggestions === "number" ? json.suggestions : null
    },
  })
}

/** The viewer's own submissions in review (`pendingCount`, when known). */
function useInReview(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["contribute-menu", userId, "in-review"],
    enabled: enabled && !!userId,
    staleTime: STALE,
    queryFn: async ({ signal }): Promise<number | null> => {
      const res = await fetch("/api/contribute/standing", {
        cache: "no-store",
        signal,
      })
      if (!res.ok) return null
      const json = (await res.json()) as { pendingCount?: unknown }

      return typeof json.pendingCount === "number" ? json.pendingCount : null
    },
  })
}

export type ContributeMenu = ContributeMenuModel & {
  status: ContributeMenuStatus
  /** The viewer's plan, or null while signed out or loading. */
  plan: PlanKey | null
  /** The Your libraries card's selector: options only with two or more. */
  library: {
    options: { id: string; name: string }[]
    selectedId: string | null
    select: (id: string) => void
  }
}

/**
 * The Contribute menu for the current viewer. The session says who they
 * are; the counts and the featured drive load only while `active` (the
 * panel is open), and never block the cards. The selected library starts
 * as the page's own when the viewer is its staff, else the one the drawer
 * last showed, else the first, and a choice here is remembered for the
 * drawer too.
 */
export function useContributeMenu(active: boolean): ContributeMenu {
  const { data, isPending } = useHydratedSession()
  const user = data?.user
  const status: ContributeMenuStatus = isPending
    ? "loading"
    : user
      ? "signedIn"
      : "signedOut"
  const signedIn = status === "signedIn"
  const capabilities = (user?.capabilities ?? []) as string[]
  const libraries = staffLibrariesOf(user)
  const teams = sessionTeamsOf(user)
  const isStaff = capabilities.includes("staff.area")

  const current = useCurrentLibrary()
  const [chosen, setChosen] = useState<string | null>(null)
  const options = namedLibraries(libraries)
  const preferred =
    chosen ?? current ?? (signedIn ? readLastDrawerLibrary() : null)
  const selectedId = selectedLibrary(options, preferred)?.id ?? null

  const featured = useFeaturedDrive(active)
  const suggestions = useSuggestionsWaiting(
    user?.id,
    selectedId,
    active && signedIn && isStaff
  )
  const moderation = useModerationWaiting(
    active && signedIn && capabilities.includes("moderate.queue")
  )
  const inReview = useInReview(user?.id, active && signedIn)

  const model = buildContributeMenu({
    status,
    capabilities,
    canReviewSuggestions: sessionCapabilities(user).moderation.some(
      (scope) => scope.queue === "all" && scope.locale === null
    ),
    claimedLibraries: libraries,
    teams,
    selectedLibraryId: selectedId,
    featuredDrive: active
      ? featured.isPending
        ? "loading"
        : (featured.data ?? null)
      : null,
    counts: {
      suggestions: suggestions.data ?? null,
      moderation: moderation.data ?? null,
      inReview: inReview.data ?? null,
    },
  })

  return {
    ...model,
    status,
    plan: user ? ((user.plan as PlanKey | undefined) ?? "free") : null,
    library: {
      options:
        options.length > 1
          ? options.map((lib) => ({ id: lib.id, name: lib.name }))
          : [],
      selectedId,
      select: (id: string) => {
        setChosen(id)
        rememberDrawerLibrary(id)
      },
    },
  }
}
