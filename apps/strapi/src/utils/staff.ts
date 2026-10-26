import {
  canStaff,
  resolveCapabilities,
  SESSION_PROFILE_MAX_CLAIMS,
  type Capabilities,
  type StaffAction,
  type StaffClaim,
  type StaffRole,
} from "@repo/access"

import { claimAffiliationFilter } from "./affiliations"
import { effectiveManagedAuthority } from "./authority-grants"
import { activeGrants } from "./role-grants"

export const AFFILIATION_UID = "api::library-affiliation.library-affiliation"
export type StaffMember = {
  affiliationDocumentId: string
  baUserId: string
  staffRole: StaffRole
  canGoLive: boolean
  approvedAt: string
  authorityManaged?: boolean
  jobTitle: string | null
  department: string | null
}

/** Rows above this per library degrade every level to editor (2.2). */
export const STAFF_LIMIT = 500

/**
 * Stored levels win. Rows that predate explicit levels are all `null`: then,
 * and only then, the earliest approved claimant is the owner. Once any row
 * carries a level, a `null` row is an editor, so a founder stored as
 * `"owner"` is never demoted by a later owner-level colleague.
 */
export function deriveStaffRoles<
  T extends { staffRole: StaffRole | null; approvedAt: string },
>(rows: T[]): (T & { staffRole: StaffRole })[] {
  const legacy = rows.length > 0 && rows.every((row) => row.staffRole === null)
  const owner = legacy
    ? rows.reduce(
        (earliest, row, index) =>
          earliest < 0 || row.approvedAt < rows[earliest]!.approvedAt
            ? index
            : earliest,
        -1
      )
    : -1

  return rows.map((row, index) => ({
    ...row,
    staffRole: index === owner ? "owner" : (row.staffRole ?? "editor"),
  }))
}

function toMember(row: any): Omit<StaffMember, "staffRole"> & {
  staffRole: StaffRole | null
} {
  return {
    authorityManaged: row.authorityManaged === true,
    affiliationDocumentId: row.documentId,
    baUserId: row.baUserId,
    staffRole:
      row.staffRole === "owner" || row.staffRole === "editor"
        ? row.staffRole
        : null,
    canGoLive: row.canGoLive !== false,
    approvedAt: row.approvedAt ?? row.createdAt,
    jobTitle: row.role ?? null,
    department: row.department ?? null,
  }
}

/** Levels for one library's rows; over the cap everyone is an editor. */
function levelsOf(
  strapi: any,
  libraryDocumentId: string,
  rows: any[]
): StaffMember[] {
  const members = rows.map(toMember)
  if (members.length > STAFF_LIMIT) {
    strapi.log?.warn?.(
      `[staff] Library ${libraryDocumentId} has over ${STAFF_LIMIT} staff rows; every level degrades to editor`
    )

    return members
      .slice(0, STAFF_LIMIT)
      .map((member) => ({ ...member, staffRole: "editor" as const }))
  }

  return deriveStaffRoles(members)
}

const STAFF_ROW_FIELDS = [
  "authorityManaged",
  "documentId",
  "baUserId",
  "staffRole",
  "canGoLive",
  "approvedAt",
  "createdAt",
  "role",
  "department",
]

export async function listStaff(
  strapi: any,
  libraryDocumentId: string
): Promise<StaffMember[]> {
  const { baUserId: _user, ...claimFilter } = claimAffiliationFilter("")
  const rows = await strapi.documents(AFFILIATION_UID).findMany({
    filters: {
      ...claimFilter,
      library: { documentId: { $eq: libraryDocumentId } },
    },
    fields: STAFF_ROW_FIELDS,
    sort: ["createdAt:asc", "id:asc"],
    limit: STAFF_LIMIT + 1,
  })

  return levelsOf(strapi, libraryDocumentId, rows)
}

