import {
  type Capabilities,
  type Capability,
  type Feature,
  fromSessionCapabilities,
  MODERATION_QUEUES,
  type ModerationScope,
} from "@repo/access"

type WithCaps = { capabilities?: unknown } | null | undefined
type WithFeatures = { features?: unknown } | null | undefined

const listHas = (v: unknown, x: string) => Array.isArray(v) && v.includes(x)

/** Route pre-check only. Strapi's submission-policy remains the real gate. */
export function hasCapability(user: WithCaps, cap: Capability): boolean {
  return !!user && listHas(user.capabilities, cap)
}

const isScope = (v: unknown): v is ModerationScope => {
  if (!v || typeof v !== "object") return false
  const { queue, locale } = v as Record<string, unknown>

  return (
    (queue === "all" ||
      (MODERATION_QUEUES as readonly unknown[]).includes(queue)) &&
    (locale === null || typeof locale === "string")
  )
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []

const locales = (v: unknown): "all" | string[] =>
  v === "all" ? "all" : strings(v)

/**
 * The session's capability fields as `Capabilities`, for `canDirectEdit`
 * and `canModerate` in route pre-checks. Malformed fields read as none.
 */
export function sessionCapabilities(user: unknown): Capabilities {
  const u = (user && typeof user === "object" ? user : {}) as Record<
    string,
    unknown
  >
  const editor = (
    u.editorLocales && typeof u.editorLocales === "object"
      ? u.editorLocales
      : {}
  ) as Record<string, unknown>

  return fromSessionCapabilities({
    capabilities: strings(u.capabilities) as Capability[],
    claimedLibraryIds: strings(u.claimedLibraryIds),
    moderationScopes: Array.isArray(u.moderationScopes)
      ? u.moderationScopes.filter(isScope)
      : [],
    editorLocales: {
      docs: locales(editor.docs),
      journal: locales(editor.journal),
    },
  })
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
      {
        error: "Upgrade required",
        feature,
        upgradeUrl: "/contribute/membership",
      },
      { status: 402 }
    )

  return null
}
