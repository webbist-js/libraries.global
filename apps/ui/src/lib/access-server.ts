import {
  type AccessFact,
  type Capabilities,
  type Capability,
  type Feature,
  fromSessionCapabilities,
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

/**
 * A free staff workspace (organisation) the viewer belongs to. Membership
 * never unlocks library tools: those come from the viewer's own verified
 * staff claims (`requireStaff`).
 */
export type SessionTeam = {
  id: string
  name: string
  slug: string
  role: "organiser" | "member"
  libraryCount: number
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

  return Array.isArray(raw)
    ? preferredTeams(raw.filter(isTeam)).map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        role: t.role,
        libraryCount: t.libraryCount,
      }))
    : []
}

/** Organised workspaces first, keeping the session's order otherwise. */
export function preferredTeams<T extends SessionTeam>(
  teams: readonly T[]
): T[] {
  return [...teams].sort(
    (a, b) => Number(b.role === "organiser") - Number(a.role === "organiser")
  )
}

/** An API account the viewer belongs to, as the session reports it. */
export type SessionApiAccount = {
  teamId: string
  role: "organiser" | "member"
  active: boolean
}

/** The session's `apiAccounts`, or none. Malformed rows are dropped. */
export function apiAccountsOf(user: unknown): SessionApiAccount[] {
  const raw =
    user && typeof user === "object"
      ? (user as Record<string, unknown>).apiAccounts
      : null

  return Array.isArray(raw)
    ? raw.flatMap((row) => {
        if (!row || typeof row !== "object") return []
        const { teamId, role, active } = row as Record<string, unknown>

        return typeof teamId === "string" &&
          teamId.length > 0 &&
          (role === "organiser" || role === "member") &&
          typeof active === "boolean"
          ? [{ teamId, role, active }]
          : []
      })
    : []
}

/**
 * The API account whose organiser bonus the viewer uses: the first active
 * account they organise. Members never inherit it.
 */
export function bonusApiAccountOf(user: unknown): SessionApiAccount | null {
  return (
    apiAccountsOf(user).find((a) => a.active && a.role === "organiser") ?? null
  )
}

/** A session access fact (`explorer`, `contributor`, `supporter`, `apiCustomer`). */
export function hasFact(user: unknown, fact: AccessFact): boolean {
  return (
    !!user &&
    typeof user === "object" &&
    listHas((user as Record<string, unknown>).facts, fact)
  )
}

/**
 * Whether the viewer may use a free staff tool on one library: their own
 * verified staff claim must cover it. Organisation membership, payment,
 * recognition or an API key never does.
 */
export function canStaffTool(
  user: unknown,
  action: StaffAction,
  libraryDocumentId: string
): boolean {
  return (
    !!user && canStaff(sessionCapabilities(user), action, libraryDocumentId)
  )
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
        error: "This feature is not available on this account",
        feature,
        upgradeUrl: "/plans",
      },
      { status: 402 }
    )

  return null
}
