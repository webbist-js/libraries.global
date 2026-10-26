import { canSubmit } from "@repo/access"
import {
  NETWORK_LIMITS,
  parseNetworkRequest,
  widgetText,
  type NetworkClaimSnapshot,
  type NetworkRequest,
} from "@repo/shared-data"

import { loadNetwork, memberIds, membershipRevision } from "./network-catalogue"
import { recordNetworkEvent } from "./network-events"
import {
  AFFILIATION,
  MANDATE,
  SUBMISSION,
  networkStore,
  type AffiliationRecord,
  type MandateRecord,
  type NetworkRuntime,
  type NetworkUser,
  type SubmissionRecord,
} from "./network-records"
import type {
  RecordInput,
  DocumentRuntime,
} from "../../../../utils/document-store"
import { AccessError } from "../utils/admin"

type Member = { documentId: string; teamRole: string; status: string }

export async function requireNetworkOrganiser(
  strapi: DocumentRuntime,
  teamId: string,
  userId: string
) {
  const row = await networkStore<Member>(
    strapi,
    "plugin::access.team-member"
  ).findFirst({
    filters: {
      team: { documentId: teamId },
      baUserId: userId,
      status: "active",
      teamRole: "organiser",
    },
  })
  if (!row) throw new AccessError(403, "organiser_required")
}
export async function subjectLock<T>(
  strapi: DocumentRuntime,
  key: string,
  work: () => Promise<T>
) {
  return strapi.db.transaction(async ({ trx }) => {
    await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `network:${key}`,
    ])

    return work()
  })
}
export async function validateClaimScope(
  strapi: DocumentRuntime,
  networkId: string,
  userId: string,
  request: NetworkRequest
) {
  const network = await loadNetwork(strapi, networkId),
    ids = await memberIds(strapi, networkId)
  if (request.intent === "management" && network.kind === "consortium")
    throw new AccessError(422, "consortium_has_no_branch_authority")
  if (request.intent === "management" && !request.libraryIds.length)
    throw new RangeError("Choose the libraries you manage")
  if (request.libraryIds.some((id) => !ids.includes(id)))
    throw new AccessError(409, "network_membership_changed")
  if (request.teamId)
    await requireNetworkOrganiser(strapi, request.teamId, userId)
  if (request.mandateId) {
    const previous = await networkStore<MandateRecord>(strapi, MANDATE).findOne(
      { documentId: request.mandateId, populate: { network: true, team: true } }
    )
    if (
      previous?.baUserId !== userId ||
      previous.network.documentId !== networkId
    )
      throw new AccessError(403, "mandate_unavailable")
  }

  return { network, ids }
}
export async function saveNetworkAffiliation(
  strapi: DocumentRuntime,
  userId: string,
  networkId: string,
  input: RecordInput
) {
  return subjectLock(strapi, `affiliation:${userId}`, async () => {
    await loadNetwork(strapi, networkId)
    const store = networkStore<AffiliationRecord>(strapi, AFFILIATION),
      existing = await store.findFirst({
        filters: { baUserId: userId, network: { documentId: networkId } },
      })
    if (
      !existing &&
      (await store.count({ filters: { baUserId: userId } })) >=
        NETWORK_LIMITS.affiliations
    )
      throw new AccessError(422, "affiliation_limit")
    const role = widgetText(input.role, 160, true),
      department = widgetText(input.department ?? "", 160)
    const changed =
      existing?.status === "verified" &&
      (existing.role !== role || existing.department !== department)
    const data = {
      ...(changed ? { status: "declared", verifiedAt: null } : {}),
      baUserId: userId,
      network: networkId,
      role,
      department,
      ...(typeof input.publicDisplay === "boolean"
        ? { publicDisplay: input.publicDisplay }
        : {}),
      ...(!existing || existing.status === "revoked"
        ? { status: "declared" }
        : {}),
    }

    return existing
      ? store.update({ documentId: existing.documentId, data })
      : store.create({ data })
  })
}
async function requireClaimChange(
  strapi: DocumentRuntime,
  userId: string,
  networkId: string,
  request: NetworkRequest
) {
  if (request.intent === "employment") {
    const affiliation = await networkStore<AffiliationRecord>(
      strapi,
      AFFILIATION
    ).findFirst({
      filters: {
        baUserId: userId,
        network: { documentId: networkId },
        status: "verified",
      },
    })
    if (
      affiliation?.role === request.role &&
      affiliation.department === request.department
    )
      throw new AccessError(409, "affiliation_already_verified")

    return
  }
  const previous = await networkStore<MandateRecord>(strapi, MANDATE).findFirst(
    {
      filters: {
        baUserId: userId,
        network: { documentId: networkId },
        status: "approved",
      },
      populate: { team: true },
    }
  )
  if (!previous) return
  const covered = request.libraryIds.every(
    (id) =>
      previous.approvedLibraryIds.includes(id) &&
      (request.staffRole !== "owner" || previous.ownerLibraryIds?.includes(id))
  )
  const sameTeam =
    !request.teamId || request.teamId === previous.team?.documentId
  if (covered && sameTeam) throw new AccessError(409, "scope_already_approved")
}

