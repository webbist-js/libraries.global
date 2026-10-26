import { canModerate } from "@repo/access"
import {
  libraryTypeName,
  widgetText,
  type NetworkAffiliation,
  type NetworkMandate,
} from "@repo/shared-data"

import {
  listNetworks,
  loadNetwork,
  memberIds,
  networkDetail,
} from "./network-catalogue"
import {
  saveNetworkAffiliation,
  subjectLock,
  submitNetworkClaim,
} from "./network-claims"
import { NETWORK_EVENT, type NetworkEvent } from "./network-events"
import {
  fulfilNetworkMandate,
  reconcileNetworkMandate,
} from "./network-fulfilment"
import {
  AFFILIATION,
  MANDATE,
  SUBMISSION,
  networkStore,
  networkLibraries,
  type AffiliationRecord,
  type MandateRecord,
  type NetworkRuntime,
  type NetworkUser,
  type SubmissionRecord,
} from "./network-records"
import { claimAffiliationFilter } from "../../../../utils/affiliations"
import type { RecordInput } from "../../../../utils/document-store"
import { resolveStaff } from "../../../../utils/staff"
import { AccessError } from "../utils/admin"

const networkIdentity = (row: {
  documentId: string
  name: string
  slug: string
  kind: NetworkAffiliation["network"]["kind"]
}) => ({
  documentId: row.documentId,
  name: row.name,
  slug: row.slug,
  kind: row.kind,
})

