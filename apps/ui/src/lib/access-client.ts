"use client"

import type { Capability, Feature, PlanKey } from "@repo/access"

import { authClient } from "./auth-client"

/** UI only: hides or shows actions. Servers re-check every one. */
export function useCapabilities() {
  const { data, isPending } = authClient.useSession()
  const caps = (data?.user?.capabilities ?? []) as Capability[]

  return {
    has: (cap: Capability) => caps.includes(cap),
    claimedLibraryIds: (data?.user?.claimedLibraryIds ?? []) as string[],
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
