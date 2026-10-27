import {
  NETWORK_LIMITS,
  widgetText,
  type NetworkFulfilment,
} from "@repo/shared-data"

import { subjectLock } from "./network-claims"
import { recordNetworkEvent } from "./network-events"
import { MANDATE, networkStore, type MandateRecord } from "./network-records"
import {
  issueAuthorityGrant,
  revokeAuthoritySource,
} from "../../../../utils/authority-grants"
import type {
  RecordInput,
  DocumentRuntime,
} from "../../../../utils/document-store"
import { withGroupedStaffChanges } from "../../../../utils/staff-notification-scope"
import { AccessError } from "../utils/admin"

const populate = { network: true, team: true }
const progress = (row: MandateRecord): NetworkFulfilment => ({
  pending: [],
  applied: [],
  failures: {},
  complete: true,
  ...row.fulfilment,
})
async function removeGrants(
  strapi: DocumentRuntime,
  mandateId: string,
  libraryId: string
) {
  const rows = await networkStore<{ baUserId: string }>(
    strapi,
    "plugin::access.library-authority-grant"
  ).findMany({
    filters: {
      mandateDocumentId: mandateId,
      library: { documentId: libraryId },
      status: "active",
    },
    fields: ["baUserId"],
    limit: 501,
  })
  if (rows.length > 500)
    throw new Error("Mandate has too many derived grants for one library")
  for (const userId of new Set(rows.map((row) => row.baUserId)))
    await revokeAuthoritySource(strapi, {
      baUserId: userId,
      libraryDocumentId: libraryId,
      mandateDocumentId: mandateId,
    })
}
async function mandateLock<T>(
  strapi: DocumentRuntime,
  id: string,
  work: () => Promise<T>
) {
  const row = await networkStore<MandateRecord>(strapi, MANDATE).findOne({
    documentId: id,
    populate,
  })
  if (!row) throw new AccessError(404, "mandate_unavailable")

  return subjectLock(strapi, `mandate:${row.network.documentId}`, () =>
    subjectLock(strapi, `fulfilment:${id}`, work)
  )
}
async function applyOne(strapi: DocumentRuntime, id: string) {
  return mandateLock(strapi, id, async () => {
    const store = networkStore<MandateRecord>(strapi, MANDATE),
      row = await store.findOne({ documentId: id, populate })
    if (!row) return false
    const state = progress(row),
      removing = state.revocations?.[0],
      libraryId = removing ?? state.pending[0]
    if (!libraryId) return false
    if (removing) await removeGrants(strapi, id, libraryId)
    else if (
      row.status === "approved" &&
      row.approvedLibraryIds.includes(libraryId)
    )
      await issueAuthorityGrant(strapi, {
        baUserId: row.baUserId,
        libraryDocumentId: libraryId,
        sourceKind: "network",
        sourceDocumentId: id,
        mandateDocumentId: id,
        staffRole: row.ownerLibraryIds?.includes(libraryId)
          ? "owner"
          : "editor",
        verificationMethod: "network",
        issuedBy: "approved-service-mandate",
      })
    state.pending = state.pending.filter((value) => value !== libraryId)
    state.revocations = (state.revocations ?? []).filter(
      (value) => value !== libraryId
    )
    if (!removing && !state.applied.includes(libraryId))
      state.applied.push(libraryId)
    delete state.failures[libraryId]
    state.complete = !state.pending.length && !state.revocations.length
    await store.update({
      documentId: id,
      data: {
        fulfilment: state,
        nextAttemptAt: state.complete ? null : new Date().toISOString(),
        lastReconciledAt: new Date().toISOString(),
      },
    })

    return true
  })
}

