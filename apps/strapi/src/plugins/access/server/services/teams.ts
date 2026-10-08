import { createHash, randomBytes } from "node:crypto"

import type { StaffRole } from "@repo/access"

import {
  grantVerifiedLibrarian,
  upsertAffiliation,
} from "../../../../utils/affiliations"
import { notifySessionInvalidated } from "../../../../utils/role-grants"
import { AFFILIATION_UID } from "../../../../utils/staff"
import {
  loadTeamMemberships,
  MAX_TEAM_LIBRARIES,
  TEAM_MEMBER_UID,
  TEAM_UID,
} from "../../../../utils/team-access"
import { emailConfigured } from "../../../content-moderation/server/utils/email-config"
import { AccessError, isDocumentId, isEmail } from "../utils/admin"

/**
 * Teams (spec §3): a Team organisation with seats, an organiser and
 * libraries. An organiser invites colleagues by email, and assigns a member
 * to one of the Team's libraries as owner or editor. On a **verified** Team
 * (`verifiedAt` set by an admin, never by money) the assignment creates the
 * staff affiliation at once; on an unverified Team it files a vouched
 * Library Claim for a Moderator. Every write takes an advisory lock on the
 * Team, so two organisers can't overfill the seats or race a removal.
 */

const LIBRARY = "api::library.library"
const SUBMISSION = "plugin::content-moderation.submission"

export const INVITE_TTL_DAYS = 14
/** Most rows one Team may hold (seats are capped below this). */
export const MAX_SEATS = 500
export const MAX_MEMBER_ROWS = MAX_SEATS + 50
const NAME_MAX = 120
const NOTES_MAX = 2000

export const TEAM_LIST_MAX = 50
const LIBRARY_SEARCH_MAX = 20
const PENDING_CLAIMS_MAX = 200

export type TeamRole = "organiser" | "member"
export type MemberStatus = "invited" | "active" | "removed"
export type Preassign = { libraryDocumentId: string; staffRole: StaffRole }

export type Actor =
  | { kind: "admin"; id: string | number }
  | { kind: "user"; baUserId: string; email: string; name: string }

export type TeamLibrary = {
  documentId: string
  name: string
  slug: string
  libraryType: string
}

export type TeamAssignment = {
  affiliationDocumentId: string
  libraryDocumentId: string
  staffRole: StaffRole
  canGoLive: boolean
}

export type PendingAssignment = {
  submissionDocumentId: string
  libraryDocumentId: string
  staffRole: StaffRole
  status: string
}

export type TeamMemberView = {
  documentId: string
  baUserId: string | null
  name: string | null
  email: string
  emailMasked: string
  teamRole: TeamRole
  status: MemberStatus
  invitedAt: string | null
  acceptedAt: string | null
  preassign: Preassign | null
  assignments: TeamAssignment[]
  pending: PendingAssignment[]
  isYou: boolean
}

export type TeamView = {
  documentId: string
  name: string
  slug: string
  seats: number
  used: number
  status: "active" | "lapsed"
  source: "admin" | "checkout"
  verifiedAt: string | null
  expiresAt: string | null
  notes: string | null
  libraries: TeamLibrary[]
  members: TeamMemberView[]
  viewerRole: TeamRole | "admin" | null
  organiserNames: string[]
  createdAt: string | null
}

export type TeamSummary = {
  id: string
  name: string
  slug: string
  role: TeamRole
  libraryCount: number
  status: "active" | "lapsed"
  expiresAt: string | null
  verified: boolean
  organiserName: string | null
  libraryDocumentIds: string[]
}

type TeamRow = {
  documentId: string
  name?: string | null
  slug?: string | null
  seats?: number | null
  status?: string | null
  source?: string | null
  verifiedAt?: string | null
  expiresAt?: string | null
  notes?: string | null
  createdAt?: string | null
  libraries?: TeamLibrary[] | null
}

type MemberRow = {
  documentId: string
  baUserId?: string | null
  email?: string | null
  teamRole?: string | null
  status?: string | null
  tokenHash?: string | null
  invitedBy?: string | null
  invitedAt?: string | null
  acceptedAt?: string | null
  removedAt?: string | null
  preassign?: unknown
  team?: TeamRow | null
}

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex")

export const mask = (email: string) => email.replace(/^(.).*(@.*)$/, "$1•••$2")
const now = () => new Date().toISOString()

/**
 * Where invite links point: `APP_PUBLIC_URL`, else the request's origin
 * when the caller passed one, else `http://localhost:3000` in development
 * only. Null in production without any of them: the invite is still
 * created, and the email is skipped (`emailSent: false`).
 */
export function publicUrl(origin?: string | null): string | null {
  const configured = process.env.APP_PUBLIC_URL?.trim()
  if (configured) return configured
  if (origin && /^https?:\/\/[^\s/]+$/.test(origin)) return origin
  if (process.env.NODE_ENV === "development") return "http://localhost:3000"

  return null
}
const isStaffRole = (v: unknown): v is StaffRole =>
  v === "owner" || v === "editor"
const isTeamRole = (v: unknown): v is TeamRole =>
  v === "organiser" || v === "member"

const TEAM_FIELDS = [
  "documentId",
  "name",
  "slug",
  "seats",
  "status",
  "source",
  "verifiedAt",
  "expiresAt",
  "notes",
  "createdAt",
]
const MEMBER_FIELDS = [
  "documentId",
  "baUserId",
  "email",
  "teamRole",
  "status",
  "invitedBy",
  "invitedAt",
  "acceptedAt",
  "removedAt",
  "preassign",
]
const LIBRARY_FIELDS = ["documentId", "name", "slug", "libraryType"]

/** Serialise every write to one Team. */
export async function teamTransaction<T>(
  strapi: any,
  teamId: string,
  work: () => Promise<T>
): Promise<T> {
  return strapi.db.transaction(async ({ trx }: any) => {
    if (typeof trx?.raw === "function")
      await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
        `access-team:${teamId}`,
      ])

    return work()
  })
}

function parsePreassign(v: unknown): Preassign | null {
  if (!v || typeof v !== "object") return null
  const { libraryDocumentId, staffRole } = v as Record<string, unknown>

  return isDocumentId(libraryDocumentId) && isStaffRole(staffRole)
    ? { libraryDocumentId, staffRole }
    : null
}