export async function resolveStaff(
  strapi: any,
  baUserId: string,
  libraryDocumentId: string
): Promise<StaffMember | null> {
  const member =
    (await listStaff(strapi, libraryDocumentId)).find(
      (row) => row.baUserId === baUserId
    ) ?? null
  if (!member?.authorityManaged) return member
  const current = (
    await effectiveManagedAuthority(strapi, baUserId, [libraryDocumentId])
  ).get(libraryDocumentId)

  return current ? { ...member, ...current } : null
}

/**
 * The caller's staff memberships: one query for their own claim rows, then
 * one `$in` query for every member of those libraries (levels are derived
 * per library, never from a single row). A library over `STAFF_LIMIT` rows
 * degrades to editor with a warning instead of failing the session.
 */
export async function loadStaffClaims(
  strapi: any,
  baUserId: string
): Promise<StaffClaim[]> {
  const own = await strapi.documents(AFFILIATION_UID).findMany({
    filters: claimAffiliationFilter(baUserId),
    fields: ["documentId"],
    populate: { library: { fields: ["documentId"] } },
    sort: "id:asc",
    limit: SESSION_PROFILE_MAX_CLAIMS,
  })
  const ids = [
    ...new Set<string>(
      own.flatMap((row: any) =>
        row.library?.documentId ? [row.library.documentId] : []
      )
    ),
  ]
  if (ids.length === 0) return []
  const { baUserId: _user, ...claimFilter } = claimAffiliationFilter("")
  const limit = (STAFF_LIMIT + 1) * ids.length
  const rows = await strapi.documents(AFFILIATION_UID).findMany({
    filters: {
      ...claimFilter,
      library: { documentId: { $in: ids } },
    },
    fields: STAFF_ROW_FIELDS,
    populate: { library: { fields: ["documentId"] } },
    sort: ["createdAt:asc", "id:asc"],
    limit,
  })
  const truncated = rows.length >= limit
  if (truncated)
    strapi.log?.warn?.(
      `[staff] Staff rows for ${baUserId}'s libraries exceed ${limit}; every level degrades to editor`
    )
  const byLibrary = new Map<string, any[]>()
  for (const row of rows) {
    const id = row.library?.documentId
    if (!id) continue
    byLibrary.set(id, [...(byLibrary.get(id) ?? []), row])
  }

  const managed = rows.filter(
    (row: { baUserId: string; authorityManaged?: boolean }) =>
      row.baUserId === baUserId && row.authorityManaged
  )
  const effective = managed.length
    ? await effectiveManagedAuthority(strapi, baUserId, ids)
    : new Map()

  return ids.flatMap((id) => {
    const members = levelsOf(strapi, id, byLibrary.get(id) ?? [])
    const member = members.find((row) => row.baUserId === baUserId)

    const current = member?.authorityManaged ? effective.get(id) : member

    return current
      ? [
          {
            libraryDocumentId: id,
            staffRole: truncated ? ("editor" as const) : current.staffRole,
            canGoLive: current.canGoLive,
          },
        ]
      : []
  })
}

export async function loadCallerCapabilities(
  strapi: any,
  baUserId: string
): Promise<Capabilities> {
  const [grants, claims] = await Promise.all([
    activeGrants(strapi, baUserId),
    loadStaffClaims(strapi, baUserId),
  ])

  return resolveCapabilities({ signedIn: true, grants, claims })
}

export async function requireStaffMember(
  strapi: any,
  baUserId: string,
  libraryDocumentId: string,
  action: StaffAction
): Promise<StaffMember | null> {
  const member = await resolveStaff(strapi, baUserId, libraryDocumentId)
  if (!member) return null
  const caps = resolveCapabilities({
    signedIn: true,
    grants: [],
    claims: [
      {
        libraryDocumentId,
        staffRole: member.staffRole,
        canGoLive: member.canGoLive,
      },
    ],
  })

  return canStaff(caps, action, libraryDocumentId) ? member : null
}