export async function fulfilNetworkMandate(
  strapi: DocumentRuntime,
  id: string
) {
  let applied = 0
  await withGroupedStaffChanges(async () => {
    for (let i = 0; i < NETWORK_LIMITS.batch; i++) {
      try {
        if (!(await applyOne(strapi, id))) break
        applied++
      } catch {
        await mandateLock(strapi, id, async () => {
          const store = networkStore<MandateRecord>(strapi, MANDATE),
            row = await store.findOne({ documentId: id, populate })
          if (!row) return
          const state = progress(row),
            key = state.revocations?.[0] ?? state.pending[0]
          if (key)
            state.failures[key] = {
              attempts: (state.failures[key]?.attempts ?? 0) + 1,
              message:
                "The access update could not be applied. Retry or ask an administrator to inspect the case.",
            }
          await store.update({
            documentId: id,
            data: {
              fulfilment: state,
              nextAttemptAt: new Date(Date.now() + 300000).toISOString(),
            },
          })
        })
        break
      }
    }
  })

  return { applied }
}
export async function reconcileNetworkMandate(
  strapi: DocumentRuntime,
  id: string,
  input: RecordInput,
  reviewerId: string,
  defer = false
) {
  const result = await mandateLock(strapi, id, async () => {
    const store = networkStore<MandateRecord>(strapi, MANDATE),
      row = await store.findOne({ documentId: id, populate })
    if (!row) throw new AccessError(404, "mandate_unavailable")
    if (input.version !== row.version)
      throw new AccessError(409, "version_conflict")
    const reason = widgetText(input.reason, 500, true),
      revoke = input.revoke === true
    const ids = revoke
      ? row.approvedLibraryIds
      : Array.isArray(input.libraryIds)
        ? input.libraryIds.map((value) => widgetText(value, 32, true))
        : []
    if (ids.some((value) => !row.approvedLibraryIds.includes(value)))
      throw new RangeError("Reconciliation can only remove approved libraries")
    const state = progress(row)
    state.pending = state.pending.filter((value) => !ids.includes(value))
    state.revocations = [...new Set([...(state.revocations ?? []), ...ids])]
    state.complete = !state.pending.length && !state.revocations.length
    const updated = await store.update({
      documentId: id,
      data: {
        status: revoke ? "revoked" : row.status,
        ownerLibraryIds: (row.ownerLibraryIds ?? []).filter(
          (value) => !ids.includes(value)
        ),
        approvedLibraryIds: row.approvedLibraryIds.filter(
          (value) => !ids.includes(value)
        ),
        fulfilment: state,
        version: row.version + 1,
        revokedAt: revoke ? new Date().toISOString() : null,
        revocationReason: reason,
        reviewedBy: reviewerId,
        nextAttemptAt: new Date().toISOString(),
      },
    })

    await recordNetworkEvent(strapi, id, {
      actor: reviewerId,
      action: revoke ? "revoked" : "reconciled",
      version: row.version + 1,
      libraryIds: ids,
      reason,
    })

    return updated.documentId
  })
  if (!defer) await fulfilNetworkMandate(strapi, result)

  return { ok: true }
}
export async function runNetworkFulfilment(strapi: DocumentRuntime) {
  const rows = await networkStore<MandateRecord>(strapi, MANDATE).findMany({
    filters: { nextAttemptAt: { $lte: new Date().toISOString() } },
    sort: "nextAttemptAt:asc",
    limit: 1,
  })
  let applied = 0
  for (const row of rows)
    applied += (await fulfilNetworkMandate(strapi, row.documentId)).applied

  return { mandates: rows.length, applied }
}
export async function approvedTeamMandate(
  strapi: DocumentRuntime,
  teamId: string,
  libraryId: string
) {
  const rows = await networkStore<MandateRecord>(strapi, MANDATE).findMany({
    filters: { team: { documentId: teamId }, status: "approved" },
    limit: 11,
  })
  if (rows.length > 10) throw new AccessError(409, "too_many_service_mandates")

  return (
    rows.find(
      (row) =>
        row.ownerLibraryIds?.includes(libraryId) &&
        row.approvedLibraryIds.includes(libraryId)
    ) ?? null
  )
}

/** Individual removal also cancels an approved service batch's pending grant. */
export async function removeServiceScopes(
  strapi: DocumentRuntime,
  userId: string,
  libraryId: string,
  actor: string
) {
  const rows = await networkStore<MandateRecord>(strapi, MANDATE).findMany({
    filters: { baUserId: userId, status: "approved" },
    limit: 21,
  })
  if (rows.length > 20) throw new AccessError(409, "too_many_service_mandates")
  for (const row of rows.filter((value) =>
    value.approvedLibraryIds.includes(libraryId)
  ))
    await reconcileNetworkMandate(
      strapi,
      row.documentId,
      {
        version: row.version,
        libraryIds: [libraryId],
        reason: "Library staff access removed individually",
      },
      actor
    )
}
