/**
 * Applies an approved topic suggestion. The "Suggest a topic" form sends a
 * name and no target, so approval creates the topic, approved, or approves
 * one that already has that name in any case (a pending or rejected one).
 * A suggestion that names its topic (`targetEntityType: "topic"`) approves
 * that reviewed target instead, never one picked from `fields`.
 */

const TOPIC = "api::topic.topic"

type TopicSuggestion = {
  targetEntityType?: string | null
  targetDocumentId?: string | null
  submittedByUserId?: string | null
  submittedByEmail?: string | null
  fields?: unknown
}

export function topicSlug(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "")
}

function suggestedName(fields: unknown): string | null {
  const name = (fields as { name?: unknown } | null)?.name
  if (typeof name !== "string") return null
  const trimmed = name.trim().slice(0, 100)

  return trimmed.length >= 2 ? trimmed : null
}

/** The approved topic's documentId, or null when nothing could be applied. */
export async function applyTopicSuggestion(
  strapi: any,
  submission: TopicSuggestion
): Promise<string | null> {
  if (submission.targetEntityType === "topic" && submission.targetDocumentId) {
    await strapi.documents(TOPIC).update({
      documentId: submission.targetDocumentId,
      data: { status: "approved" },
    })

    return submission.targetDocumentId
  }

  const name = suggestedName(submission.fields)
  const slug = name ? topicSlug(name) : ""
  if (!name || !slug) return null

  // The name and the slug are both unique: "Seed-Libraries" is the topic
  // "Seed Libraries" already has.
  const [existing] = await strapi.documents(TOPIC).findMany({
    filters: { $or: [{ name: { $eqi: name } }, { slug: { $eq: slug } }] },
    fields: ["documentId", "status"],
    limit: 1,
  })
  if (existing?.documentId) {
    if (existing.status !== "approved")
      await strapi.documents(TOPIC).update({
        documentId: existing.documentId,
        data: { status: "approved" },
      })

    return existing.documentId
  }

  const created = await strapi.documents(TOPIC).create({
    data: {
      name,
      slug,
      status: "approved",
      suggestedByUserId: submission.submittedByUserId ?? null,
      suggestedByEmail: submission.submittedByEmail ?? null,
    },
  })

  return created?.documentId ?? null
}
