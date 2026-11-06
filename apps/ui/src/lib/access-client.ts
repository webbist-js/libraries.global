"use client"

import {
  type AccessFact,
  type AccessStanding,
  canDirectEdit,
  type Capability,
  type Feature,
  fromSessionCapabilities,
  type Limit,
  type ModerationScope,
  type SessionCapabilities,
  canStaff,
  type StaffAction,
  type StaffRole,
} from "@repo/access"

import { useMounted } from "@/hooks/useMounted"
import { authClient } from "@/lib/auth-client"

import { sessionTeamsOf, staffLibrariesOf } from "./access-server"

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
    /** Staff workspaces the viewer belongs to (never a source of authority). */
    teams: sessionTeamsOf(data?.user),
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

const STANDINGS: ReadonlySet<AccessStanding> = new Set<AccessStanding>([
  "public",
  "explorer",
  "contributor",
  "supporter",
])

/**
 * The viewer's entitlements: tools and limits from independent facts
 * (signed-in Explorer, earned recognition, API customer). Staff tools are
 * capabilities (`useStaff().can`), never entitlements.
 */
export function useEntitlements() {
  const { data, isPending } = useHydratedSession()
  const user = data?.user
  const standing: AccessStanding = !user
    ? "public"
    : STANDINGS.has(user.standing)
      ? user.standing
      : "explorer"
  const features = (
    Array.isArray(user?.features) ? user.features : []
  ) as Feature[]
  const facts = (Array.isArray(user?.facts) ? user.facts : []) as AccessFact[]
  const rawLimits = (user?.limits ?? {}) as Partial<Record<Limit, unknown>>
  const limitOf = (l: Limit) => {
    const n = rawLimits[l]

    return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0
  }

  return {
    signedIn: !!user,
    standing,
    has: (f: AccessFact) => facts.includes(f),
    can: (f: Feature) => features.includes(f),
    limitOf,
    ready: !isPending,
  }
}
