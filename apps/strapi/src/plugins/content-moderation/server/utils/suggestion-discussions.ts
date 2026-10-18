import type { PublicAuthor } from "strapi-plugin-discussions/types"

import { publicDiscussionAuthor } from "../../../../utils/discussions-host"

const TARGET = "plugin::content-moderation.option-suggestion"

export type SuggestionConversationSummary = {
  count: number
  participants: PublicAuthor[]
  latestAt?: string
  latestAuthor?: PublicAuthor | null
}

/** Only approved messages in public subjects on public suggestions are counted. */
export async function suggestionConversationSummaries(
  strapi: any,
  ids: string[]
) {
  const summaries = new Map<string, SuggestionConversationSummary>()
  if (!ids.length || !strapi.contentType?.("plugin::discussions.thread"))
    return summaries
  const publicSubjects = await strapi.db
    .query("plugin::discussions.subject")
    .findMany({ where: { visibility: "public" }, select: ["documentId"] })
  if (!publicSubjects.length) return summaries
  const allowed = new Set(ids)
  const threads = await strapi.db.query("plugin::discussions.thread").findMany({
    where: {
      state: "visible",
      targetKey: { $in: ids.map((id) => `${TARGET}:${id}`) },
      subjectId: { $in: publicSubjects.map((s: any) => s.documentId) },
    },
    select: ["documentId", "target", "authorKey", "createdAt"],
  })
  const targets = new Map<string, string>()
  const messages = new Map<string, any[]>()
  for (const thread of threads)
    if (
      thread.target?.uid === TARGET &&
      allowed.has(thread.target.documentId)
    ) {
      targets.set(thread.documentId, thread.target.documentId)
      messages.set(thread.target.documentId, [
        ...(messages.get(thread.target.documentId) ?? []),
        thread,
      ])
    }
  if (!targets.size) return summaries
  const replies = await strapi.db.query("plugin::discussions.reply").findMany({
    where: { state: "visible", threadId: { $in: [...targets.keys()] } },
    select: ["documentId", "threadId", "parentId", "authorKey", "createdAt"],
  })
  const visible = new Map(
    replies.map((reply: any) => [reply.documentId, reply])
  )
  for (const reply of replies) {
    if (reply.parentId) {
      const parent: any = visible.get(reply.parentId)
      if (!parent || parent.threadId !== reply.threadId) continue
    }
    const id = targets.get(reply.threadId)!
    messages.get(id)!.push(reply)
  }
  // Attribution is specific to each suggestion; never return internal keys or snapshots.
  const authors = new Map<string, Promise<PublicAuthor>>()
  const authorOf = (row: any, suggestionId: string) => {
    if (typeof row.authorKey !== "string")
      return Promise.resolve({ name: "Community member" })
    const key = `${suggestionId}:${row.authorKey}`
    if (!authors.has(key))
      authors.set(
        key,
        publicDiscussionAuthor(row.authorKey, {
          strapi,
          target: { uid: TARGET, documentId: suggestionId },
        })
      )

    return authors.get(key)!
  }
  await Promise.all(
    [...messages.entries()].map(async ([id, rows]) => {
      const recent = [...rows].sort(
        (a, b) =>
          (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
      )
      const unique = new Map<string, any>()
      for (const row of recent) {
        const key = row.authorKey ?? row.documentId
        if (!unique.has(key)) unique.set(key, row)
      }
      const latestAt = recent[0]?.createdAt
      summaries.set(id, {
        count: rows.length,
        participants: await Promise.all(
          [...unique.values()].slice(0, 3).map((row) => authorOf(row, id))
        ),
        ...(latestAt && Number.isFinite(Date.parse(latestAt))
          ? { latestAt }
          : {}),
        latestAuthor: await authorOf(recent[0], id),
      })
    })
  )

  return summaries
}

export async function suggestionCommentCounts(strapi: any, ids: string[]) {
  return new Map(
    [...(await suggestionConversationSummaries(strapi, ids))].map(
      ([id, summary]) => [id, summary.count]
    )
  )
}
