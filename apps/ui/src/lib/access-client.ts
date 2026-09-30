"use client"

import {
  canDirectEdit,
  type Capability,
  type Feature,
  fromSessionCapabilities,
  type ModerationScope,
  type PlanKey,
  type SessionCapabilities,
} from "@repo/access"

import { authClient } from "./auth-client"

/** UI only: hides or shows actions. Servers re-check every one. */
export function useCapabilities() {
  const { data, isPending } = authClient.useSession()
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
  const { data, isPending } = authClient.useSession()
  const plan: PlanKey = data?.user ? (data.user.plan ?? "free") : "public"
  const features = (data?.user?.features ?? []) as Feature[]

  return {
    plan,
    can: (f: Feature) => features.includes(f),
    ready: !isPending,
  }
}
