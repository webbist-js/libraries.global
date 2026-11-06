import { isLibraryEntityRef } from "@repo/shared-data"

import { resolveSubmissionLocale } from "../services/submission"
import {
  API_CORRECTABLE_FIELDS,
  API_LIBRARY_FIELDS,
  API_PROPOSAL_LIMITS,
  API_SUBMITTER_EMAIL,
  API_SUBMITTER_NAME,
  API_SUBMITTER_PREFIX,
  placeSlugs,
  proposalEvidence,
  proposalFields,
  ProposalError,
  publicProposalStatus,
} from "../utils/api-proposals"
import { isDocumentId } from "../utils/params"
import { payloadHash } from "../utils/payload-hash"
import { isValidServiceSecret } from "../utils/service-secret"

/**
 * The dedicated private intake for machine API proposals (bridge secret
 * only, never a user identity). It whitelists fields, records the submitting
 * API account, key id, source licence and idempotency key, writes the first
 * review-history event and files an untrusted `pending` proposal in the
 * ordinary moderation queue. Nothing is published or rewarded here.
 */

const SUBMISSION = "plugin::content-moderation.submission"
const REVIEW_EVENT = "plugin::content-moderation.review-event"
const LIBRARY = "api::library.library"
const KEY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{8,64}$/
const PROPOSAL_ID = /^[a-z0-9]{20,32}$/
const HOUR = 3_600_000

type Body = Record<string, unknown>
const object = (v: unknown): Body => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new ProposalError(400, "invalid_proposal")

  return v as Body
}
const onlyKeys = (v: Body, keys: string[]) => {
  if (Object.keys(v).some((k) => !keys.includes(k)))
    throw new ProposalError(400, "invalid_proposal")
}

/** The response an API account may see about its own proposal. */
async function safeProposal(strapi: any, row: any) {
  let result: Record<string, unknown> | null = null
  if (row.status === "approved") {
    const target =
      row.submissionType === "new_library"
        ? row.resultDocumentId
        : row.targetDocumentId
    if (isDocumentId(target)) {
      const [library] = await strapi.documents(LIBRARY).findMany({
        status: "published",
        locale: row.contentLocale ?? "en",
        filters: { documentId: { $eq: target } },
        fields: ["entityRef"],
        limit: 1,
      })
      // Only a published record is revealed; a draft stays private.
      result = library?.entityRef ? { entityRef: library.entityRef } : null
    }
  }

  return {
    id: row.documentId,
    kind: row.submissionType === "new_library" ? "library" : "correction",
    status: publicProposalStatus(row.status),
    locale: row.contentLocale ?? "en",
    createdAt: row.createdAt ?? null,
    decidedAt:
      row.status === "approved" || row.status === "rejected"
        ? (row.reviewedAt ?? null)
        : null,
    result,
  }
}

async function place(strapi: any, slugs: ReturnType<typeof placeSlugs>) {
  const find = async (uid: string, filters: Body, populate?: Body) => {
    const [row] = await strapi.documents(uid).findMany({
      status: "published",
      locale: "en",
      filters,
      fields: ["documentId"],
      ...(populate ? { populate } : {}),
      limit: 1,
    })
    if (!row) throw new ProposalError(400, "unknown_place")

    return row
  }
  const country = await find(
    "api::country.country",
    { slug: { $eq: slugs.country } },
    { continent: { fields: ["documentId"] } }
  )
  const region = slugs.region
    ? await find("api::region.region", {
        slug: { $eq: slugs.region },
        country: { documentId: { $eq: country.documentId } },
      })
    : null
  const area =
    slugs.area && region
      ? await find("api::area.area", {
          slug: { $eq: slugs.area },
          region: { documentId: { $eq: region.documentId } },
        })
      : null

  return {
    ...(country.continent?.documentId
      ? { continentDocumentId: country.continent.documentId }
      : {}),
    countryDocumentId: country.documentId,
    ...(region ? { regionDocumentId: region.documentId } : {}),
    ...(area ? { areaDocumentId: area.documentId } : {}),
  }
}

