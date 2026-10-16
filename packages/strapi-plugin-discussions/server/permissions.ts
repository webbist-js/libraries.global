import type { Actor, Action, DiscussionConfig, Target } from "./contracts"
import { fail, object, safeUrl, text } from "./validation"

export async function permitted(
  strapi: any,
  config: DiscussionConfig,
  actor: Actor | null,
  action: Action,
  subject: any,
  thread?: any,
  recordLanguage?: string
): Promise<boolean> {
  if (actor?.admin) return true
  if (!subject) return false
  if (action === "read") {
    if (subject.visibility === "members" && !actor) return false
    if (
      subject.visibility === "private" &&
      !actor?.capabilities?.includes("moderate")
    )
      return false
  } else {
    if (!actor || !actor.capabilities?.includes(action)) return false
    if (
      subject.visibility === "private" &&
      !actor.capabilities.includes("moderate")
    )
      return false
    if (
      action === "createThread" &&
      subject.createPolicy === "moderators" &&
      !actor.capabilities.includes("moderate")
    )
      return false
  }

  return config.authorize
    ? Boolean(
        await config.authorize({
          strapi,
          actor,
          action,
          subject,
          thread,
          recordLanguage,
        })
      )
    : true
}
export async function requirePermission(
  strapi: any,
  config: DiscussionConfig,
  actor: Actor | null,
  action: Action,
  subject: any,
  thread?: any,
  recordLanguage?: string
) {
  if (
    !(await permitted(
      strapi,
      config,
      actor,
      action,
      subject,
      thread,
      recordLanguage
    ))
  )
    fail(actor ? 403 : 401, "Discussion permission denied")
}
export async function resolveTarget(
  strapi: any,
  config: DiscussionConfig,
  actor: Actor | null,
  value: unknown
) {
  const input = object(value)
  const target: Target = {
    uid: text(input.uid, "target UID", 180),
    documentId: text(input.documentId, "target document id", 128),
  }
  if (input.locale !== undefined)
    target.locale = text(input.locale, "target locale", 64)
  if (!Object.hasOwn(config.targets, target.uid))
    return fail(404, "Discussion target unavailable")
  const result = await config.targets[target.uid](target, { strapi, actor })
  if (!result) return fail(404, "Discussion target unavailable")

  return {
    target,
    projection: {
      title: text(result.title, "target title", 250),
      url: safeUrl(result.url),
    },
  }
}
