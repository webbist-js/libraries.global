import type { DocumentStore, DocumentRuntime } from "./document-store"

const AFF = "api::library-affiliation.library-affiliation",
  GRANT = "plugin::access.library-authority-grant"
type Identity = { documentId: string }
type Level = "owner" | "editor"
type Source = "claim" | "team" | "network"
type Affiliation = Identity & {
  baUserId: string
  library: Identity
  role?: string | null
  department?: string | null
  verificationMethod?: string | null
  staffRole?: Level | null
  canGoLive?: boolean
  approvedAt?: string
  createdAt?: string
  source?: Source
  teamMember?: Identity | null
  authorityManaged?: boolean
}
type Grant = Identity & {
  grantKey: string
  baUserId: string
  library: Identity
  staffRole: Level
  canGoLive: boolean
  sourceKind: Source
  sourceDocumentId: string
  teamMemberDocumentId?: string | null
  mandateDocumentId?: string | null
  status: "active" | "revoked"
  approvedAt: string
}

export type AuthorityInput = {
  baUserId: string
  libraryDocumentId: string
  staffRole?: Level
  canGoLive?: boolean
  sourceKind: Source
  sourceDocumentId: string
  teamMemberDocumentId?: string | null
  mandateDocumentId?: string | null
  issuedBy: string
  role?: string | null
  department?: string | null
  verificationMethod?: string
}
const affiliations = (strapi: DocumentRuntime) =>
  strapi.documents(AFF) as DocumentStore<Affiliation>
const grants = (strapi: DocumentRuntime) =>
  strapi.documents(GRANT) as DocumentStore<Grant>
const subject = (baUserId: string, libraryDocumentId: string) => ({
  baUserId,
  library: { documentId: libraryDocumentId },
})
async function existingAffiliation(
  strapi: DocumentRuntime,
  userId: string,
  libraryId: string
) {
  return affiliations(strapi).findFirst({
    filters: subject(userId, libraryId),
    populate: {
      library: { fields: ["documentId"] },
      teamMember: { fields: ["documentId"] },
    },
  })
}
async function legacyLevel(
  strapi: DocumentRuntime,
  row: Affiliation
): Promise<Level> {
  if (row.staffRole) return row.staffRole
  const peers = await affiliations(strapi).findMany({
    filters: {
      library: { documentId: row.library.documentId },
      $or: [{ role: { $null: true } }, { role: { $ne: "proposer" } }],
    },
    fields: ["staffRole", "approvedAt", "createdAt"],
    sort: ["approvedAt:asc", "createdAt:asc"],
    limit: 501,
  })
  if (peers.length > 500 || peers.some((peer) => peer.staffRole))
    return "editor"

  return peers[0]?.documentId === row.documentId ? "owner" : "editor"
}
async function seedLegacy(strapi: DocumentRuntime, row: Affiliation | null) {
  if (!row || row.authorityManaged || row.role === "proposer") return
  const grantKey = `legacy:${row.documentId}`
  if (!(await grants(strapi).findFirst({ filters: { grantKey } })))
    await grants(strapi).create({
      data: {
        grantKey,
        baUserId: row.baUserId,
        library: { connect: [{ documentId: row.library.documentId }] },
        staffRole: await legacyLevel(strapi, row),
        canGoLive: row.canGoLive !== false,
        sourceKind: row.source ?? "claim",
        sourceDocumentId: row.teamMember?.documentId ?? row.documentId,
        teamMemberDocumentId: row.teamMember?.documentId ?? null,
        legacyAffiliationDocumentId: row.documentId,
        status: "active",
        approvedAt: row.approvedAt ?? row.createdAt ?? new Date().toISOString(),
        issuedBy: "legacy-migration",
      },
    })
  await affiliations(strapi).update({
    documentId: row.documentId,
    data: { authorityManaged: true },
  })
}
const sourceOrder: Record<Source, number> = { claim: 0, team: 1, network: 2 }
async function project(
  strapi: DocumentRuntime,
  userId: string,
  libraryId: string,
  metadata: Partial<AuthorityInput> = {}
) {
  const existing = await existingAffiliation(strapi, userId, libraryId)
  const active = await grants(strapi).findMany({
    filters: { ...subject(userId, libraryId), status: "active" },
    sort: "approvedAt:asc",
    limit: 101,
  })
  if (active.length > 100)
    throw new RangeError("Too many authority sources for one library")
  if (!active.length) {
    if (existing && existing.role !== "proposer")
      await (
        strapi.documents(AFF) as DocumentStore<Affiliation> & {
          delete: (args: { documentId: string }) => Promise<unknown>
        }
      ).delete({ documentId: existing.documentId })

    return null
  }
  const primary = [...active].sort(
    (a, b) => sourceOrder[a.sourceKind] - sourceOrder[b.sourceKind]
  )[0]!
  const data: Record<string, unknown> = {
    baUserId: userId,
    library: { set: [{ documentId: libraryId }] },
    staffRole: active.some((grant) => grant.staffRole === "owner")
      ? "owner"
      : "editor",
    canGoLive: active.some((grant) => grant.canGoLive),
    approvedAt: active[0]!.approvedAt,
    source: primary.sourceKind,
    teamMember:
      primary.sourceKind === "team"
        ? { set: [{ documentId: primary.teamMemberDocumentId }] }
        : { set: [] },
    authorityManaged: true,
  }
  if (existing?.role === "proposer") data.role = null
  for (const key of ["role", "department", "verificationMethod"] as const)
    if (metadata[key] !== undefined) data[key] = metadata[key]
  if (existing)
    return affiliations(strapi).update({
      documentId: existing.documentId,
      data,
    })

  return affiliations(strapi).create({ data })
}