async function libraryProposal(strapi: any, proposal: Body, locale: string) {
  onlyKeys(proposal, ["library", "place"])
  const fields = proposalFields(proposal.library, API_LIBRARY_FIELDS, {
    max: 18,
  })
  if (typeof fields.name !== "string")
    throw new ProposalError(400, "invalid_field_value", { field: "name" })
  if (fields.libraryType !== undefined) {
    const [type] = await strapi
      .documents("api::library-type.library-type")
      .findMany({
        status: "published",
        locale: "en",
        filters: { name: { $eq: fields.libraryType } },
        fields: ["name"],
        limit: 1,
      })
    if (!type)
      throw new ProposalError(400, "invalid_field_value", {
        field: "libraryType",
      })
  }
  const hierarchy = await place(strapi, placeSlugs(proposal.place))
  // A published library with this name in the same country (and city) is
  // public information: point the client at it instead of filing a copy.
  const existing = await strapi.documents(LIBRARY).findMany({
    status: "published",
    locale,
    filters: {
      name: { $eqi: fields.name },
      country: { documentId: { $eq: hierarchy.countryDocumentId } },
      ...(typeof fields.city === "string"
        ? { city: { $eqi: fields.city } }
        : {}),
    },
    fields: ["entityRef"],
    limit: 3,
  })
  if (existing.length)
    throw new ProposalError(409, "possible_duplicate", {
      existing: existing.map((row: any) => row.entityRef).filter(Boolean),
    })

  return {
    submissionType: "new_library",
    targetEntityType: "library",
    fields: { ...fields, ...hierarchy },
  }
}

async function correctionProposal(strapi: any, proposal: Body, locale: string) {
  onlyKeys(proposal, ["target", "changes"])
  if (!isLibraryEntityRef(proposal.target))
    throw new ProposalError(404, "not_found")
  const changes = proposalFields(proposal.changes, API_CORRECTABLE_FIELDS, {
    max: 10,
  })
  const fieldNames = Object.keys(changes).filter(
    (k) => k !== "lat" && k !== "lng"
  )
  const [library] = await strapi.documents(LIBRARY).findMany({
    status: "published",
    locale,
    filters: { entityRef: { $eq: proposal.target } },
    fields: ["slug", "name", ...fieldNames, "location"],
    limit: 1,
  })
  if (!library) throw new ProposalError(404, "not_found")
  // The live values at proposal time, so a moderator can see a conflict
  // with a later edit before applying.
  const previous: Body = {}
  for (const field of fieldNames) previous[field] = library[field] ?? null
  if ("lat" in changes) {
    previous.lat = library.location?.lat ?? null
    previous.lng = library.location?.lng ?? null
  }
  if (Object.entries(changes).every(([k, v]) => previous[k] === v))
    throw new ProposalError(409, "no_change")

  return {
    submissionType: "correction",
    targetEntityType: "library",
    targetDocumentId: library.documentId,
    targetSlug: library.slug,
    fields: {
      kind: "record",
      libraryName: library.name,
      ...changes,
      previous,
    },
  }
}