export default ({ strapi }: { strapi: NetworkRuntime }) => {
  async function moderator(userId: string, locale = "en") {
    const { caps } = await strapi
      .plugin("content-moderation")
      .service("submission-policy")
      .loadCapabilities(userId)
    if (
      !canModerate(
        caps,
        {
          submissionType: "network_claim",
          locale,
          submittedByUserId: "",
        },
        userId
      )
    )
      throw new AccessError(403, "moderator_required")
  }
  async function mandateModerator(userId: string, row: MandateRecord | null) {
    if (!row) throw new AccessError(404, "mandate_unavailable")
    const source = await networkStore<SubmissionRecord>(
      strapi,
      SUBMISSION
    ).findOne({
      documentId: row.submissionDocumentId,
      fields: ["contentLocale"],
    })
    await moderator(userId, source?.contentLocale ?? "en")
  }
  async function mandateDto(row: MandateRecord): Promise<NetworkMandate> {
    const ids = await memberIds(strapi, row.network.documentId),
      known = row.sourceLibraryIds ?? row.approvedLibraryIds

    return {
      documentId: row.documentId,
      network: networkIdentity(row.network),
      status: row.status,
      staffRole: row.staffRole ?? "editor",
      ownerLibraryIds: row.ownerLibraryIds ?? [],
      approvedLibraryIds: row.approvedLibraryIds,
      additionsAwaitingReview: ids.filter((id) => !known.includes(id)),
      removalsAwaitingReview: row.approvedLibraryIds.filter(
        (id) => !ids.includes(id)
      ),
      version: row.version,
      teamId: row.team?.documentId ?? null,
      fulfilment: row.fulfilment,
      reviewedAt: row.reviewedAt ?? null,
    }
  }
  function requestRows(userId: string, open = false) {
    return networkStore<SubmissionRecord>(strapi, SUBMISSION).findMany({
      filters: {
        submittedByUserId: userId,
        submissionType: "network_claim",
        ...(open
          ? { status: { $in: ["pending", "needs_info", "draft"] } }
          : {}),
      },
      fields: [
        "documentId",
        "status",
        "fields",
        "reviewNote",
        "resultDocumentId",
        "createdAt",
      ],
      sort: "createdAt:desc",
      limit: open ? 5 : 30,
    })
  }
  async function mine(userId: string) {
    const [affiliations, mandates, recent, open] = await Promise.all([
      networkStore<AffiliationRecord>(strapi, AFFILIATION).findMany({
        filters: { baUserId: userId },
        populate: { network: true },
        limit: 10,
      }),
      networkStore<MandateRecord>(strapi, MANDATE).findMany({
        filters: { baUserId: userId },
        populate: { network: true, team: true },
        sort: ["status:asc", "reviewedAt:desc", "documentId:asc"],
        limit: 20,
      }),
      requestRows(userId),
      requestRows(userId, true),
    ])

    return {
      affiliations: affiliations.map(
        (row) =>
          ({
            documentId: row.documentId,
            network: networkIdentity(row.network),
            role: row.role,
            department: row.department,
            publicDisplay: row.publicDisplay,
            status: row.status,
            verifiedAt: row.verifiedAt ?? null,
          }) satisfies NetworkAffiliation
      ),
      mandates: await Promise.all(mandates.map(mandateDto)),
      requests: [
        ...new Map(
          [...open, ...recent].map((row) => [row.documentId, row])
        ).values(),
      ],
    }
  }
  async function review(userId: string, id: string) {
    const submission = await networkStore<SubmissionRecord>(
      strapi,
      SUBMISSION
    ).findOne({ documentId: id })
    if (submission?.submissionType !== "network_claim")
      throw new AccessError(404, "not_found")
    if (
      !submission.fields ||
      !Array.isArray(submission.fields.sourceLibraryIds)
    )
      throw new AccessError(410, "claim_evidence_removed")
    await moderator(userId, submission.contentLocale ?? "en")
    const ids = await memberIds(strapi, submission.targetDocumentId)

    return {
      libraryNames: Object.fromEntries(
        (
          await networkLibraries(strapi).findMany({
            filters: { documentId: { $in: submission.fields.libraryIds } },
            locale: "en",
            fields: ["name"],
            limit: 2000,
          })
        ).map((row) => [row.documentId, row.name])
      ),
      audit: await networkStore<NetworkEvent>(strapi, NETWORK_EVENT).findMany({
        filters: {
          mandate: {
            network: { documentId: submission.targetDocumentId },
            baUserId: submission.submittedByUserId,
          },
        },
        fields: ["action", "version", "reason", "createdAt"],
        sort: "createdAt:desc",
        limit: 50,
      }),
      snapshot: submission.fields,
      currentLibraryIds: ids,
      added: ids.filter(
        (value) => !submission.fields.sourceLibraryIds.includes(value)
      ),
      removed: submission.fields.sourceLibraryIds.filter(
        (value) => !ids.includes(value)
      ),
      mandates: await Promise.all(
        (
          await networkStore<MandateRecord>(strapi, MANDATE).findMany({
            filters: {
              network: { documentId: submission.targetDocumentId },
              baUserId: submission.submittedByUserId,
            },
            populate: { network: true, team: true },
            sort: ["status:asc", "reviewedAt:desc", "documentId:asc"],
            limit: 20,
          })
        ).map(mandateDto)
      ),
    }
  }

  return {
    async prepareErasure(userId: string, erasedId: string) {
      const rows = await networkStore<MandateRecord>(strapi, MANDATE).findMany({
        filters: { baUserId: userId, status: "approved" },
        limit: 21,
      })
      if (rows.length > 20)
        throw new AccessError(409, "too_many_service_mandates")
      for (const row of rows)
        await reconcileNetworkMandate(
          strapi,
          row.documentId,
          { version: row.version, revoke: true, reason: "Account deleted" },
          erasedId,
          true
        )
    },
    async target(userId: string, query: RecordInput) {
      const key = widgetText(query.key, 255, true)
      const rows = await networkLibraries(strapi).findMany({
        filters: { $or: [{ documentId: key }, { slug: key }] },
        locale: "en",
        status: "published",
        populate: { libraryType: { fields: ["name"] } },
        limit: 2,
      })
      if (rows.length !== 1) throw new AccessError(404, "not_found")
      const library = rows[0]!,
        member = await resolveStaff(strapi, userId, library.documentId)
      if (!member) throw new AccessError(404, "not_found")

      return {
        id: library.documentId,
        name: library.name,
        slug: library.slug ?? "",
        libraryType: libraryTypeName(library.libraryType),
        role: member.staffRole,
        canGoLive: member.canGoLive,
      }
    },
    catalogue: (query: RecordInput, publicOnly = true) =>
      listNetworks(strapi, query, publicOnly),
    detail: (id: string, query: RecordInput, publicOnly = true) =>
      networkDetail(strapi, id, query, publicOnly),
    async scope(id: string) {
      const network = await loadNetwork(strapi, id)

      return {
        network: networkIdentity(network),
        libraryIds: await memberIds(strapi, network.documentId),
      }
    },
    mine,
    saveAffiliation: (userId: string, id: string, input: RecordInput) =>
      saveNetworkAffiliation(strapi, userId, id, input).then(() => ({
        ok: true,
      })),
    request: (user: NetworkUser, id: string, input: RecordInput) =>
      submitNetworkClaim(strapi, user, id, input),
    review,
    async retry(userId: string, id: string) {
      const row = await networkStore<MandateRecord>(strapi, MANDATE).findOne({
        documentId: id,
      })
      if (row?.baUserId !== userId) await mandateModerator(userId, row)

      return fulfilNetworkMandate(strapi, id)
    },
    async reconcile(userId: string, id: string, input: RecordInput) {
      const row = await networkStore<MandateRecord>(strapi, MANDATE).findOne({
        documentId: id,
      })
      if (row?.baUserId !== userId || input.revoke !== true)
        await mandateModerator(userId, row)

      return reconcileNetworkMandate(strapi, id, input, `ba:${userId}`)
    },
    async revokeAffiliation(userId: string, id: string, input: RecordInput) {
      const reason = widgetText(input.reason, 500, true)
      const withdrawn = await subjectLock(
        strapi,
        `affiliation:${userId}`,
        async () => {
          const store = networkStore<AffiliationRecord>(strapi, AFFILIATION),
            row = await store.findOne({
              documentId: id,
              populate: { network: true },
            })
          if (row?.baUserId !== userId) throw new AccessError(404, "not_found")
          const at = new Date().toISOString()
          await store.update({
            documentId: id,
            data: { status: "revoked", publicDisplay: false, revokedAt: at },
          })
          const mandates = await networkStore<MandateRecord>(
            strapi,
            MANDATE
          ).findMany({
            filters: {
              baUserId: userId,
              network: { documentId: row.network.documentId },
              status: "approved",
            },
            limit: 20,
          })
          for (const mandate of mandates)
            await reconcileNetworkMandate(
              strapi,
              mandate.documentId,
              { version: mandate.version, revoke: true, reason },
              `ba:${userId}`
            )

          return { networkId: row.network.documentId, at }
        }
      )
      // The decision row is locked before affiliation application in moderation.
      // Release the affiliation lock first to preserve that ordering here too.
      const open = await networkStore<SubmissionRecord>(
        strapi,
        SUBMISSION
      ).findMany({
        filters: {
          submissionType: "network_claim",
          submittedByUserId: userId,
          targetDocumentId: withdrawn.networkId,
          status: { $in: ["pending", "needs_info"] },
        },
        limit: 5,
      })
      for (const request of open.filter(
        (row) => row.fields?.submittedAt <= withdrawn.at
      ))
        await strapi
          .plugin("content-moderation")
          .service("submission")
          .updateStatus(
            request.documentId,
            "rejected",
            { id: "system", kind: "system", email: null, baUserId: null },
            "Withdrawn by the account holder: " + reason,
            { expectedPayloadHash: request.payloadHash }
          )

      return { ok: true }
    },
    async staff(userId: string, query: RecordInput) {
      const page = Math.max(1, Number(query.page) || 1),
        networkId =
          typeof query.networkId === "string" ? query.networkId : null,
        q = widgetText(query.q ?? "", 120)
      const filters = {
        ...claimAffiliationFilter(userId),
        ...(networkId || q
          ? {
              library: {
                ...(networkId ? { networks: { documentId: networkId } } : {}),
                ...(q ? { name: { $containsi: q } } : {}),
              },
            }
          : {}),
      }
      const rows = await networkStore<{
        library: { documentId: string; name: string; slug: string }
      }>(strapi, "api::library-affiliation.library-affiliation").findMany({
        filters,
        populate: { library: { fields: ["name", "slug"] } },
        sort: "id:asc",
        start: (page - 1) * 48,
        limit: 48,
      })

      return {
        libraries: rows.flatMap((row) => (row.library ? [row.library] : [])),
        total: await networkStore(
          strapi,
          "api::library-affiliation.library-affiliation"
        ).count({ filters }),
        page,
      }
    },
    async publicAffiliations(username: string) {
      const profile = await networkStore<{ baUserId: string }>(
        strapi,
        "api::user-profile.user-profile"
      ).findFirst({
        filters: { username, profileVisibility: "public" },
        fields: ["baUserId"],
      })
      if (!profile) return { affiliations: [] }
      const userId = profile.baUserId

      const rows = await networkStore<AffiliationRecord>(
        strapi,
        AFFILIATION
      ).findMany({
        filters: {
          baUserId: userId,
          publicDisplay: true,
          status: { $in: ["declared", "verified"] },
          network: {
            publicPageEnabled: true,
            publicPageReviewedAt: { $notNull: true },
          },
        },
        populate: { network: true },
        limit: 10,
      })

      return {
        affiliations: rows.map((row) => ({
          network: networkIdentity(row.network),
          role: row.role,
          department: row.department,
          status: row.status,
        })),
      }
    },
  }
}
