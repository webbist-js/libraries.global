import {
  DECLINE_REASONS,
  DECLINE_REASON_LABELS,
  findUnsafeContent,
  isModeratedLibraryChange,
  LOCALIZED_LIBRARY_FIELDS,
  normalizeMobileTimetable,
  timetableHash,
  type VerifySection,
} from "@repo/shared-data"

import { isActivityPublic } from "../../../../utils/activity-visibility"
import { runWithChangeContext } from "../../../../utils/change-context"
import { requireStaffMember } from "../../../../utils/staff"
import {
  applyLibraryRecord,
  buildLibraryRecordData,
  changedFields,
  RECORD_FIELD_KEYS,
} from "../utils/library-record"
import { applyVerification, verifySections } from "../utils/library-verify"
import { defaultLocale, knownLocale } from "../utils/locales"
import { canonical } from "../utils/publish-guard"
import {
  preloadRecordReviews,
  recordReview,
  RECORD_META_KEYS,
} from "../utils/record-review"
import { staffReviewer } from "../utils/reviewer"
import { canTransition } from "../utils/transitions"
import { ownedUploadIds } from "../utils/uploads"

const LIBRARY = "api::library.library"
const SUBMISSION = "plugin::content-moderation.submission"

export type StaffViewer = { id: string; email: string; name: string | null }
export class StaffSubmissionError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message = code,
    readonly detail: Record<string, unknown> = {}
  ) {
    super(message)
  }
}
const object = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}
const plain = (v: unknown): string =>
  Array.isArray(v)
    ? v
        .map((n: any) =>
          (n.children ?? []).map((c: any) => c.text ?? "").join("")
        )
        .filter(Boolean)
        .join("\n\n")
    : typeof v === "string"
      ? v
      : ""
const human = (value: unknown, names: Record<string, string> = {}): string => {
  if (value === null || value === undefined || value === "")
    return "Not recorded"
  if (typeof value === "string") return names[value] ?? value
  if (Array.isArray(value))
    return (
      value
        .map((x: any) =>
          typeof x === "object"
            ? (x?.name ?? x?.documentId ?? plain(x))
            : (names[x] ?? String(x))
        )
        .join(", ") || "None"
    )
  if (typeof value === "object") return JSON.stringify(value)

  return String(value)
}
const label = (field: string) =>
  field
    .replace(/DocumentId$/, "")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase())