export default ({ strapi }: { strapi: any }) => {
  const wrap = (work: (ctx: any) => Promise<unknown>) => async (ctx: any) => {
    if (!isValidServiceSecret(ctx.request.header["x-service-secret"]))
      return ctx.unauthorized("Invalid service secret")
    ctx.set("Cache-Control", "no-store")
    try {
      ctx.body = await work(ctx)
    } catch (error) {
      if (!(error instanceof ProposalError)) throw error
      ctx.status = error.status
      ctx.body = { error: { code: error.code, ...error.detail } }
    }
  }
  const submissions = () => strapi.documents(SUBMISSION)

  return {
    /** POST /api/proposals: file one untrusted API proposal. */
    create: wrap(async (ctx) => {
      const body = object(ctx.request.body)
      onlyKeys(body, [
        "account",
        "keyId",
        "idempotencyKey",
        "kind",
        "locale",
        "proposal",
        "evidence",
        "note",
      ])
      const { account, keyId, idempotencyKey, kind } = body
      if (
        !isDocumentId(account) ||
        typeof keyId !== "string" ||
        !KEY_ID.test(keyId) ||
        typeof idempotencyKey !== "string" ||
        !IDEMPOTENCY_KEY.test(idempotencyKey) ||
        (kind !== "library" && kind !== "correction") ||
        (body.note !== undefined &&
          (typeof body.note !== "string" || body.note.length > 1000))
      )
        throw new ProposalError(400, "invalid_proposal")
      const evidence = proposalEvidence(body.evidence)
      const proposal = object(body.proposal)
      const locale = await resolveSubmissionLocale(strapi, body.locale, {
        submissionType: kind === "library" ? "new_library" : "correction",
      })
      if (typeof body.locale === "string" && body.locale !== locale)
        throw new ProposalError(400, "locale_unavailable")
      const built =
        kind === "library"
          ? await libraryProposal(strapi, proposal, locale)
          : await correctionProposal(strapi, proposal, locale)
      const hash = payloadHash({ ...built, contentLocale: locale })

      // A replayed request returns the original proposal without filing
      // another; the same key with a different payload is a conflict.
      const [replay] = await submissions().findMany({
        filters: {
          apiAccountId: { $eq: account },
          idempotencyKey: { $eq: idempotencyKey },
        },
        limit: 1,
      })
      if (replay) {
        if (replay.payloadHash !== hash)
          throw new ProposalError(409, "idempotency_conflict")
        ctx.status = 200

        return { data: await safeProposal(strapi, replay), replayed: true }
      }
      const now = Date.now()
      const [byKey, byAccount] = await Promise.all([
        submissions().count({
          filters: {
            apiKeyId: { $eq: keyId },
            createdAt: { $gte: new Date(now - HOUR).toISOString() },
          },
        }),
        submissions().count({
          filters: {
            apiAccountId: { $eq: account },
            createdAt: { $gte: new Date(now - 24 * HOUR).toISOString() },
          },
        }),
      ])
      if (
        byKey >= API_PROPOSAL_LIMITS.perKeyHour ||
        byAccount >= API_PROPOSAL_LIMITS.perAccountDay
      )
        throw new ProposalError(429, "proposal_rate_limit")
      // The same payload, still open, from this account is a duplicate.
      // Other accounts' proposals are never consulted or revealed.
      const [duplicate] = await submissions().findMany({
        filters: {
          apiAccountId: { $eq: account },
          payloadHash: { $eq: hash },
          status: { $in: ["pending", "needs_info"] },
        },
        fields: ["documentId"],
        limit: 1,
      })
      if (duplicate)
        throw new ProposalError(409, "duplicate_proposal", {
          proposalId: duplicate.documentId,
        })
      const safe = await strapi
        .plugin("content-moderation")
        .service("submission-policy")
        .checkContent(
          {
            fields: built.fields,
            note: body.note,
            evidenceUrl: evidence.url,
          },
          {
            targetDocumentId: (built as Body).targetDocumentId,
            targetSlug: (built as Body).targetSlug,
          }
        )
      if (!safe.ok) throw new ProposalError(400, "unsafe_content")

      let created: any
      try {
        created = await strapi
          .plugin("content-moderation")
          .service("submission")
          .create({
            ...built,
            locale,
            note: [
              `Untrusted API proposal. Source: ${evidence.sourceName} (${evidence.licence}).`,
              evidence.attribution
                ? `Attribution: ${evidence.attribution}.`
                : "",
              typeof body.note === "string" ? body.note : "",
            ]
              .filter(Boolean)
              .join("\n"),
            evidenceType: evidence.type,
            evidenceUrl: evidence.url,
            submittedByUserId: `${API_SUBMITTER_PREFIX}${account}`,
            submittedByEmail: API_SUBMITTER_EMAIL,
            submittedByName: API_SUBMITTER_NAME,
            apiAccountId: account,
            apiKeyId: keyId,
            idempotencyKey,
            sourceLicence: evidence.licence,
            sourceAttribution: evidence.attribution ?? evidence.sourceName,
          })
      } catch (error) {
        // A concurrent replay won the unique (account, idempotency key) index.
        const [winner] = await submissions().findMany({
          filters: {
            apiAccountId: { $eq: account },
            idempotencyKey: { $eq: idempotencyKey },
          },
          limit: 1,
        })
        if (!winner) throw error
        if (winner.payloadHash !== hash)
          throw new ProposalError(409, "idempotency_conflict")
        ctx.status = 200

        return { data: await safeProposal(strapi, winner), replayed: true }
      }
      await strapi.documents(REVIEW_EVENT).create({
        data: {
          submissionDocumentId: created.documentId,
          toStatus: "pending",
          reviewerId: `${API_SUBMITTER_PREFIX}${account}`,
          reviewerKind: "system",
          note: `API proposal received (key ${keyId}).`,
        },
      })
      ctx.status = 201

      return {
        data: await safeProposal(strapi, {
          ...created,
          status: "pending",
          contentLocale: locale,
        }),
        replayed: false,
      }
    }),
    /** GET /api/proposals/:id?account=: safe status for the owner only. */
    status: wrap(async (ctx) => {
      const account = ctx.query?.account
      const id = ctx.params?.id
      // Unknown, foreign and malformed ids all get the same answer.
      if (
        !isDocumentId(account) ||
        typeof id !== "string" ||
        !PROPOSAL_ID.test(id)
      )
        throw new ProposalError(404, "not_found")
      const [row] = await submissions().findMany({
        filters: { documentId: { $eq: id }, apiAccountId: { $eq: account } },
        limit: 1,
      })
      if (!row) throw new ProposalError(404, "not_found")

      return { data: await safeProposal(strapi, row) }
    }),
  }
}
