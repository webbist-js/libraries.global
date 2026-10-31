import {
  noticeEndDate,
  noticeIsUpcoming,
  noticeLocalDate,
} from "@repo/shared-data"

import {
  LIBRARY_NOTICE_UID,
  NoticeError,
  normalizeNotice,
  noticesForLibrary,
  publicNotice,
  refreshNoticeEffects,
} from "../../../utils/library-notices"
import { requireStaffMember } from "../../../utils/staff"

type NoticeTransaction = {
  raw?: (query: string, bindings: string[]) => PromiseLike<unknown>
}

async function lock(trx: NoticeTransaction, id: string) {
  if (typeof trx?.raw === "function")
    await trx.raw("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", [
      `staff-library:${id}`,
    ])
}

export default ({ strapi }: { strapi: any }) => {
  async function authorise(userId: string, id: string) {
    if (!(await requireStaffMember(strapi, userId, id, "notices")))
      throw new NoticeError(404, "not_found", "Library not found.")
  }
  async function library(id: string) {
    const row = await strapi
      .documents("api::library.library")
      .findOne({ documentId: id, status: "published" })
    if (!row) throw new NoticeError(404, "not_found")

    return row
  }
  async function audit(
    id: string,
    actor: string,
    action: string,
    noticeId: string,
    detail: Record<string, unknown> = {}
  ) {
    await strapi.documents("plugin::library-staff.staff-audit").create({
      data: {
        library: id,
        actor,
        action,
        subject: null,
        detail: { noticeDocumentId: noticeId, ...detail },
        at: new Date(),
      },
    })
  }

  return {
    async list(userId: string, id: string) {
      await authorise(userId, id)
      const row = await library(id)

      return {
        data: await noticesForLibrary(strapi, id, new Date(), true),
        today: noticeLocalDate(new Date(), row.timezone),
        timezone: row.timezone ?? "UTC",
        stops: row.mobileTimetable?.stops ?? [],
        cycleWeeks: row.mobileTimetable?.cycle?.weeks ?? 1,
      }
    },
    async countUpcoming(id: string) {
      const row = await library(id),
        today = noticeLocalDate(new Date(), row.timezone)

      return (await noticesForLibrary(strapi, id)).filter((n) =>
        noticeIsUpcoming(n, today)
      ).length
    },
    /** Live console calls this with the authenticated staff actor. Never accepts an actor from the browser body. */
    async createNotice({
      libraryDocumentId: id,
      baUserId,
      source = "staff",
      ...input
    }: {
      libraryDocumentId: string
      baUserId: string
      source?: "staff" | "live"
      [key: string]: unknown
    }) {
      await authorise(baUserId, id)
      const result = await strapi.db.transaction(
        async ({ trx, onCommit }: any) => {
          await lock(trx, id)
          await authorise(baUserId, id)
          const data = normalizeNotice(input, await library(id))
          const created = await strapi.documents(LIBRARY_NOTICE_UID).create({
            data: {
              ...data,
              library: id,
              source,
              createdByBaUserId: baUserId,
            },
          })
          await audit(id, baUserId, "notice_created", created.documentId)
          onCommit(() => {
            refreshNoticeEffects(strapi, id).catch((e) =>
              strapi.log.warn("[notices] Refresh failed", e)
            )
          })

          return created
        }
      )

      return { notice: publicNotice(result) }
    },
    async edit(userId: string, id: string, noticeId: string, input: unknown) {
      await authorise(userId, id)
      const result = await strapi.db.transaction(async ({ trx }: any) => {
        await lock(trx, id)
        await authorise(userId, id)
        const current = await strapi.documents(LIBRARY_NOTICE_UID).findOne({
          documentId: noticeId,
          populate: { library: { fields: ["documentId"] } },
        })
        if (!current || current.library?.documentId !== id)
          throw new NoticeError(404, "not_found")
        if (current.endedAt) throw new NoticeError(409, "notice_ended")
        const data = normalizeNotice(
          { ...current, ...(input as object) },
          await library(id)
        )
        const updated = await strapi
          .documents(LIBRARY_NOTICE_UID)
          .update({ documentId: noticeId, data })
        await audit(id, userId, "notice_updated", noticeId)

        return updated
      })
      await refreshNoticeEffects(strapi, id)

      return { notice: publicNotice(result) }
    },
    async reactivate(
      userId: string,
      id: string,
      noticeId: string,
      input: unknown
    ) {
      await authorise(userId, id)
      const result = await strapi.db.transaction(async ({ trx }: any) => {
        await lock(trx, id)
        await authorise(userId, id)
        const current = await strapi.documents(LIBRARY_NOTICE_UID).findOne({
          documentId: noticeId,
          populate: { library: { fields: ["documentId"] } },
        })
        if (!current || current.library?.documentId !== id)
          throw new NoticeError(404, "not_found")
        const record = await library(id)
        const today = noticeLocalDate(new Date(), record.timezone)
        if (!current.endedAt && noticeEndDate(publicNotice(current)) >= today)
          throw new NoticeError(
            409,
            "notice_current",
            "This notice is already current. Refresh the page to see it."
          )
        // Require fresh dates; never silently revive an old closure window.
        const data = normalizeNotice(input, record)
        if (String(data.from) < today)
          throw new NoticeError(
            400,
            "invalid_dates",
            "Choose today or a future date to reactivate this notice."
          )
        const previous = {
          previousFrom: current.from,
          previousTo: current.to ?? null,
          previousEndedAt: current.endedAt ?? null,
        }
        const updated = await strapi.documents(LIBRARY_NOTICE_UID).update({
          documentId: noticeId,
          data: { ...data, endedAt: null, endedByBaUserId: null },
        })
        await audit(id, userId, "notice_reactivated", noticeId, previous)

        return updated
      })
      await refreshNoticeEffects(strapi, id)

      return { notice: publicNotice(result) }
    },
    async end(userId: string, id: string, noticeId: string) {
      await authorise(userId, id)
      const result = await strapi.db.transaction(async ({ trx }: any) => {
        await lock(trx, id)
        await authorise(userId, id)
        const current = await strapi.documents(LIBRARY_NOTICE_UID).findOne({
          documentId: noticeId,
          populate: { library: { fields: ["documentId"] } },
        })
        if (!current || current.library?.documentId !== id)
          throw new NoticeError(404, "not_found")
        if (current.endedAt) return current
        const ended = await strapi.documents(LIBRARY_NOTICE_UID).update({
          documentId: noticeId,
          data: {
            endedAt: new Date().toISOString(),
            endedByBaUserId: userId,
          },
        })
        await audit(id, userId, "notice_ended", noticeId)

        return ended
      })
      await refreshNoticeEffects(strapi, id)

      return { notice: publicNotice(result) }
    },
  }
}
