"use client"

import {
  canDirectEdit,
  type Capability,
  type Feature,
  fromSessionCapabilities,
  LIBRARY_SCOPED_FEATURES,
  type ModerationScope,
  type PlanKey,
  type SessionCapabilities,
  canStaff,
  type StaffAction,
  type StaffRole,
} from "@repo/access"

import { useMounted } from "@/hooks/useMounted"

import {
  sessionTeamsOf,
  staffLibrariesOf,
  teamLibraryIdsOf,
} from "./access-server"
import { authClient } from "./auth-client"

export type { SessionTeam } from "./access-server"

/**
 * The session as the server rendered it: none until the component has
 * mounted. Better Auth's store can already hold a session on the client's
 * first render (the header's subscription resolves while the rest of the
 * page is still hydrating), so a hook that read it then would render a
 * staff branch the server never did, and React would throw the tree away.
 */
export function useHydratedSession() {
  const { data, isPending, error } = authClient.useSession()
  const mounted = useMounted()

  return mounted
    ? { data, isPending, error }
    : { data: null, isPending: true, error: null }
}

export function useStaff() {
  const { data, isPending } = useHydratedSession()
  const c = fromSessionCapabilities(
    data?.user as Partial<SessionCapabilities> | undefined
  )

  return {
    libraries: staffLibrariesOf(data?.user),
    /** Teams the viewer belongs to (summaries from the session). */
    teams: sessionTeamsOf(data?.user),
    /** Libraries of the viewer's active Teams. */
    teamLibraryIds: teamLibraryIdsOf(data?.user),
    roleFor: (id: string): StaffRole | null => c.staff.get(id)?.role ?? null,
    can: (action: StaffAction, id: string) => canStaff(c, action, id),
    ready: !isPending,
  }
}

/** UI only: hides or shows actions. Servers re-check every one. */
export function useCapabilities() {
  const { data, isPending } = useHydratedSession()
  const c = fromSessionCapabilities(
    data?.user as Partial<SessionCapabilities> | undefined
  )

  return {
    has: (cap: Capability) => c.set.has(cap),
    claimedLibraryIds: [...c.claimedLibraryIds],
    moderationScopes: c.moderation as ModerationScope[],
    canDirectEdit: (kind: "docs" | "journal", locale: string) =>
      canDirectEdit(c, kind, locale),
    ready: !isPending,
  }
}

export function useEntitlements() {
  const { data, isPending } = useHydratedSession()
  const plan: PlanKey = data?.user ? (data.user.plan ?? "free") : "public"
  const features = (data?.user?.features ?? []) as Feature[]

  const teamLibraryIds = teamLibraryIdsOf(data?.user)

  const can = (f: Feature) => features.includes(f)

  return {
    plan,
    analysisAreaMultiplier:
      data?.user?.limits?.analysisAreaMultiplier === 2
        ? (2 as const)
        : (1 as const),
    can,
    /**
     * Whether `feature` is unlocked for one library: `library.team` and
     * `library.traffic` only on the libraries of the viewer's active Teams;
     * every other feature is the personal check.
     */
    canForLibrary: (f: Feature, libraryDocumentId: string) =>
      LIBRARY_SCOPED_FEATURES.includes(f)
        ? teamLibraryIds.includes(libraryDocumentId)
        : can(f),
    ready: !isPending,
  }
}