/** Fields an admin may set on a Team; every value is checked. */
export function parseTeamInput(
  body: unknown,
  partial = false
):
  | {
      ok: true
      value: {
        name?: string
        seats?: number
        libraryDocumentIds?: string[]
        expiresAt?: string | null
        notes?: string | null
        status?: "active" | "lapsed"
      }
    }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { ok: false, message: "Expected the team's details." }
  const b = body as Record<string, unknown>
  const value: {
    name?: string
    seats?: number
    libraryDocumentIds?: string[]
    expiresAt?: string | null
    notes?: string | null
    status?: "active" | "lapsed"
  } = {}

  if (b.name !== undefined || !partial) {
    const name = typeof b.name === "string" ? b.name.trim() : ""
    if (!name) return { ok: false, message: "Give the team a name." }
    if (name.length > NAME_MAX)
      return {
        ok: false,
        message: `Keep the name to ${NAME_MAX} characters or fewer.`,
      }
    value.name = name
  }
  if (b.seats !== undefined) {
    const seats = Number(b.seats)
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS)
      return { ok: false, message: `Seats must be 1 to ${MAX_SEATS}.` }
    value.seats = seats
  }
  if (b.libraryDocumentIds !== undefined) {
    if (!Array.isArray(b.libraryDocumentIds))
      return { ok: false, message: "Libraries must be a list of ids." }
    const ids = [...new Set(b.libraryDocumentIds)]
    if (ids.length > MAX_TEAM_LIBRARIES)
      return {
        ok: false,
        message: `A team covers at most ${MAX_TEAM_LIBRARIES} libraries.`,
      }
    if (!ids.every(isDocumentId))
      return { ok: false, message: "A library id is not valid." }
    value.libraryDocumentIds = ids as string[]
  }
  if (b.expiresAt !== undefined) {
    if (b.expiresAt === null || b.expiresAt === "") value.expiresAt = null
    else {
      const at =
        typeof b.expiresAt === "string"
          ? new Date(b.expiresAt)
          : new Date(Number.NaN)
      if (Number.isNaN(at.getTime()))
        return { ok: false, message: "The expiry must be a date." }
      value.expiresAt = at.toISOString()
    }
  }
  if (b.notes !== undefined) {
    if (b.notes !== null && typeof b.notes !== "string")
      return { ok: false, message: "Notes must be text." }
    const notes = typeof b.notes === "string" ? b.notes.trim() : ""
    if (notes.length > NOTES_MAX)
      return {
        ok: false,
        message: `Keep the notes to ${NOTES_MAX} characters or fewer.`,
      }
    value.notes = notes || null
  }
  if (b.status !== undefined) {
    if (b.status !== "active" && b.status !== "lapsed")
      return { ok: false, message: "Status must be active or lapsed." }
    value.status = b.status
  }

  return { ok: true, value }
}