export async function withAuthorityLock<T>(
  strapi: DocumentRuntime,
  userId: string,
  libraryId: string,
  work: () => Promise<T>
) {
  return strapi.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `authority:${libraryId}:${userId}`,
    ])

    return work()
  })
}
type OriginMandate = Identity & {
  network: Identity
  status: string
  approvedLibraryIds: string[]
  ownerLibraryIds?: string[]
  baUserId: string
}

/** The reviewed source and its revocation batch use the same lock. */
export async function withAuthorityOrigin<T>(
  strapi: DocumentRuntime,
  input: AuthorityInput,
  work: () => Promise<T>
) {
  if (!input.mandateDocumentId) return work()
  const store = strapi.documents(
    "plugin::access.network-mandate"
  ) as DocumentStore<OriginMandate>
  const initial = await store.findOne({
    documentId: input.mandateDocumentId,
    populate: { network: { fields: ["documentId"] } },
  })
  if (!initial) throw new RangeError("Management mandate is unavailable")

  return strapi.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `network:mandate:${initial.network.documentId}`,
    ])
    const mandate = await store.findOne({ documentId: input.mandateDocumentId })
    if (
      mandate?.status !== "approved" ||
      !mandate.approvedLibraryIds.includes(input.libraryDocumentId)
    )
      throw new RangeError("Management mandate no longer covers this library")
    if (
      (input.sourceKind === "team" || input.staffRole === "owner") &&
      !mandate.ownerLibraryIds?.includes(input.libraryDocumentId)
    )
      throw new RangeError(
        "This scope does not authorise owner responsibility or delegation"
      )
    if (input.sourceKind === "network" && mandate.baUserId !== input.baUserId)
      throw new RangeError("Management mandate belongs to another beneficiary")

    return work()
  })
}
export async function issueAuthorityGrant(
  strapi: DocumentRuntime,
  input: AuthorityInput
) {
  return withAuthorityOrigin(strapi, input, () =>
    withAuthorityLock(
      strapi,
      input.baUserId,
      input.libraryDocumentId,
      async () => {
        const previous = await existingAffiliation(
          strapi,
          input.baUserId,
          input.libraryDocumentId
        )
        await seedLegacy(strapi, previous)
        const grantKey = `${input.sourceKind}:${input.sourceDocumentId}:${input.baUserId}:${input.libraryDocumentId}`
        const current = await grants(strapi).findFirst({
          filters: { grantKey },
        })
        const staffRole = input.staffRole ?? previous?.staffRole ?? "editor"
        const data = {
          grantKey,
          baUserId: input.baUserId,
          library: { set: [{ documentId: input.libraryDocumentId }] },
          staffRole,
          canGoLive: input.canGoLive ?? previous?.canGoLive ?? true,
          sourceKind: input.sourceKind,
          sourceDocumentId: input.sourceDocumentId,
          teamMemberDocumentId: input.teamMemberDocumentId ?? null,
          mandateDocumentId: input.mandateDocumentId ?? null,
          status: "active",
          approvedAt: current?.approvedAt ?? new Date().toISOString(),
          issuedBy: input.issuedBy,
          revokedAt: null,
        }
        await (current
          ? grants(strapi).update({ documentId: current.documentId, data })
          : grants(strapi).create({ data }))
        const row = await project(
          strapi,
          input.baUserId,
          input.libraryDocumentId,
          input
        )
        if (!row) throw new Error("Authority projection did not persist")

        return { documentId: row.documentId, created: !previous }
      }
    )
  )
}
export async function revokeAuthoritySource(
  strapi: DocumentRuntime,
  input: {
    baUserId: string
    libraryDocumentId: string
    sourceKind?: Source
    sourceDocumentId?: string
    mandateDocumentId?: string
  }
) {
  return withAuthorityLock(
    strapi,
    input.baUserId,
    input.libraryDocumentId,
    async () => {
      await seedLegacy(
        strapi,
        await existingAffiliation(
          strapi,
          input.baUserId,
          input.libraryDocumentId
        )
      )
      const filters: Record<string, unknown> = {
        ...subject(input.baUserId, input.libraryDocumentId),
        status: "active",
      }
      for (const key of [
        "sourceKind",
        "sourceDocumentId",
        "mandateDocumentId",
      ] as const)
        if (input[key]) filters[key] = input[key]
      const matching = await grants(strapi).findMany({ filters, limit: 101 })
      if (matching.length > 100)
        throw new RangeError("Too many authority sources for one library")
      for (const grant of matching)
        await grants(strapi).update({
          documentId: grant.documentId,
          data: { status: "revoked", revokedAt: new Date().toISOString() },
        })
      await project(strapi, input.baUserId, input.libraryDocumentId)

      return matching.length
    }
  )
}
export async function changeEffectiveAuthority(
  strapi: DocumentRuntime,
  input: {
    baUserId: string
    libraryDocumentId: string
    staffRole?: Level
    canGoLive?: boolean
  }
) {
  return withAuthorityLock(
    strapi,
    input.baUserId,
    input.libraryDocumentId,
    async () => {
      await seedLegacy(
        strapi,
        await existingAffiliation(
          strapi,
          input.baUserId,
          input.libraryDocumentId
        )
      )
      const active = await grants(strapi).findMany({
        filters: {
          ...subject(input.baUserId, input.libraryDocumentId),
          status: "active",
        },
        limit: 101,
      })
      if (active.length > 100)
        throw new RangeError("Too many authority sources for one library")
      const data: Record<string, unknown> = {}
      if (input.staffRole) data.staffRole = input.staffRole
      if (input.canGoLive !== undefined) data.canGoLive = input.canGoLive
      for (const grant of active)
        await grants(strapi).update({ documentId: grant.documentId, data })
      await project(strapi, input.baUserId, input.libraryDocumentId)
    }
  )
}
export async function authorityLibrariesForSource(
  strapi: DocumentRuntime,
  sourceKind: Source,
  sourceDocumentId: string
) {
  return grants(strapi).findMany({
    filters: { sourceKind, sourceDocumentId, status: "active" },
    populate: { library: { fields: ["documentId"] } },
    limit: 2001,
  })
}