export async function submitNetworkClaim(
  strapi: NetworkRuntime,
  user: NetworkUser,
  networkId: string,
  input: RecordInput
) {
  const request = parseNetworkRequest(input),
    caps = await strapi
      .plugin("content-moderation")
      .service("submission-policy")
      .loadCapabilities(user.id)
  if (!canSubmit(caps.caps, "network_claim"))
    throw new AccessError(403, "claim_not_permitted")

  return subjectLock(strapi, `claim:${user.id}`, async () => {
    const { network, ids } = await validateClaimScope(
      strapi,
      networkId,
      user.id,
      request
    )
    await requireClaimChange(strapi, user.id, networkId, request)
    const store = networkStore<SubmissionRecord>(strapi, SUBMISSION),
      filters = {
        submissionType: "network_claim",
        submittedByUserId: user.id,
        status: { $in: ["pending", "needs_info", "draft"] },
      }
    const open = await store.findFirst({
      filters: { ...filters, targetDocumentId: networkId },
    })
    if (open && open.status !== "needs_info")
      throw new AccessError(409, "claim_pending")
    if (!open && (await store.count({ filters })) >= NETWORK_LIMITS.openClaims)
      throw new AccessError(429, "open_claim_limit")
    const fields: NetworkClaimSnapshot = {
      ...request,
      schemaVersion: 1,
      networkId,
      networkName: network.name,
      networkKind: network.kind,
      membershipRevision: membershipRevision(ids),
      sourceLibraryIds: ids,
      submittedAt: new Date().toISOString(),
    }
    const submission = open
      ? await strapi
          .plugin("content-moderation")
          .service("submission")
          .resubmitNetwork(open.documentId, user.id, fields, input.locale)
      : await strapi.plugin("content-moderation").service("submission").create({
          submissionType: "network_claim",
          locale: input.locale,
          targetEntityType: "library_network",
          targetDocumentId: networkId,
          targetSlug: network.slug,
          fields,
          note: request.note,
          evidenceUrl: request.evidenceUrl,
          submittedByUserId: user.id,
          submittedByEmail: user.email,
          submittedByName: user.name,
        })
    if (!submission) throw new AccessError(409, "version_conflict")
    const affiliation = await saveNetworkAffiliation(
      strapi,
      user.id,
      networkId,
      {
        ...request,
        ...(typeof input.publicDisplay === "boolean"
          ? { publicDisplay: input.publicDisplay }
          : {}),
      }
    )
    if (affiliation.status !== "verified")
      await networkStore<AffiliationRecord>(strapi, AFFILIATION).update({
        documentId: affiliation.documentId,
        data: {
          status: "pending",
          submissionDocumentId: submission.documentId,
        },
      })

    return { documentId: submission.documentId, status: submission.status }
  })
}
/** Called only inside the moderation service's status/CAS transaction. */
export async function approveNetworkClaim(
  strapi: DocumentRuntime,
  submission: SubmissionRecord,
  reviewerId: string,
  approvedIds?: string[],
  approvedStaffRole: "editor" | "owner" = "editor"
) {
  const snapshot = submission.fields,
    request = parseNetworkRequest(snapshot)
  if (
    snapshot.schemaVersion !== 1 ||
    snapshot.networkId !== submission.targetDocumentId
  )
    throw new Error("Invalid frozen network request")
  if (approvedStaffRole === "owner" && request.staffRole !== "owner")
    throw new Error("Owner responsibility was not requested")
  const { network, ids } = await validateClaimScope(
    strapi,
    snapshot.networkId,
    submission.submittedByUserId,
    { ...request, libraryIds: approvedIds ?? request.libraryIds }
  )
  if (
    approvedIds !== undefined &&
    (!Array.isArray(approvedIds) ||
      approvedIds.some((id) => typeof id !== "string"))
  )
    throw new Error("Invalid approved scope")
  const approved = [...new Set(approvedIds ?? request.libraryIds)]
  if (
    approved.some(
      (id) =>
        !request.libraryIds.includes(id) ||
        !snapshot.sourceLibraryIds.includes(id) ||
        !ids.includes(id)
    )
  )
    throw new Error("Approval exceeds the reviewed scope or membership changed")
  if (request.intent === "management" && !approved.length)
    throw new Error("Approve at least one library or reject the request")
  const affiliation = await subjectLock(
    strapi,
    `affiliation:${submission.submittedByUserId}`,
    async () => {
      const current = await networkStore<AffiliationRecord>(
        strapi,
        AFFILIATION
      ).findFirst({
        filters: {
          baUserId: submission.submittedByUserId,
          network: { documentId: network.documentId },
        },
      })
      if (
        current?.status === "revoked" &&
        current.revokedAt &&
        current.revokedAt >= snapshot.submittedAt
      )
        throw new Error(
          "This institutional affiliation was withdrawn after the request"
        )

      return saveNetworkAffiliation(
        strapi,
        submission.submittedByUserId,
        network.documentId,
        { ...request }
      )
    }
  )
  await networkStore<AffiliationRecord>(strapi, AFFILIATION).update({
    documentId: affiliation.documentId,
    data: {
      status: "verified",
      verifiedAt: new Date().toISOString(),
      submissionDocumentId: submission.documentId,
    },
  })
  if (request.intent === "employment") return affiliation.documentId

  return subjectLock(strapi, `mandate:${network.documentId}`, async () => {
    const store = networkStore<MandateRecord>(strapi, MANDATE),
      previous = await store.findFirst({
        filters: {
          baUserId: submission.submittedByUserId,
          network: { documentId: network.documentId },
          status: "approved",
        },
        populate: { team: true },
      })
    if (request.teamId) {
      const conflicting = await store.findFirst({
        filters: {
          network: { documentId: network.documentId },
          status: "approved",
          team: { documentId: { $ne: request.teamId } },
        },
      })
      if (conflicting)
        throw new Error(
          "Another Team represents this service; review the representation first"
        )
    }
    const all = [
      ...new Set([...(previous?.approvedLibraryIds ?? []), ...approved]),
    ]
    if (all.length > NETWORK_LIMITS.libraries)
      throw new Error("Mandate scope exceeds the limit")
    const owners = [
      ...new Set([
        ...(previous?.ownerLibraryIds ?? []),
        ...(approvedStaffRole === "owner" ? approved : []),
      ]),
    ]
    const pending = [
      ...new Set([
        ...(previous?.fulfilment.pending ?? []),
        ...approved.filter(
          (id) =>
            !previous?.approvedLibraryIds.includes(id) ||
            (approvedStaffRole === "owner" &&
              !previous?.ownerLibraryIds?.includes(id))
        ),
      ]),
    ]
    const data = {
      staffRole: owners.length ? "owner" : "editor",
      ownerLibraryIds: owners,
      baUserId: submission.submittedByUserId,
      network: network.documentId,
      team: request.teamId ?? previous?.team?.documentId ?? null,
      status: "approved",
      approvedLibraryIds: all,
      sourceLibraryIds: [
        ...new Set([
          ...(previous?.sourceLibraryIds ?? []),
          ...snapshot.sourceLibraryIds,
        ]),
      ],
      membershipRevision: membershipRevision(ids),
      submissionDocumentId: submission.documentId,
      reviewedBy: reviewerId,
      reviewedAt: new Date().toISOString(),
      version: (previous?.version ?? 0) + 1,
      fulfilment: {
        pending,
        applied: previous?.fulfilment.applied ?? [],
        failures: previous?.fulfilment.failures ?? {},
        revocations: previous?.fulfilment.revocations ?? [],
        complete: pending.length === 0,
      },
      nextAttemptAt: new Date().toISOString(),
    }
    const mandate = previous
      ? await store.update({ documentId: previous.documentId, data })
      : await store.create({ data })

    await recordNetworkEvent(strapi, mandate.documentId, {
      actor: reviewerId,
      action: "approved",
      version: data.version,
      submissionDocumentId: submission.documentId,
      libraryIds: approved,
      ownerLibraryIds: approvedStaffRole === "owner" ? approved : [],
    })

    return mandate.documentId
  })
}