export default ({ strapi }: { strapi: any }) => {
  const teams = () => strapi.documents(TEAM_UID as any)
  const members = () => strapi.documents(TEAM_MEMBER_UID as any)
  const affiliations = () => strapi.documents(AFFILIATION_UID as any)
  const people = () => strapi.plugin("access").service("people")

  async function teamOf(documentId: string): Promise<TeamRow> {
    if (!isDocumentId(documentId)) throw new AccessError(404, "not_found")
    const team = (await teams().findOne({
      documentId,
      fields: TEAM_FIELDS,
      populate: { libraries: { fields: LIBRARY_FIELDS } },
    })) as TeamRow | null
    if (!team) throw new AccessError(404, "not_found")

    return team
  }

  /** Every non-removed row, oldest first, plus removed when asked. */
  async function memberRows(
    teamId: string,
    includeRemoved = false
  ): Promise<MemberRow[]> {
    return (await members().findMany({
      filters: {
        team: { documentId: { $eq: teamId } },
        ...(includeRemoved ? {} : { status: { $in: ["invited", "active"] } }),
      },
      fields: MEMBER_FIELDS,
      sort: ["createdAt:asc", "id:asc"],
      limit: MAX_MEMBER_ROWS,
    })) as MemberRow[]
  }

  async function memberOf(
    teamId: string,
    memberId: string
  ): Promise<MemberRow> {
    if (!isDocumentId(memberId)) throw new AccessError(404, "not_found")
    const row = (await members().findOne({
      documentId: memberId,
      fields: MEMBER_FIELDS,
      populate: {
        team: {
          fields: ["documentId", "verifiedAt", "status", "expiresAt", "name"],
        },
      },
    })) as MemberRow | null
    if (!row || row.team?.documentId !== teamId || row.status === "removed")
      throw new AccessError(404, "not_found")

    return row
  }

  const teamIsActive = (team: TeamRow) =>
    team.status !== "lapsed" &&
    (!team.expiresAt || Date.parse(team.expiresAt) > Date.now())

  /** Team-sourced affiliations for these member rows, by member. */
  async function assignmentsOf(
    rows: MemberRow[]
  ): Promise<Map<string, TeamAssignment[]>> {
    const out = new Map<string, TeamAssignment[]>()
    const ids = rows.map((r) => r.documentId)
    if (ids.length === 0) return out
    const found = (await affiliations().findMany({
      filters: {
        source: { $eq: "team" },
        teamMember: { documentId: { $in: ids } },
      },
      fields: ["documentId", "staffRole", "canGoLive"],
      populate: {
        library: { fields: ["documentId"] },
        teamMember: { fields: ["documentId"] },
      },
      sort: "id:asc",
      limit: ids.length * MAX_TEAM_LIBRARIES,
    })) as any[]
    for (const a of found) {
      const member = a.teamMember?.documentId
      const library = a.library?.documentId
      if (!member || !library) continue
      out.set(member, [
        ...(out.get(member) ?? []),
        {
          affiliationDocumentId: a.documentId,
          libraryDocumentId: library,
          staffRole: a.staffRole === "owner" ? "owner" : "editor",
          canGoLive: a.canGoLive !== false,
        },
      ])
    }

    return out
  }

  /** Open vouched claims a Team filed for these members, by member. */
  async function pendingOf(
    rows: MemberRow[]
  ): Promise<Map<string, PendingAssignment[]>> {
    const out = new Map<string, PendingAssignment[]>()
    const ids = rows.flatMap((r) => (r.baUserId ? [r.baUserId] : []))
    if (ids.length === 0) return out
    const byMember = new Map(rows.map((r) => [r.documentId, r]))
    const found = (await strapi.documents(SUBMISSION).findMany({
      filters: {
        submissionType: { $eq: "library_claim" },
        status: { $in: ["pending", "needs_info"] },
        submittedByUserId: { $in: ids },
      },
      fields: ["documentId", "status", "targetDocumentId", "draftData"],
      sort: "id:asc",
      limit: PENDING_CLAIMS_MAX,
    })) as any[]
    for (const s of found) {
      const memberId = s.draftData?.teamMemberDocumentId
      if (typeof memberId !== "string" || !byMember.has(memberId)) continue
      if (!s.targetDocumentId) continue
      out.set(memberId, [
        ...(out.get(memberId) ?? []),
        {
          submissionDocumentId: s.documentId,
          libraryDocumentId: s.targetDocumentId,
          staffRole: isStaffRole(s.draftData?.staffRole)
            ? s.draftData.staffRole
            : "editor",
          status: String(s.status),
        },
      ])
    }

    return out
  }

  async function view(
    team: TeamRow,
    viewer: { baUserId: string | null; role: TeamRole | "admin" | null }
  ): Promise<TeamView> {
    const rows = await memberRows(team.documentId)
    const [names, assignments, pending] = await Promise.all([
      people().namesOf(rows.flatMap((r) => (r.baUserId ? [r.baUserId] : []))),
      assignmentsOf(rows),
      pendingOf(rows),
    ])
    const full = viewer.role === "admin" || viewer.role === "organiser"
    const organiserNames = rows
      .filter((r) => r.status === "active" && r.teamRole === "organiser")
      .map((r) => (r.baUserId && names.get(r.baUserId)) || mask(r.email ?? ""))

    return {
      documentId: team.documentId,
      name: team.name ?? "Team",
      slug: team.slug ?? "",
      seats: team.seats ?? 0,
      used: rows.length,
      status: team.status === "lapsed" ? "lapsed" : "active",
      source: team.source === "checkout" ? "checkout" : "admin",
      verifiedAt: team.verifiedAt ?? null,
      expiresAt: team.expiresAt ?? null,
      notes: viewer.role === "admin" ? (team.notes ?? null) : null,
      libraries: (team.libraries ?? []).map((l) => ({
        documentId: l.documentId,
        name: l.name,
        slug: l.slug,
        libraryType: l.libraryType,
      })),
      members: rows.map((r) => {
        const email = (r.email ?? "").toLowerCase()

        return {
          documentId: r.documentId,
          baUserId: r.baUserId ?? null,
          name: (r.baUserId && names.get(r.baUserId)) || null,
          email: full ? email : "",
          emailMasked: mask(email),
          teamRole: r.teamRole === "organiser" ? "organiser" : "member",
          status: r.status === "active" ? "active" : "invited",
          invitedAt: r.invitedAt ?? null,
          acceptedAt: r.acceptedAt ?? null,
          preassign: parsePreassign(r.preassign),
          assignments: assignments.get(r.documentId) ?? [],
          pending: pending.get(r.documentId) ?? [],
          isYou: !!viewer.baUserId && r.baUserId === viewer.baUserId,
        }
      }),
      viewerRole: viewer.role,
      organiserNames,
      createdAt: team.createdAt ?? null,
    }
  }

  /** The caller's active row on the Team, or null. */
  async function membershipOf(
    teamId: string,
    baUserId: string
  ): Promise<MemberRow | null> {
    const [row] = (await members().findMany({
      filters: {
        team: { documentId: { $eq: teamId } },
        baUserId: { $eq: baUserId },
        status: { $eq: "active" },
      },
      fields: MEMBER_FIELDS,
      limit: 1,
    })) as MemberRow[]

    return row ?? null
  }

  async function librariesByIds(ids: string[]): Promise<TeamLibrary[]> {
    if (ids.length === 0) return []
    const rows = (await strapi.documents(LIBRARY).findMany({
      filters: { documentId: { $in: ids } },
      status: "published",
      fields: LIBRARY_FIELDS,
      limit: ids.length,
    })) as TeamLibrary[]
    if (rows.length !== ids.length)
      throw new AccessError(400, "unknown_library", "A library was not found.")

    return rows
  }

  async function audit(
    libraryDocumentId: string,
    actor: Actor,
    action: string,
    subject: string | null,
    detail: Record<string, unknown> = {}
  ) {
    await strapi
      .plugin("library-staff")
      ?.service("staff")
      ?.audit(
        libraryDocumentId,
        actor.kind === "admin" ? `admin:${actor.id}` : actor.baUserId,
        action,
        subject,
        detail
      )
  }

  /**
   * Sends one email through Strapi's email plugin, the way the moderation
   * notifications do: with no provider configured (`emailConfigured`) or
   * on a provider failure it logs and answers false, never throws.
   */
  async function sendMail(
    to: string,
    subject: string,
    text: string
  ): Promise<boolean> {
    try {
      const email = strapi.plugin?.("email")?.service?.("email")
      if (!emailConfigured() || typeof email?.send !== "function") {
        strapi.log.info(
          `[access] no email provider configured; skipped "${subject}" to ${mask(to)}`
        )

        return false
      }
      await email.send({ to, subject, text })

      return true
    } catch (err) {
      strapi.log.warn(`[access] could not send "${subject}"`, err)

      return false
    }
  }

  /** The invite email, naming the pre-assigned library when there is one. */
  function inviteEmail(i: {
    inviter: string
    teamName: string
    role: TeamRole
    libraryName: string | null
    link: URL
  }): { subject: string; text: string } {
    const where = i.libraryName
      ? ` You'll be given staff access to ${i.libraryName}.`
      : ""

    return {
      subject: `Join ${i.teamName} on Libraries Global`,
      text: `${i.inviter} invited you to join ${i.teamName}${
        i.role === "organiser" ? " as an organiser" : ""
      }.${where} Sign in with this email address and accept the invite:\n\n${
        i.link
      }\n\nThe link works for ${INVITE_TTL_DAYS} days.`,
    }
  }

  /** A library's published name and slug (its staff page address), or null. */
  async function libraryOf(
    documentId: string | null | undefined
  ): Promise<{ name: string | null; slug: string | null } | null> {
    if (!documentId) return null
    const row = (await strapi.documents(LIBRARY).findOne({
      documentId,
      status: "published",
      fields: ["name", "slug"],
    })) as { name?: string; slug?: string } | null

    return row ? { name: row.name ?? null, slug: row.slug ?? null } : null
  }

  /**
   * Gives a member staff access at one of the Team's libraries. Verified
   * Team: the affiliation is written now (`source: "team"`), the person
   * gets a `verified_librarian` grant if they have none, and the
   * affiliation lifecycle audits and emails. Unverified Team: a vouched
   * Library Claim is filed for a Moderator instead.
   */
  async function grantAccess(
    team: TeamRow,
    member: MemberRow,
    libraryDocumentId: string,
    staffRole: StaffRole,
    actor: Actor
  ): Promise<"assigned" | "claim_filed"> {
    if (!member.baUserId) throw new AccessError(409, "member_not_active")
    if (!(team.libraries ?? []).some((l) => l.documentId === libraryDocumentId))
      throw new AccessError(400, "library_not_in_team")
    if (team.verifiedAt) {
      await upsertAffiliation(strapi, {
        baUserId: member.baUserId,
        libraryDocumentId,
        staffRole,
        verificationMethod: "team",
        source: "team",
        teamMemberDocumentId: member.documentId,
      })
      await grantVerifiedLibrarian(strapi, member.baUserId, "team")
      await audit(libraryDocumentId, actor, "level_changed", member.baUserId, {
        next: staffRole,
        team: team.documentId,
      })

      return "assigned"
    }
    const [open] = (await strapi.documents(SUBMISSION).findMany({
      filters: {
        submissionType: { $eq: "library_claim" },
        status: { $in: ["pending", "needs_info", "draft"] },
        submittedByUserId: { $eq: member.baUserId },
        targetDocumentId: { $eq: libraryDocumentId },
      },
      fields: ["documentId"],
      limit: 1,
    })) as { documentId: string }[]
    if (open) throw new AccessError(409, "claim_pending")
    const library = (team.libraries ?? []).find(
      (l) => l.documentId === libraryDocumentId
    )!
    const names = await people().namesOf([member.baUserId])
    await strapi
      .plugin("content-moderation")
      .service("submission")
      .create({
        submissionType: "library_claim",
        targetEntityType: "library",
        targetDocumentId: libraryDocumentId,
        targetSlug: library.slug,
        fields: {
          name: library.name,
          role: "Team member",
          verificationMethod: "vouching",
          teamName: team.name,
        },
        draftData: {
          teamMemberDocumentId: member.documentId,
          teamDocumentId: team.documentId,
          staffRole,
        },
        verificationMethod: "vouching",
        submittedByUserId: member.baUserId,
        submittedByEmail: (member.email ?? "").toLowerCase(),
        submittedByName: names.get(member.baUserId) ?? undefined,
      })

    return "claim_filed"
  }

  async function dropAccess(
    member: MemberRow,
    actor: Actor,
    libraryDocumentId?: string
  ): Promise<number> {
    const rows = (await affiliations().findMany({
      filters: {
        source: { $eq: "team" },
        teamMember: { documentId: { $eq: member.documentId } },
        ...(libraryDocumentId
          ? { library: { documentId: { $eq: libraryDocumentId } } }
          : {}),
      },
      fields: ["documentId"],
      populate: { library: { fields: ["documentId"] } },
      limit: MAX_TEAM_LIBRARIES,
    })) as any[]
    for (const row of rows) {
      await affiliations().delete({ documentId: row.documentId })
      if (row.library?.documentId && member.baUserId)
        await audit(row.library.documentId, actor, "removed", member.baUserId)
    }

    return rows.length
  }

  return {
    /** Admin: Teams, newest first, optionally matched on name. */
    async list(q = ""): Promise<Omit<TeamView, "members" | "notes">[]> {
      const query = q.trim().slice(0, NAME_MAX)
      const rows = (await teams().findMany({
        filters: query ? { name: { $containsi: query } } : {},
        fields: TEAM_FIELDS,
        populate: { libraries: { fields: LIBRARY_FIELDS } },
        sort: [{ createdAt: "desc" }, { id: "desc" }],
        limit: TEAM_LIST_MAX,
      })) as TeamRow[]
      const out = []
      for (const team of rows) {
        const rowsOf = await memberRows(team.documentId)
        out.push({
          documentId: team.documentId,
          name: team.name ?? "Team",
          slug: team.slug ?? "",
          seats: team.seats ?? 0,
          used: rowsOf.length,
          status: (team.status === "lapsed" ? "lapsed" : "active") as
            | "active"
            | "lapsed",
          source: (team.source === "checkout" ? "checkout" : "admin") as
            | "admin"
            | "checkout",
          verifiedAt: team.verifiedAt ?? null,
          expiresAt: team.expiresAt ?? null,
          libraries: (team.libraries ?? []).map((l) => ({
            documentId: l.documentId,
            name: l.name,
            slug: l.slug,
            libraryType: l.libraryType,
          })),
          viewerRole: "admin" as const,
          organiserNames: [] as string[],
          createdAt: team.createdAt ?? null,
        })
      }

      return out
    },

    /** Admin: libraries matching a name, for the Team's libraries picker. */
    async searchLibraries(q: string): Promise<TeamLibrary[]> {
      const query = q.trim().slice(0, NAME_MAX)
      if (query.length < 2) return []

      return (await strapi.documents(LIBRARY).findMany({
        filters: { name: { $containsi: query } },
        status: "published",
        fields: LIBRARY_FIELDS,
        sort: "name:asc",
        limit: LIBRARY_SEARCH_MAX,
      })) as TeamLibrary[]
    },

    /** The Team as the viewer may see it (admin, organiser or member). */
    async detail(
      teamId: string,
      viewer: { baUserId: string | null; admin?: boolean }
    ): Promise<TeamView> {
      const team = await teamOf(teamId)
      let role: TeamRole | "admin" | null = viewer.admin ? "admin" : null
      if (!viewer.admin) {
        if (!viewer.baUserId) throw new AccessError(404, "not_found")
        const me = await membershipOf(team.documentId, viewer.baUserId)
        if (!me) throw new AccessError(404, "not_found")
        role = me.teamRole === "organiser" ? "organiser" : "member"
      }

      return view(team, { baUserId: viewer.baUserId, role })
    },

    async create(
      input: {
        name: string
        seats?: number
        libraryDocumentIds?: string[]
        expiresAt?: string | null
        notes?: string | null
        verified?: boolean
      },
      adminId: string | number
    ): Promise<TeamView> {
      const libraries = await librariesByIds(input.libraryDocumentIds ?? [])
      let slug: string | null = null
      try {
        slug = await strapi
          .plugin("content-manager")
          .service("uid")
          .generateUIDField({
            contentTypeUID: TEAM_UID,
            field: "slug",
            data: { name: input.name },
          })
      } catch {
        slug = `${input.name
          .toLowerCase()
          .replaceAll(/[^a-z0-9]+/g, "-")
          .replaceAll(/^-|-$/g, "")}-${randomBytes(3).toString("hex")}`
      }
      const created = (await teams().create({
        data: {
          name: input.name,
          slug,
          seats: input.seats ?? 5,
          status: "active",
          source: "admin",
          verifiedAt: input.verified ? now() : null,
          expiresAt: input.expiresAt ?? null,
          notes: input.notes ?? null,
          createdByAdmin: `admin:${adminId}`,
          libraries: {
            set: libraries.map((l) => ({ documentId: l.documentId })),
          },
        },
      })) as TeamRow
      strapi.log.info(
        `[access] admin:${adminId} created team ${created.documentId}`
      )

      return view(await teamOf(created.documentId), {
        baUserId: null,
        role: "admin",
      })
    },

    /**
     * Admin edit. Dropping a library from the Team deletes every
     * Team-sourced affiliation at it (the lifecycle emails and audits);
     * claim-sourced rows stay. Lapsing flips `status` and nothing else.
     */
    async update(
      teamId: string,
      input: {
        name?: string
        seats?: number
        libraryDocumentIds?: string[]
        expiresAt?: string | null
        notes?: string | null
        status?: "active" | "lapsed"
      },
      adminId: string | number
    ): Promise<TeamView> {
      return teamTransaction(strapi, teamId, async () => {
        const team = await teamOf(teamId)
        const data: Record<string, unknown> = {}
        if (input.name !== undefined) data.name = input.name
        if (input.seats !== undefined) data.seats = input.seats
        if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt
        if (input.notes !== undefined) data.notes = input.notes
        if (input.status !== undefined) data.status = input.status
        let dropped: string[] = []
        if (input.libraryDocumentIds !== undefined) {
          const next = await librariesByIds(input.libraryDocumentIds)
          data.libraries = {
            set: next.map((l) => ({ documentId: l.documentId })),
          }
          const keep = new Set(next.map((l) => l.documentId))
          dropped = (team.libraries ?? [])
            .map((l) => l.documentId)
            .filter((id) => !keep.has(id))
        }
        if (Object.keys(data).length > 0)
          await teams().update({ documentId: teamId, data })
        if (dropped.length > 0) {
          const rows = await memberRows(teamId)
          for (const member of rows)
            for (const id of dropped)
              await dropAccess(member, { kind: "admin", id: adminId }, id)
        }
        strapi.log.info(`[access] admin:${adminId} updated team ${teamId}`)

        return view(await teamOf(teamId), { baUserId: null, role: "admin" })
      })
    },

    /** Admin only: `verifiedAt` is the act of trust. Money never sets it. */
    async verify(
      teamId: string,
      verified: boolean,
      adminId: string | number
    ): Promise<TeamView> {
      return teamTransaction(strapi, teamId, async () => {
        const team = await teamOf(teamId)
        if (!!team.verifiedAt !== verified)
          await teams().update({
            documentId: teamId,
            data: { verifiedAt: verified ? now() : null },
          })
        strapi.log.info(
          `[access] admin:${adminId} ${verified ? "verified" : "unverified"} team ${teamId}`
        )

        return view(await teamOf(teamId), { baUserId: null, role: "admin" })
      })
    },

    /** Lapse (or reactivate) a Team: `status` only. */
    async lapse(
      teamId: string,
      lapsed: boolean,
      adminId: string | number
    ): Promise<TeamView> {
      return this.update(
        teamId,
        { status: lapsed ? "lapsed" : "active" },
        adminId
      )
    },

    /**
     * The caller's active organiser row, else 403 (a member) or 404 (not
     * on the Team at all, the same answer as a missing Team).
     */
    async requireOrganiser(
      teamId: string,
      baUserId: string
    ): Promise<MemberRow> {
      await teamOf(teamId)
      const me = await membershipOf(teamId, baUserId)
      if (!me) throw new AccessError(404, "not_found")
      if (me.teamRole !== "organiser") throw new AccessError(403, "forbidden")

      return me
    },

    /**
     * Invites by email, with a seat held from now. Seats: active + invited
     * rows must stay within `seats` (409 `no_seats`). One row per email per
     * Team: a removed row is revived; an invited one is 409
     * `invite_already_pending`; an active one is 409 `already_member`.
     */
    async invite(
      teamId: string,
      rawEmail: unknown,
      teamRole: unknown,
      preassign: unknown,
      actor: Actor,
      origin?: string | null
    ): Promise<{ member: TeamMemberView; emailSent: boolean }> {
      if (!isEmail(rawEmail)) throw new AccessError(400, "invalid_email")
      const email = rawEmail.trim().toLowerCase()
      const role: TeamRole = isTeamRole(teamRole) ? teamRole : "member"
      const pre = parsePreassign(preassign)
      if (preassign && !pre) throw new AccessError(400, "invalid_preassign")
      // The invite is created whether or not an email can go out; the
      // organiser is told when it didn't (`emailSent`) and can resend.
      const base = publicUrl(origin)
      const token = randomBytes(32).toString("hex")
      const row = await teamTransaction(strapi, teamId, async () => {
        const team = await teamOf(teamId)
        if (actor.kind === "user")
          await this.requireOrganiser(teamId, actor.baUserId)
        if (!teamIsActive(team)) throw new AccessError(409, "team_inactive")
        if (
          pre &&
          !(team.libraries ?? []).some(
            (l) => l.documentId === pre.libraryDocumentId
          )
        )
          throw new AccessError(400, "library_not_in_team")
        const rows = await memberRows(teamId, true)
        const existing = rows.find(
          (r) => (r.email ?? "").toLowerCase() === email
        )
        if (existing?.status === "active")
          throw new AccessError(409, "already_member")
        if (existing?.status === "invited")
          throw new AccessError(409, "invite_already_pending")
        const used = rows.filter((r) => r.status !== "removed").length
        if (used >= (team.seats ?? 0)) throw new AccessError(409, "no_seats")
        const data = {
          email,
          teamRole: role,
          status: "invited",
          tokenHash: hashToken(token),
          invitedBy:
            actor.kind === "admin" ? `admin:${actor.id}` : actor.baUserId,
          invitedAt: now(),
          acceptedAt: null,
          removedAt: null,
          baUserId: null,
          preassign: pre,
        }
        const saved = existing
          ? await members().update({ documentId: existing.documentId, data })
          : await members().create({
              data: { ...data, team: { connect: [{ documentId: teamId }] } },
            })
        if (pre)
          await audit(pre.libraryDocumentId, actor, "invite_sent", null, {
            memberId: saved.documentId,
            staffRole: pre.staffRole,
            team: teamId,
          })

        return { saved: saved as MemberRow, team }
      })
      const inviter =
        actor.kind === "user"
          ? actor.name ||
            (await people().namesOf([actor.baUserId])).get(actor.baUserId) ||
            "Your team organiser"
          : "The site team"
      let emailSent = false
      if (base) {
        const libraryName =
          (pre &&
            (row.team.libraries ?? []).find(
              (l) => l.documentId === pre.libraryDocumentId
            )?.name) ||
          null
        const mail = inviteEmail({
          inviter,
          teamName: row.team.name ?? "your team",
          role,
          libraryName,
          link: new URL(`/staff/team/join/${token}`, base),
        })
        emailSent = await sendMail(email, mail.subject, mail.text)
      } else
        strapi.log.warn(
          "[access] APP_PUBLIC_URL is not set; the invite was created but no email was sent"
        )
      const fresh = await view(row.team, {
        baUserId: actor.kind === "user" ? actor.baUserId : null,
        role: actor.kind === "admin" ? "admin" : "organiser",
      })

      return {
        member: fresh.members.find(
          (m) => m.documentId === row.saved.documentId
        )!,
        emailSent,
      }
    },

    /** A fresh link (and 14 days) for an open invite. */
    async resendInvite(
      teamId: string,
      memberId: string,
      actor: Actor,
      origin?: string | null
    ): Promise<{ emailSent: boolean }> {
      const base = publicUrl(origin)
      if (!base) throw new AccessError(503, "email_not_configured")
      const token = randomBytes(32).toString("hex")
      const { row, team } = await teamTransaction(strapi, teamId, async () => {
        const team = await teamOf(teamId)
        if (actor.kind === "user")
          await this.requireOrganiser(teamId, actor.baUserId)
        if (!teamIsActive(team)) throw new AccessError(409, "team_inactive")
        const row = await memberOf(teamId, memberId)
        if (row.status !== "invited") throw new AccessError(409, "not_invited")
        await members().update({
          documentId: memberId,
          data: { tokenHash: hashToken(token), invitedAt: now() },
        })

        return { row, team }
      })
      const inviter =
        actor.kind === "user"
          ? actor.name ||
            (await people().namesOf([actor.baUserId])).get(actor.baUserId) ||
            "Your team organiser"
          : "The site team"
      const pre = parsePreassign(row.preassign)
      const mail = inviteEmail({
        inviter,
        teamName: team.name ?? "your team",
        role: row.teamRole === "organiser" ? "organiser" : "member",
        libraryName:
          (pre &&
            (team.libraries ?? []).find(
              (l) => l.documentId === pre.libraryDocumentId
            )?.name) ||
          null,
        link: new URL(`/staff/team/join/${token}`, base),
      })
      const emailSent = await sendMail(
        (row.email ?? "").toLowerCase(),
        mail.subject,
        mail.text
      )
      if (!emailSent) throw new AccessError(503, "email_failed")

      return { emailSent }
    },

    async revokeInvite(
      teamId: string,
      memberId: string,
      actor: Actor
    ): Promise<void> {
      await teamTransaction(strapi, teamId, async () => {
        if (actor.kind === "user")
          await this.requireOrganiser(teamId, actor.baUserId)
        const row = await memberOf(teamId, memberId)
        if (row.status !== "invited") throw new AccessError(409, "not_invited")
        await members().update({
          documentId: memberId,
          data: { status: "removed", removedAt: now(), tokenHash: null },
        })
        const pre = parsePreassign(row.preassign)
        if (pre)
          await audit(pre.libraryDocumentId, actor, "invite_revoked", null, {
            memberId,
            team: teamId,
          })
      })
    },

    /** What `/staff/team/join/[token]` shows before accepting. */
    async preview(token: string, viewerEmail: string) {
      const row = await this.byToken(token)
      const team = row.team!
      const inviter = row.invitedBy?.startsWith("admin:")
        ? "The site team"
        : ((await people().namesOf([row.invitedBy ?? ""])).get(
            row.invitedBy ?? ""
          ) ?? "Your team organiser")
      const expired =
        !row.invitedAt ||
        Date.now() - Date.parse(row.invitedAt) > INVITE_TTL_DAYS * 86_400_000

      return {
        teamName: team.name ?? "Team",
        teamRole: row.teamRole === "organiser" ? "organiser" : "member",
        invitedByName: inviter,
        emailMasked: mask(row.email ?? ""),
        emailMatches:
          (row.email ?? "").toLowerCase() === viewerEmail.trim().toLowerCase(),
        status: expired
          ? "expired"
          : teamIsActive(team)
            ? "open"
            : "team_inactive",
        // The join page names the library and links its staff page by slug.
        preassign: await (async () => {
          const pre = parsePreassign(row.preassign)
          if (!pre) return null
          const library = await libraryOf(pre.libraryDocumentId)

          return {
            ...pre,
            libraryName: library?.name ?? null,
            librarySlug: library?.slug ?? null,
          }
        })(),
      }
    },

    async byToken(token: string): Promise<MemberRow> {
      if (!/^[a-f0-9]{64}$/.test(token)) throw new AccessError(404, "not_found")
      const [row] = (await members().findMany({
        filters: {
          tokenHash: { $eq: hashToken(token) },
          status: { $eq: "invited" },
        },
        fields: MEMBER_FIELDS,
        populate: {
          team: {
            fields: TEAM_FIELDS,
            populate: { libraries: { fields: LIBRARY_FIELDS } },
          },
        },
        limit: 1,
      })) as MemberRow[]
      if (!row?.team?.documentId) throw new AccessError(404, "not_found")

      return row
    },

    /**
     * Accepts an invite: the signed-in email must match the invited one,
     * the invite must be open and the Team active. The row becomes active
     * (token cleared), a pre-assignment is applied, and the session is
     * refreshed so Pro and the Team's libraries show at once.
     */
    async accept(
      token: string,
      user: { id: string; email: string; name: string }
    ): Promise<TeamSummary> {
      const found = await this.byToken(token)
      const teamId = found.team!.documentId
      const result = await teamTransaction(strapi, teamId, async () => {
        const row = await this.byToken(token)
        const team = await teamOf(teamId)
        if (!teamIsActive(team)) throw new AccessError(409, "team_inactive")
        if (
          !row.invitedAt ||
          Date.now() - Date.parse(row.invitedAt) > INVITE_TTL_DAYS * 86_400_000
        )
          throw new AccessError(409, "invite_unavailable")
        if ((row.email ?? "").toLowerCase() !== user.email.trim().toLowerCase())
          throw new AccessError(403, "email_mismatch")
        const already = await membershipOf(teamId, user.id)
        if (already) {
          await members().update({
            documentId: row.documentId,
            data: { status: "removed", removedAt: now(), tokenHash: null },
          })

          return { member: already, team, applied: null as string | null }
        }
        const member = (await members().update({
          documentId: row.documentId,
          data: {
            baUserId: user.id,
            status: "active",
            acceptedAt: now(),
            tokenHash: null,
          },
        })) as MemberRow
        let applied: string | null = null
        const pre = parsePreassign(row.preassign)
        if (pre) {
          try {
            applied = await grantAccess(
              team,
              { ...member, baUserId: user.id, email: row.email },
              pre.libraryDocumentId,
              pre.staffRole,
              {
                kind: "user",
                baUserId: user.id,
                email: user.email,
                name: user.name,
              }
            )
          } catch (err) {
            strapi.log.warn(
              `[access] pre-assignment for member ${member.documentId} failed`,
              err
            )
          }
        }

        return { member, team, applied }
      })
      await notifySessionInvalidated(strapi, user.id)
      const [summary] = await this.listMine(user.id, teamId)

      return (
        summary ?? {
          id: teamId,
          name: result.team.name ?? "Team",
          slug: result.team.slug ?? "",
          role: result.member.teamRole === "organiser" ? "organiser" : "member",
          libraryCount: result.team.libraries?.length ?? 0,
          status: result.team.status === "lapsed" ? "lapsed" : "active",
          expiresAt: result.team.expiresAt ?? null,
          verified: !!result.team.verifiedAt,
          organiserName: null,
          libraryDocumentIds: (result.team.libraries ?? []).map(
            (l) => l.documentId
          ),
        }
      )
    },

    /** Organiser or admin: staff access for a member at one library. */
    async assign(
      teamId: string,
      memberId: string,
      libraryDocumentId: unknown,
      staffRole: unknown,
      actor: Actor
    ): Promise<{ result: "assigned" | "claim_filed"; member: TeamMemberView }> {
      if (!isDocumentId(libraryDocumentId))
        throw new AccessError(400, "invalid_library")
      if (!isStaffRole(staffRole)) throw new AccessError(400, "invalid_role")
      const result = await teamTransaction(strapi, teamId, async () => {
        const team = await teamOf(teamId)
        if (actor.kind === "user")
          await this.requireOrganiser(teamId, actor.baUserId)
        if (!teamIsActive(team)) throw new AccessError(409, "team_inactive")
        const member = await memberOf(teamId, memberId)
        if (member.status !== "active")
          throw new AccessError(409, "member_not_active")

        return grantAccess(team, member, libraryDocumentId, staffRole, actor)
      })
      const member = await memberOf(teamId, memberId)
      if (member.baUserId)
        await notifySessionInvalidated(strapi, member.baUserId)
      const fresh = await view(await teamOf(teamId), {
        baUserId: actor.kind === "user" ? actor.baUserId : null,
        role: actor.kind === "admin" ? "admin" : "organiser",
      })

      return {
        result,
        member: fresh.members.find((m) => m.documentId === memberId)!,
      }
    },

    async unassign(
      teamId: string,
      memberId: string,
      libraryDocumentId: unknown,
      actor: Actor
    ): Promise<void> {
      if (!isDocumentId(libraryDocumentId))
        throw new AccessError(400, "invalid_library")
      const member = await teamTransaction(strapi, teamId, async () => {
        await teamOf(teamId)
        if (actor.kind === "user")
          await this.requireOrganiser(teamId, actor.baUserId)
        const member = await memberOf(teamId, memberId)
        await dropAccess(member, actor, libraryDocumentId)

        return member
      })
      if (member.baUserId)
        await notifySessionInvalidated(strapi, member.baUserId)
    },

    /**
     * Organiser or admin: team role and the full set of assignments. An
     * assignment not in the list is dropped; a new one is granted.
     */
    async setMember(
      teamId: string,
      memberId: string,
      body: { teamRole?: unknown; assignments?: unknown },
      actor: Actor
    ): Promise<TeamMemberView> {
      const member = await teamTransaction(strapi, teamId, async () => {
        const team = await teamOf(teamId)
        if (actor.kind === "user")
          await this.requireOrganiser(teamId, actor.baUserId)
        const member = await memberOf(teamId, memberId)
        if (body.teamRole !== undefined) {
          if (!isTeamRole(body.teamRole))
            throw new AccessError(400, "invalid_team_role")
          if (
            body.teamRole === "member" &&
            member.teamRole === "organiser" &&
            member.status === "active"
          ) {
            const organisers = (await memberRows(teamId)).filter(
              (r) => r.status === "active" && r.teamRole === "organiser"
            )
            if (organisers.length <= 1)
              throw new AccessError(409, "last_organiser")
          }
          await members().update({
            documentId: memberId,
            data: { teamRole: body.teamRole },
          })
        }
        if (body.assignments !== undefined) {
          if (!Array.isArray(body.assignments))
            throw new AccessError(400, "invalid_assignments")
          const wanted = body.assignments.map(parsePreassign)
          if (wanted.includes(null))
            throw new AccessError(400, "invalid_assignments")
          const next = new Map(
            (wanted as Preassign[]).map((a) => [
              a.libraryDocumentId,
              a.staffRole,
            ])
          )
          if (member.status !== "active") {
            // Not yet accepted: the first wanted assignment becomes the
            // pre-assignment applied on acceptance.
            const [first] = [...next.entries()]
            await members().update({
              documentId: memberId,
              data: {
                preassign: first
                  ? { libraryDocumentId: first[0], staffRole: first[1] }
                  : null,
              },
            })
          } else {
            if (!teamIsActive(team)) throw new AccessError(409, "team_inactive")
            const current = (await assignmentsOf([member])).get(memberId) ?? []
            for (const a of current)
              if (!next.has(a.libraryDocumentId))
                await dropAccess(member, actor, a.libraryDocumentId)
            for (const [libraryDocumentId, staffRole] of next) {
              const existing = current.find(
                (a) => a.libraryDocumentId === libraryDocumentId
              )
              if (existing?.staffRole === staffRole) continue
              await grantAccess(
                team,
                member,
                libraryDocumentId,
                staffRole,
                actor
              )
            }
          }
        }

        return member
      })
      if (member.baUserId)
        await notifySessionInvalidated(strapi, member.baUserId)
      const fresh = await view(await teamOf(teamId), {
        baUserId: actor.kind === "user" ? actor.baUserId : null,
        role: actor.kind === "admin" ? "admin" : "organiser",
      })

      return fresh.members.find((m) => m.documentId === memberId)!
    },

    /**
     * Removes a member (or revokes their invite): the row is kept as
     * `removed`, and every Team-sourced affiliation of theirs is deleted,
     * so the lifecycle ends live sessions, emails them and expires a lone
     * `verified_librarian` grant. Claim-sourced rows are untouched.
     */
    async remove(
      teamId: string,
      memberId: string,
      actor: Actor
    ): Promise<void> {
      const member = await teamTransaction(strapi, teamId, async () => {
        await teamOf(teamId)
        if (actor.kind === "user") {
          const me = await this.requireOrganiser(teamId, actor.baUserId)
          if (me.documentId === memberId)
            throw new AccessError(409, "cannot_remove_self")
        }
        const member = await memberOf(teamId, memberId)
        if (member.status === "active" && member.teamRole === "organiser") {
          const organisers = (await memberRows(teamId)).filter(
            (r) => r.status === "active" && r.teamRole === "organiser"
          )
          if (organisers.length <= 1 && actor.kind !== "admin")
            throw new AccessError(409, "last_organiser")
        }
        await members().update({
          documentId: memberId,
          data: {
            status: "removed",
            removedAt: now(),
            tokenHash: null,
            preassign: null,
          },
        })
        await dropAccess(member, actor)

        return member
      })
      if (member.baUserId)
        await notifySessionInvalidated(strapi, member.baUserId)
    },

    /**
     * The Teams `baUserId` belongs to, with the organiser's name, for the
     * staff index and the session bridge. Only `onlyTeamId` when given.
     */
    async listMine(
      baUserId: string,
      onlyTeamId?: string
    ): Promise<TeamSummary[]> {
      const memberships = (await loadTeamMemberships(strapi, baUserId)).filter(
        (m) => !onlyTeamId || m.teamDocumentId === onlyTeamId
      )
      if (memberships.length === 0) return []
      const organisers = (await members().findMany({
        filters: {
          team: {
            documentId: { $in: memberships.map((m) => m.teamDocumentId) },
          },
          status: { $eq: "active" },
          teamRole: { $eq: "organiser" },
        },
        fields: ["documentId", "baUserId", "email"],
        populate: { team: { fields: ["documentId"] } },
        sort: "id:asc",
        limit: memberships.length * 20,
      })) as MemberRow[]
      const names = await people().namesOf(
        organisers.flatMap((r) => (r.baUserId ? [r.baUserId] : []))
      )

      return memberships.map((m) => {
        const organiser = organisers.find(
          (r) => r.team?.documentId === m.teamDocumentId
        )

        return {
          id: m.teamDocumentId,
          name: m.name,
          slug: m.slug,
          role: m.teamRole,
          libraryCount: m.libraryDocumentIds.length,
          status: m.status,
          expiresAt: m.expiresAt,
          verified: m.verified,
          organiserName:
            (organiser?.baUserId && names.get(organiser.baUserId)) ||
            (organiser?.email ? mask(organiser.email) : null),
          libraryDocumentIds: m.libraryDocumentIds,
        }
      })
    },

    /**
     * The active Team covering one library, whether or not the viewer is in
     * it. For a member: the full view, with the pending invites pre-assigned
     * to that library. For staff outside the Team (`viewerIsMember: false`):
     * only the Team's name and its organiser (name, masked email), so the
     * Team tab can say "Ask {organiser} to add you" instead of a buy gate.
     * Null when no active Team covers the library.
     */
    async forLibrary(libraryDocumentId: string, baUserId: string) {
      const membership = (await loadTeamMemberships(strapi, baUserId)).find(
        (m) =>
          m.status === "active" &&
          m.libraryDocumentIds.includes(libraryDocumentId)
      )
      const team = membership
        ? null
        : ((
            (await teams().findMany({
              filters: {
                status: { $eq: "active" },
                libraries: { documentId: { $eq: libraryDocumentId } },
              },
              fields: TEAM_FIELDS,
              sort: ["createdAt:asc", "id:asc"],
              limit: 5,
            })) as TeamRow[]
          ).find(teamIsActive) ?? null)
      if (!membership && !team) return null
      const teamDocumentId = membership?.teamDocumentId ?? team!.documentId
      const rows = await memberRows(teamDocumentId)
      const names = await people().namesOf(
        rows.flatMap((r) => (r.baUserId ? [r.baUserId] : []))
      )
      const organisers = rows.filter(
        (r) => r.status === "active" && r.teamRole === "organiser"
      )
      const organiserNames = organisers.map(
        (r) => (r.baUserId && names.get(r.baUserId)) || mask(r.email ?? "")
      )
      if (!membership)
        return {
          documentId: teamDocumentId,
          name: team!.name ?? "Team",
          slug: team!.slug ?? "",
          verified: !!team!.verifiedAt,
          viewerIsMember: false as const,
          viewerIsOrganiser: false,
          organiserNames,
          organiserName: organiserNames[0] ?? null,
          organiserEmailMasked: organisers[0]?.email
            ? mask(organisers[0].email)
            : null,
          invites: [],
        }

      return {
        documentId: membership.teamDocumentId,
        name: membership.name,
        slug: membership.slug,
        verified: membership.verified,
        viewerIsMember: true as const,
        viewerIsOrganiser: membership.teamRole === "organiser",
        organiserNames,
        organiserName: organiserNames[0] ?? null,
        organiserEmailMasked: organisers[0]?.email
          ? mask(organisers[0].email)
          : null,
        invites: rows.flatMap((r) => {
          const pre = parsePreassign(r.preassign)
          if (
            r.status !== "invited" ||
            pre?.libraryDocumentId !== libraryDocumentId
          )
            return []
          const expired =
            !r.invitedAt ||
            Date.now() - Date.parse(r.invitedAt) > INVITE_TTL_DAYS * 86_400_000

          return [
            {
              documentId: r.documentId,
              emailMasked: mask(r.email ?? ""),
              staffRole: pre.staffRole,
              status: expired ? ("expired" as const) : ("pending" as const),
              expiresAt: new Date(
                Date.parse(r.invitedAt ?? now()) + INVITE_TTL_DAYS * 86_400_000
              ).toISOString(),
            },
          ]
        }),
      }
    },

    /**
     * For a claim approval: when the claim was filed by a Team assignment
     * on an unverified Team, the level and member to record. Null for an
     * ordinary claim, or when the member or Team no longer qualifies.
     */
    async claimContext(submission: any): Promise<{
      staffRole: StaffRole
      teamMemberDocumentId: string
    } | null> {
      const memberId = submission?.draftData?.teamMemberDocumentId
      if (!isDocumentId(memberId)) return null
      const row = (await members().findOne({
        documentId: memberId,
        fields: ["documentId", "baUserId", "status"],
        populate: {
          team: {
            fields: ["documentId", "status", "expiresAt"],
            populate: { libraries: { fields: ["documentId"] } },
          },
        },
      })) as MemberRow | null
      if (
        !row ||
        row.status !== "active" ||
        row.baUserId !== submission.submittedByUserId ||
        !row.team ||
        !teamIsActive(row.team) ||
        !(row.team.libraries ?? []).some(
          (l) => l.documentId === submission.targetDocumentId
        )
      )
        return null

      return {
        staffRole: isStaffRole(submission.draftData?.staffRole)
          ? submission.draftData.staffRole
          : "editor",
        teamMemberDocumentId: row.documentId,
      }
    },

    /** Account erasure: invites by email go, active rows are anonymised. */
    async eraseFor(baUserId: string, email: string | null): Promise<void> {
      const rows = (await members().findMany({
        filters: {
          $or: [
            { baUserId: { $eq: baUserId } },
            ...(email ? [{ email: { $eqi: email.trim().toLowerCase() } }] : []),
          ],
        },
        fields: ["documentId", "status"],
        limit: 100,
      })) as MemberRow[]
      for (const row of rows)
        await members().update({
          documentId: row.documentId,
          data: {
            baUserId: null,
            email: `erased-${row.documentId}@invalid`,
            status: "removed",
            removedAt: now(),
            tokenHash: null,
            preassign: null,
          },
        })
    },
  }
}