export default ({ strapi }: { strapi: any }) => {
  const submissions = () =>
    strapi.plugin("content-moderation").service("submission")
  async function authorise(
    user: StaffViewer,
    id: string,
    action: "edit" | "reviewSuggestions"
  ) {
    if (!(await requireStaffMember(strapi, user.id, id, action)))
      throw new StaffSubmissionError(404, "not_found", "Library not found.")
  }
  async function lock(trx: any, id: string) {
    if (typeof trx?.raw === "function")
      await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
        `staff-library:${id}`,
      ])
  }
  async function live(id: string, locale: string) {
    return strapi.documents(LIBRARY).findOne({
      documentId: id,
      locale,
      status: "published",
      populate: {
        services: true,
        amenities: true,
        accessibility: true,
        continent: true,
        country: true,
        region: true,
        area: true,
        homeLibrary: true,
        socialLinks: true,
        heroImage: true,
        gallery: true,
      },
    })
  }
  async function staleFields(
    id: string,
    locale: string,
    fields: Record<string, unknown>,
    previous: Record<string, unknown>,
    row: any
  ) {
    const conflict: string[] = []
    for (const key of Object.keys(fields)) {
      if (!(key in previous))
        throw new StaffSubmissionError(
          400,
          "previous_required",
          `The previous value of ${label(key)} is required.`
        )
      if (key === "uploadedImages") continue // Uploads append; they do not overwrite an existing photograph.
      let current = row[key]
      if (key === "mobileTimetable") {
        if (
          typeof previous[key] !== "string" ||
          previous[key] !==
            timetableHash(normalizeMobileTimetable(row.mobileTimetable))
        )
          conflict.push(key)
        continue
      }
      if (key === "lat" || key === "lng")
        current = row.location?.[key] == null ? "" : String(row.location[key])
      else if (key.endsWith("DocumentId"))
        current = row[key.slice(0, -10)]?.documentId ?? ""
      else if (key === "homeLibrary")
        current = row.homeLibrary?.documentId ?? ""
      else if (["services", "amenities", "accessibility"].includes(key))
        current = (row[key] ?? []).map((r: any) => r.documentId).sort()
      else if (key === "absentFacilities")
        current = [...(Array.isArray(row[key]) ? row[key] : [])].sort()
      else if (["accessibilityNotes", "visitNotes"].includes(key))
        current = plain(current)
      else if (key === "socialLinks")
        current = (current ?? []).map(({ platform, url, label }: any) => ({
          platform,
          url,
          label: label ?? "",
        }))
      if (key === "openingTimes") {
        const built = buildLibraryRecordData({ openingTimes: previous[key] })
        if (
          changedFields(built, row).length ||
          (!built.openingTimes && row.openingTimes)
        )
          conflict.push(key)
      } else {
        const before =
          Array.isArray(previous[key]) &&
          [
            "services",
            "amenities",
            "accessibility",
            "absentFacilities",
          ].includes(key)
            ? [...(previous[key] as string[])].sort()
            : previous[key]
        const normalize = (v: unknown) =>
          typeof v === "string" ? v.trim() : (v ?? "")
        if (canonical(normalize(before)) !== canonical(normalize(current)))
          conflict.push(key)
      }
    }
    const latest = await Promise.all(
      conflict.map(async (field) => {
        const [change] = await strapi
          .documents("api::library-change.library-change")
          .findMany({
            filters: {
              libraryDocumentId: id,
              field: field === "lat" || field === "lng" ? "location" : field,
            },
            sort: "changedAt:desc",
            limit: 1,
          })

        return {
          field,
          changedAt:
            change?.changedAt ?? row.updatedAt ?? new Date().toISOString(),
          byName: change?.actorName ?? null,
        }
      })
    )
    if (latest.length)
      throw new StaffSubmissionError(
        409,
        "stale",
        "This record changed while you were editing.",
        { fields: latest }
      )
  }

  return {
    async publish(
      user: StaffViewer,
      libraryDocumentId: string,
      input: unknown
    ) {
      await authorise(user, libraryDocumentId, "edit")
      const body = object(input),
        fields = object(body.fields),
        previous = object(body.previous)
      const keys = Object.keys(fields)
      if (
        !keys.length ||
        keys.length > 100 ||
        keys.some((k) => !RECORD_FIELD_KEYS.has(k))
      )
        throw new StaffSubmissionError(
          400,
          "invalid_fields",
          "Choose supported record fields to publish."
        )
      const unsafe = findUnsafeContent({ fields, note: body.note })
      if (unsafe)
        throw new StaffSubmissionError(400, "unsafe_content", unsafe.message)
      if (
        body.note !== undefined &&
        (typeof body.note !== "string" || body.note.length > 2000)
      )
        throw new StaffSubmissionError(400, "invalid_note")
      const base = await defaultLocale(strapi),
        locale =
          body.locale === undefined
            ? base
            : await knownLocale(strapi, body.locale)
      if (!locale) throw new StaffSubmissionError(400, "invalid_locale")
      if (
        locale !== base &&
        keys.some((k) => !LOCALIZED_LIBRARY_FIELDS.includes(k))
      )
        throw new StaffSubmissionError(
          400,
          "shared_field",
          "Shared record fields are edited in the default language."
        )
      let pending: any = null
      const result = await strapi.db.transaction(async ({ trx }: any) => {
        await lock(trx, libraryDocumentId)
        await authorise(user, libraryDocumentId, "edit")
        const row =
          (await live(libraryDocumentId, locale)) ??
          (locale !== base ? await live(libraryDocumentId, base) : null)
        if (!row) throw new StaffSubmissionError(404, "not_found")
        await staleFields(libraryDocumentId, locale, fields, previous, row)
        const instant = Object.fromEntries(
          Object.entries(fields).filter(
            ([k, v]) => !isModeratedLibraryChange(k, v)
          )
        )
        const moderated = Object.fromEntries(
          Object.entries(fields).filter(([k, v]) =>
            isModeratedLibraryChange(k, v)
          )
        )
        let draft: any
        if (body.draftDocumentId) {
          draft = await strapi
            .documents(SUBMISSION)
            .findOne({ documentId: body.draftDocumentId })
          if (
            !draft ||
            draft.status !== "draft" ||
            draft.submittedByUserId !== user.id ||
            draft.submissionType !== "library_edit" ||
            draft.targetDocumentId !== libraryDocumentId
          )
            throw new StaffSubmissionError(404, "draft_not_found")
        } else
          draft = await submissions().create({
            submissionType: "library_edit",
            targetEntityType: "library",
            targetDocumentId: libraryDocumentId,
            targetSlug: row.slug,
            submittedByUserId: user.id,
            submittedByEmail: user.email,
            submittedByName: user.name ?? undefined,
            asDraft: true,
            locale,
            notify: false,
          })
        if (!canTransition("draft", "approved", { staffPublish: true }))
          throw new Error("staff transition unavailable")
        const at = new Date().toISOString()
        const staffSubmission = {
          ...draft,
          fields: {
            kind: "record",
            ...instant,
            ...("mobileTimetable" in instant
              ? { previousHash: previous.mobileTimetable }
              : {}),
          },
          contentLocale: locale,
          draftData: { staffPublish: true },
          editSummary: body.note ?? "Published by library staff",
        }
        if (Object.keys(instant).length) {
          const uploadIds = (
            Array.isArray(instant.uploadedImages) ? instant.uploadedImages : []
          )
            .map((p: any) => Number(p.strapiId))
            .filter((id: unknown) => Number.isInteger(id))
          const owned = await ownedUploadIds(strapi, user.id, uploadIds)
          if (uploadIds.some((id: number) => !owned.has(id)))
            throw new StaffSubmissionError(400, "upload_not_owned")
          const built = buildLibraryRecordData(instant, {
            ownedUploadIds: owned,
          })
          if (!Object.keys(built).length)
            throw new StaffSubmissionError(400, "invalid_fields")
          await runWithChangeContext(
            {
              source: "staff",
              actorKind: "contributor",
              actorId: `ba:${user.id}`,
              actorName: user.name,
              reviewerId: `ba:${user.id}`,
              submissionDocumentId: draft.documentId,
              editSummary: String(staffSubmission.editSummary),
            },
            async () => {
              const outcome = await applyLibraryRecord(
                strapi,
                staffSubmission,
                owned
              )
              if (outcome === "applied_draft")
                throw new StaffSubmissionError(
                  409,
                  "unpublished_admin_edits",
                  "An editor has unpublished changes on this record. Ask them to publish or discard those changes, then try again."
                )
              if (outcome === "noop")
                throw new StaffSubmissionError(400, "invalid_fields")
            }
          )
        }
        const { count } = await strapi.db.query(SUBMISSION).updateMany({
          where: {
            documentId: draft.documentId,
            status: "draft",
            submittedByUserId: user.id,
          },
          data: {
            fields: staffSubmission.fields,
            draftData: staffSubmission.draftData,
            contentLocale: locale,
            status: "approved",
            reviewedByUserId: `ba:${user.id}`,
            reviewedAt: at,
            reviewNote: "Published by library staff",
            editSummary: staffSubmission.editSummary,
          },
        })
        if (count !== 1) throw new StaffSubmissionError(409, "conflict")
        await strapi
          .documents("plugin::content-moderation.review-event")
          .create({
            data: {
              submissionDocumentId: draft.documentId,
              fromStatus: "draft",
              toStatus: "approved",
              reviewerId: `ba:${user.id}`,
              reviewerKind: "staff",
              note: "Published by library staff",
            },
          })
        if (Object.keys(moderated).length)
          pending = await submissions().create({
            submissionType: "library_edit",
            targetEntityType: "library",
            targetDocumentId: libraryDocumentId,
            targetSlug: row.slug,
            fields: {
              kind: "record",
              ...moderated,
              previous: Object.fromEntries(
                Object.keys(moderated).map((k) => [k, previous[k]])
              ),
            },
            requestedByStaff: true,
            submittedByUserId: user.id,
            submittedByEmail: user.email,
            submittedByName: user.name ?? undefined,
            locale,
            note: typeof body.note === "string" ? body.note : undefined,
            notify: false,
          })

        return {
          published: Object.keys(instant),
          requested: Object.keys(moderated),
          submissionDocumentId: draft.documentId,
          requestDocumentId: pending?.documentId ?? null,
        }
      })
      if (pending) submissions().notifyPending(pending)

      return result
    },
    async verify(
      user: StaffViewer,
      id: string,
      input: unknown
    ): Promise<{ stamped: VerifySection[] }> {
      await authorise(user, id, "edit")
      const sections = verifySections(object(input))
      if (!sections.length)
        throw new StaffSubmissionError(400, "invalid_sections")
      await strapi.db.transaction(async ({ trx }: any) => {
        await lock(trx, id)
        await authorise(user, id, "edit")
        const row = await live(id, await defaultLocale(strapi))
        if (!row) throw new StaffSubmissionError(404, "not_found")
        const s = await submissions().create({
          submissionType: "library_edit",
          targetEntityType: "library",
          targetDocumentId: id,
          targetSlug: row.slug,
          fields: { kind: "verify", sections },
          draftData: { staffPublish: true },
          submittedByUserId: user.id,
          submittedByEmail: user.email,
          submittedByName: user.name ?? undefined,
          asDraft: true,
          notify: false,
        })
        await runWithChangeContext(
          {
            source: "staff",
            actorKind: "contributor",
            actorId: `ba:${user.id}`,
            actorName: user.name,
            submissionDocumentId: s.documentId,
          },
          async () => {
            if ((await applyVerification(strapi, s)) !== "applied")
              throw new StaffSubmissionError(409, "unpublished_admin_edits")
          }
        )
        await strapi.documents(SUBMISSION).update({
          documentId: s.documentId,
          data: {
            status: "approved",
            reviewedByUserId: `ba:${user.id}`,
            reviewedAt: new Date(),
            reviewNote: "Confirmed by library staff",
          },
        })
        await strapi
          .documents("plugin::content-moderation.review-event")
          .create({
            data: {
              submissionDocumentId: s.documentId,
              fromStatus: "draft",
              toStatus: "approved",
              reviewerId: `ba:${user.id}`,
              reviewerKind: "staff",
              note: "Confirmed by library staff",
            },
          })
      })

      return { stamped: sections }
    },
    async suggestions(user: StaffViewer, id: string, page = 1, pageSize = 20) {
      await authorise(user, id, "reviewSuggestions")
      const row = await live(id, await defaultLocale(strapi))
      if (!row) throw new StaffSubmissionError(404, "not_found")
      const filters = {
        submissionType: "correction",
        status: "pending",
        submittedByUserId: { $ne: user.id },
        $or: [
          { targetDocumentId: id },
          { targetDocumentId: { $null: true }, targetSlug: row.slug },
        ],
      }
      const [rows, total] = await Promise.all([
        strapi.documents(SUBMISSION).findMany({
          filters,
          sort: "createdAt:desc",
          start: (page - 1) * pageSize,
          limit: pageSize,
        }),
        strapi.documents(SUBMISSION).count({ filters }),
      ])
      const reviews = await preloadRecordReviews(strapi, rows)
      const submitterIds = [
        ...new Set(
          rows
            .map((s: any) => s.submittedByUserId)
            .filter((v: unknown): v is string => typeof v === "string")
        ),
      ]
      // An empty page has nobody to look up: `limit: 0` is refused by Strapi.
      const profiles = submitterIds.length
        ? await strapi.documents("api::user-profile.user-profile").findMany({
            filters: { baUserId: { $in: submitterIds } },
            fields: [
              "baUserId",
              "username",
              "profileVisibility",
              "publicPrefs",
            ],
            limit: submitterIds.length,
          })
        : []
      const data = await Promise.all(
        rows.map(async (s: any) => {
          const f = object(s.fields),
            kind = ["record", "facilities", "photo", "verify"].includes(
              String(f.kind)
            )
              ? String(f.kind)
              : "freetext"
          const review = await recordReview(strapi, s, reviews)
          const profile = profiles.find(
            (p: any) => p.baUserId === s.submittedByUserId
          )
          const before = normalizeMobileTimetable(
              review?.current.mobileTimetable ?? row.mobileTimetable
            ),
            after = normalizeMobileTimetable(f.mobileTimetable)
          const timetable =
            "mobileTimetable" in f
              ? {
                  before,
                  after,
                  stale: f.previousHash !== timetableHash(before),
                }
              : null

          return {
            documentId: s.documentId,
            kind,
            rows: Object.entries(f)
              .filter(([key]) => !RECORD_META_KEYS.has(key))
              .map(([field, value]) => ({
                field,
                label: label(field),
                now: human(review?.current[field] ?? row[field], review?.names),
                suggested: human(value, review?.names),
              })),
            evidence: s.evidenceUrl ?? s.note ?? null,
            byName:
              profile && isActivityPublic(profile)
                ? (profile.username ?? null)
                : null,
            createdAt: s.createdAt,
            ...(timetable ? { timetable } : {}),
            actions: timetable?.stale
              ? ["reject"]
              : [kind === "freetext" ? "done" : "approve", "reject"],
          }
        })
      )

      return { data, meta: { page, pageSize, total } }
    },
    async decision(user: StaffViewer, id: string, input: unknown) {
      const s = await strapi.documents(SUBMISSION).findOne({ documentId: id })
      if (
        !s ||
        s.submissionType !== "correction" ||
        s.targetEntityType !== "library"
      )
        throw new StaffSubmissionError(404, "not_found")
      let libraryId = s.targetDocumentId
      if (!libraryId && s.targetSlug) {
        const [row] = await strapi.documents(LIBRARY).findMany({
          filters: { slug: s.targetSlug },
          status: "published",
          limit: 1,
        })
        libraryId = row?.documentId
      }
      if (!libraryId) throw new StaffSubmissionError(404, "not_found")
      await authorise(user, libraryId, "reviewSuggestions")
      if (s.submittedByUserId === user.id)
        throw new StaffSubmissionError(
          403,
          "self_review",
          "You cannot review your own suggestion."
        )
      const body = object(input),
        kind = object(s.fields).kind,
        free = !["record", "facilities", "photo", "verify"].includes(
          String(kind)
        )
      if (
        !["approve", "done", "reject"].includes(String(body.action)) ||
        (body.action === "done" && !free) ||
        (body.action === "approve" && free)
      )
        throw new StaffSubmissionError(400, "invalid_action")
      if (
        body.note !== undefined &&
        (typeof body.note !== "string" || body.note.length > 2000)
      )
        throw new StaffSubmissionError(400, "invalid_note")
      let note = typeof body.note === "string" ? body.note.trim() : ""
      if (body.action === "reject") {
        if (
          !DECLINE_REASONS.includes(body.reason as any) ||
          (body.reason === "other" && !note)
        )
          throw new StaffSubmissionError(400, "decline_reason_required")
        note = `${DECLINE_REASON_LABELS[body.reason as keyof typeof DECLINE_REASON_LABELS]}${note ? `: ${note}` : ""}`
      }
      const unsafe = findUnsafeContent(note)
      if (unsafe)
        throw new StaffSubmissionError(400, "unsafe_content", unsafe.message)
      const status = body.action === "reject" ? "rejected" : "approved"
      await strapi.db.transaction(async ({ trx }: any) => {
        await lock(trx, libraryId)
        await authorise(user, libraryId, "reviewSuggestions")
        if (status === "approved" && "mobileTimetable" in object(s.fields)) {
          const row = await live(libraryId, await defaultLocale(strapi))
          if (
            object(s.fields).previousHash !==
            timetableHash(normalizeMobileTimetable(row?.mobileTimetable))
          )
            throw new StaffSubmissionError(
              409,
              "stale",
              "The timetable changed after this suggestion was sent. Ask for a fresh suggestion."
            )
        }
        const result = await submissions().updateStatus(
          id,
          status,
          staffReviewer(user),
          note ||
            (body.action === "done"
              ? "Marked as done by library staff"
              : "Accepted by library staff")
        )
        if (result.error)
          throw new StaffSubmissionError(
            result.error === "self_review"
              ? 403
              : ["conflict", "invalid_transition"].includes(result.error)
                ? 409
                : 422,
            result.error,
            result.error === "invalid_transition"
              ? "This suggestion has already been decided."
              : "The suggestion could not be applied."
          )
      })

      return { status, libraryDocumentId: libraryId }
    },
  }
}