/** Capture an old row's independent origin before a legacy writer changes it. */
export async function prepareLegacyAuthority(
  strapi: DocumentRuntime,
  userId: string,
  libraryId: string
) {
  return withAuthorityLock(strapi, userId, libraryId, () =>
    existingAffiliation(strapi, userId, libraryId).then((row) =>
      seedLegacy(strapi, row)
    )
  )
}

/** Recheck mandate scope at the authority boundary, including while a removal batch runs. */
export async function currentAuthorityGrants(
  strapi: DocumentRuntime,
  userId: string,
  libraryIds: string[]
) {
  const rows = await grants(strapi).findMany({
    filters: {
      baUserId: userId,
      library: { documentId: { $in: libraryIds } },
      status: "active",
    },
    populate: { library: { fields: ["documentId"] } },
    limit: 10001,
  })
  if (rows.length > 10000)
    throw new RangeError("Authority source limit exceeded")
  const ids = [
    ...new Set(
      rows.flatMap((row) =>
        row.mandateDocumentId ? [row.mandateDocumentId] : []
      )
    ),
  ]
  const mandates = ids.length
    ? await (
        strapi.documents("plugin::access.network-mandate") as DocumentStore<
          Identity & { status: string; approvedLibraryIds: string[] }
        >
      ).findMany({
        filters: { documentId: { $in: ids } },
        fields: ["status", "approvedLibraryIds"],
        limit: ids.length,
      })
    : []
  const approved = new Map(
    mandates
      .filter((row) => row.status === "approved")
      .map((row) => [row.documentId, new Set(row.approvedLibraryIds)])
  )

  return rows.filter(
    (row) =>
      !row.mandateDocumentId ||
      approved.get(row.mandateDocumentId)?.has(row.library.documentId)
  )
}
export async function effectiveManagedAuthority(
  strapi: DocumentRuntime,
  userId: string,
  libraryIds: string[]
) {
  const rows = await currentAuthorityGrants(strapi, userId, libraryIds),
    result = new Map<string, { staffRole: Level; canGoLive: boolean }>()
  for (const row of rows) {
    const id = row.library.documentId,
      prior = result.get(id)
    result.set(id, {
      staffRole:
        row.staffRole === "owner" || prior?.staffRole === "owner"
          ? "owner"
          : "editor",
      canGoLive: row.canGoLive || prior?.canGoLive === true,
    })
  }

  return result
}
