import type { Actor, Action, DiscussionConfig, Target } from "./contracts"
import { fail, object, safeUrl, text } from "./validation"

export async function permitted(
  strapi: any,
  config: DiscussionConfig,
  actor: Actor | null,
  action: Action,
  subject: any,
  thread?: any,
  recordLanguage?: string,
  sanctionScope?: "subject" | "all"
): Promise<boolean> {
  if (actor?.admin) return true
  if (!subject) return false
  if (actor) {
    const sanctions = await strapi.db
      .query("plugin::discussions.sanction")
      .findMany({
        where: {
          actorKey: actor.key,
          active: true,
          $and: [
            {
              $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date().toISOString() } },
              ],
            },
            { $or: [{ subjectId: null }, { subjectId: subject.documentId }] },
          ],
        },
        limit: 101,
      })
    if (sanctions.length > 100) return false
    if (
      sanctions.some(
        (row: any) =>
          (!row.expiresAt || new Date(row.expiresAt).getTime() > Date.now()) &&
          (!row.subjectId || row.subjectId === subject.documentId) &&
          (row.mode === "ban" ||
            ["createThread", "reply", "editOwn", "react", "upload"].includes(
              action
            ))
      )
    )
      return false
  }
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
          sanctionScope,
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
  recordLanguage?: string,
  sanctionScope?: "subject" | "all"
) {
  if (
    !(await permitted(
      strapi,
      config,
      actor,
      action,
      subject,
      thread,
      recordLanguage,
      sanctionScope
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
      ...(typeof result.active === "boolean" ? { active: result.active } : {}),
      title: text(result.title, "target title", 250),
      url: safeUrl(result.url),
      ...(result.links?.length
        ? {
            links: result.links.slice(0, 5).map((link) => ({
              label: text(link.label, "target link label", 120),
              url: safeUrl(link.url),
            })),
          }
        : {}),
    },
  }
}
