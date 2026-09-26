import type { Capability, Feature } from "@repo/access"

type WithCaps = { capabilities?: unknown } | null | undefined
type WithFeatures = { features?: unknown } | null | undefined

const listHas = (v: unknown, x: string) => Array.isArray(v) && v.includes(x)

/** Route pre-check only. Strapi's submission-policy remains the real gate. */
export function hasCapability(user: WithCaps, cap: Capability): boolean {
  return !!user && listHas(user.capabilities, cap)
}

export function requireCapability(
  user: WithCaps,
  cap: Capability
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasCapability(user, cap))
    return Response.json({ error: "Forbidden" }, { status: 403 })

  return null
}

export function requireEntitlement(
  user: WithFeatures,
  feature: Feature
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!listHas(user.features, feature))
    return Response.json(
      { error: "Upgrade required", feature, upgradeUrl: "/pro" },
      { status: 402 }
    )

  return null
}
