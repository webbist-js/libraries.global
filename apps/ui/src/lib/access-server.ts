import {
  type Capabilities,
  type Capability,
  type Feature,
  fromSessionCapabilities,
  LIBRARY_SCOPED_FEATURES,
  MODERATION_QUEUES,
  type ModerationScope,
  canStaff,
  parseSessionStaff,
  type StaffAction,
  type StaffRole,
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
    staffLibraries: parseSessionStaff(u.staffLibraries),
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

export type StaffLibrarySummary = {
  id: string
  name: string
  slug: string
  libraryType: string
  role: StaffRole
  canGoLive: boolean
}

export function staffLibrariesOf(user: unknown): StaffLibrarySummary[] {
  const raw =
    user && typeof user === "object"
      ? (user as Record<string, unknown>).staffLibraries
      : null
  const valid = new Map(parseSessionStaff(raw).map((row) => [row.id, row]))

  return Array.isArray(raw)
    ? raw.flatMap((row) => {
        if (!row || typeof row !== "object") return []
        const r = row as Record<string, unknown>
        const entry = typeof r.id === "string" ? valid.get(r.id) : null

        return entry &&
          typeof r.name === "string" &&
          typeof r.slug === "string" &&
          typeof r.libraryType === "string"
          ? [
              {
                ...entry,
                name: r.name,
                slug: r.slug,
                libraryType: r.libraryType,
              },
            ]
          : []
      })
    : []
}

/** A Team the viewer belongs to (the session field arrives with Teams). */
export type SessionTeam = {
  id: string
  name: string
  slug: string
  role: "organiser" | "member"
  libraryCount: number
  selfService?: boolean
  status?: "active" | "lapsed"
  expiresAt?: string | null
}

const isTeam = (v: unknown): v is SessionTeam => {
  if (!v || typeof v !== "object") return false
  const t = v as Record<string, unknown>

  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    typeof t.slug === "string" &&
    (t.role === "organiser" || t.role === "member") &&
    typeof t.libraryCount === "number"
  )
}

/** The session's `teams` (summaries), or none. */
export function sessionTeamsOf(user: unknown): SessionTeam[] {
  const raw =
    user && typeof user === "object"
      ? (user as Record<string, unknown>).teams
      : null

  return Array.isArray(raw) ? preferredTeams(raw.filter(isTeam)) : []
}

/** Prefer a current Team to abandoned setup, while keeping explicit selection. */
export function preferredTeams<T extends SessionTeam>(
  teams: readonly T[],
  now = Date.now()
): T[] {
  const active = (team: T) =>
    team.status === "active" &&
    (!team.expiresAt || Date.parse(team.expiresAt) > now)

  return [...teams].sort(
    (a, b) =>
      Number(active(b)) - Number(active(a)) ||
      Number(b.selfService === true) - Number(a.selfService === true) ||
      Number(b.role === "organiser") - Number(a.role === "organiser")
  )
}

/** The session's `teamLibraryIds`: libraries of the user's active Teams. */
export function teamLibraryIdsOf(user: unknown): string[] {
  const raw =
    user && typeof user === "object"
      ? (user as Record<string, unknown>).teamLibraryIds
      : null

  return strings(raw)
}

/**
 * Whether `feature` is unlocked for one library in this session: a
 * library-scoped feature (`library.team`, `library.traffic`) needs an active
 * Team of the user's covering it; any other feature is the personal plan.
 */
export function hasEntitlementForLibrary(
  user: unknown,
  feature: Feature,
  libraryDocumentId: string
): boolean {
  if (!user) return false
  if (LIBRARY_SCOPED_FEATURES.includes(feature))
    return teamLibraryIdsOf(user).includes(libraryDocumentId)

  return listHas((user as WithFeatures)?.features, feature)
}

export function requireStaff(
  user: unknown,
  libraryDocumentId: string,
  action: StaffAction
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const c = sessionCapabilities(user)
  if (!c.set.has("staff.area") || !c.staff.has(libraryDocumentId))
    return Response.json({ error: "Not found" }, { status: 404 })

  return canStaff(c, action, libraryDocumentId)
    ? null
    : Response.json({ error: "Forbidden" }, { status: 403 })
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
        upgradeUrl: "/plans",
      },
      { status: 402 }
    )

  return null
}

/**
 * `requireEntitlement` for a feature used on one library: `library.team`
 * and `library.traffic` are on only for the libraries of the user's active
 * Teams (`teamLibraryIds` in the session); other features are personal.
 * A pre-check: Strapi's `hasLibraryFeature` decides on every write.
 */
export function requireEntitlementForLibrary(
  user: WithFeatures,
  feature: Feature,
  libraryDocumentId: string
): Response | null {
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasEntitlementForLibrary(user, feature, libraryDocumentId))
    return Response.json(
      {
        error: "Upgrade required",
        feature,
        upgradeUrl: "/plans",
      },
      { status: 402 }
    )

  return null
}
