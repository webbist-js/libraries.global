import type { Actor } from "strapi-plugin-discussions/types"

import { discussionActor } from "./discussions-host"

export function validateDriveConversationRequest(
  value: unknown,
  allowStart = true
): asserts value is {
  enabled: boolean
  threadIds: string[]
  baseVersion?: number
  featuredThreadId?: string
  start?: { title: string; body: string; language: string }
} {
  const input = value as any
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    typeof input.enabled !== "boolean" ||
    !Array.isArray(input.threadIds) ||
    input.threadIds.length > 10 ||
    input.threadIds.some(
      (id: unknown) => typeof id !== "string" || !id || id.length > 128
    ) ||
    (input.baseVersion !== undefined &&
      (!Number.isSafeInteger(input.baseVersion) || input.baseVersion < 0)) ||
    (input.featuredThreadId !== undefined &&
      (typeof input.featuredThreadId !== "string" ||
        (input.featuredThreadId &&
          !input.threadIds.includes(input.featuredThreadId)))) ||
    (input.start !== undefined &&
      (!allowStart ||
        !input.start ||
        ["title", "body", "language"].some(
          (field) => typeof input.start[field] !== "string"
        )))
  )
    throw Object.assign(new Error("Invalid Drive conversations"), {
      status: 400,
    })
}

/** Runs in the Drive write transaction; a rejected link rolls back the Drive. */
export async function configureDriveDiscussions(
  strapi: any,
  userId: string,
  driveId: string,
  locale: string,
  value: unknown,
  approvedProposalActor?: Actor
) {
  if (value === undefined) return
  validateDriveConversationRequest(value)
  const input = value
  const bad = () => {
    throw Object.assign(new Error("Invalid Drive conversations"), {
      status: 400,
    })
  }
  const actor = approvedProposalActor ?? (await discussionActor(strapi, userId))
  const service = strapi.plugin("discussions").service("discussion")
  const target = { uid: "api::drive.drive", documentId: driveId, locale }
  const before = await service.contextMetadata(actor, target)
  await service.configureContext(actor, target, {
    enabled: input.enabled,
    baseVersion: input.baseVersion ?? 0,
  })
  if (!input.enabled) return
  const ids = [...new Set<string>(input.threadIds)]
  for (const threadId of ids)
    await service.addContextLink(actor, { target, threadId })
  for (const link of before.links) {
    if (link.state === "visible" && !ids.includes(link.threadId))
      await service.actContextLink(actor, link.id, {
        action: "remove",
        baseVersion: link.version,
      })
  }
  if (input.featuredThreadId) {
    if (!ids.includes(input.featuredThreadId)) bad()
    const current = await service.contextMetadata(actor, target)
    const link = current.links.find(
      (link: any) => link.threadId === input.featuredThreadId
    )
    if (link && !link.featured)
      await service.actContextLink(actor, link.id, {
        action: "feature",
        baseVersion: link.version,
      })
  }
  if (input.featuredThreadId === "")
    for (const link of before.links) {
      if (link.featured && ids.includes(link.threadId))
        await service.actContextLink(actor, link.id, {
          action: "unfeature",
          baseVersion: link.version,
        })
    }
  if (input.start) {
    const subjects = await service.listSubjects(actor, { limit: 50 })
    const subject = subjects.data.find((row: any) => row.slug === "drives")
    if (!subject) bad()
    await service.createThread(actor, {
      subjectId: subject.id,
      target,
      title: input.start.title,
      body: input.start.body,
      language: input.start.language,
    })
  }
}
