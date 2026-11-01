import type { Core } from "@strapi/strapi"
import type { CommittedEvent } from "strapi-plugin-discussions/types"

/** Called by the durable discussion outbox, after moderation commits. Failures retry. */
export async function awardDiscussionContribution(
  strapi: Core.Strapi,
  event: CommittedEvent
) {
  if (event.type !== "visible") return
  const record = await strapi.db
    .query(`plugin::discussions.${event.recordType}`)
    .findOne({
      where: { documentId: event.recordId },
    })
  if (!record || record.state !== "visible") return
  const thread =
    event.recordType === "thread"
      ? record
      : await strapi.db.query("plugin::discussions.thread").findOne({
          where: { documentId: event.threadId },
        })
  if (!thread || thread.state !== "visible") return
  // A visible event is tied to exactly one approved revision. Later edits,
  // removals and retry delivery must not credit the wrong author or renew at delivery time.
  const revision = await strapi.db
    .query("plugin::discussions.revision")
    .findOne({
      where: {
        recordType: event.recordType,
        recordId: event.recordId,
        baseVersion: event.version - 1,
        state: "approved",
      },
    })
  if (!revision?.authorKey?.startsWith("ba:") || !revision.decidedAt) return
  const acceptedAt = new Date(revision.decidedAt)
  if (!Number.isFinite(acceptedAt.getTime())) return
  const action =
    revision.baseVersion === 0
      ? event.recordType === "thread"
        ? "discussion_thread_accepted"
        : "discussion_reply_accepted"
      : "discussion_edit_accepted"
  await strapi
    .plugin("rewards")
    .service("points")
    .award(
      revision.authorKey.slice(3),
      action,
      action === "discussion_thread_accepted" ? 2 : 1,
      {
        recordId: event.recordId,
        threadId: event.threadId,
        revisionId: revision.documentId,
        acceptedAt: acceptedAt.toISOString(),
      },
      `discussion:${revision.documentId}:accepted`,
      acceptedAt
    )
}
