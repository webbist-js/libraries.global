import { createHash } from "node:crypto"

import { maskContent } from "./content-policy"
import type { Actor, DiscussionConfig, Target } from "./contracts"
import { resolveTarget, requirePermission } from "./permissions"
import { fail, id, object, text, version } from "./validation"

const targetKey = (target: Target) => `${target.uid}:${target.documentId}`
const dedupeKey = (threadId: string, target: Target) =>
  createHash("sha256")
    .update(JSON.stringify([threadId, targetKey(target)]))
    .digest("hex")

/** Portable context associations. All projection goes through the original thread read gate. */
export function contextLinks({
  strapi,
  config,
  query,
  create,
  update,
  lock,
  context,
  audit,
  consume,
}: {
  strapi: any
  config: DiscussionConfig
  query: (kind: string) => any
  create: (kind: string, data: any) => Promise<any>
  update: (kind: string, id: string, data: any) => Promise<any>
  lock: (trx: any, kind: string, id: string) => Promise<any>
  context: (id: string, actor: Actor | null, visible?: boolean) => Promise<any>
  audit: (...args: any[]) => Promise<any>
  consume: (trx: any, actor: Actor) => Promise<void>
}) {
  const kindOf = (target: Target) =>
    Object.values(config.contextKinds ?? {}).find(
      (kind) => kind.uid === target.uid
    )
  async function permission(actor: Actor | null, target: Target) {
    if (!actor) return false
    if (actor.admin) return "manage"

    return config.authorizeContext
      ? config.authorizeContext({ strapi, actor, target })
      : false
  }
  async function setting(target: Target) {
    const row = await query("context-setting").findOne({
      where: { targetKey: targetKey(target) },
    })

    return {
      row,
      enabled: row?.enabled ?? kindOf(target)?.defaultEnabled !== false,
      version: row?.version ?? 0,
    }
  }
  async function rows(where: any) {
    const result = await query("context-link").findMany({
      where,
      limit: config.maxScanEntries + 1,
      orderBy: [{ id: "asc" }],
    })
    if (result.length > config.maxScanEntries)
      fail(503, "Discussion context catalogue exceeds its safe limit")

    return result
  }
  async function projection(
    row: any,
    actor: Actor | null,
    manage = false,
    cache = new Map<string, Promise<any>>(),
    recoverOwn = false
  ) {
    try {
      // This cache belongs to one read and one actor. Never retain grants or
      // projections across requests: target visibility and staff claims can change.
      const key = `target:${JSON.stringify(row.target)}`
      if (!cache.has(key))
        cache.set(
          key,
          (async () => {
            const [resolved, settings] = await Promise.all([
              resolveTarget(strapi, config, actor, row.target),
              setting(row.target),
            ])
            let publiclyReadable = false
            try {
              await resolveTarget(strapi, config, null, row.target)
              publiclyReadable = true
            } catch (error: any) {
              if (error.status !== 404) throw error
            }

            return { resolved, settings, publiclyReadable }
          })()
        )
      const { resolved, settings, publiclyReadable } = await cache.get(key)!
      if (!settings.enabled && !manage && !recoverOwn) return null
      const threadKey = `thread:${row.threadId}`
      if (!cache.has(threadKey))
        cache.set(threadKey, context(row.threadId, actor, true))
      const current = await cache.get(threadKey)!

      return {
        id: row.documentId,
        target: resolved.target,
        ...resolved.projection,
        threadId: row.threadId,
        featured: Boolean(row.featuredKey),
        state: row.state,
        version: row.version,
        canManage: manage,
        canReview: manage && row.actorKey !== actor?.key,
        public: publiclyReadable && settings.enabled,
        targetPublic: publiclyReadable,
        ...(row.actorKey === actor?.key || manage
          ? { feedback: row.moderationFeedback ?? null }
          : {}),
        thread: {
          title: current.thread.profanityException
            ? current.thread.title
            : maskContent(
                current.thread.title,
                current.thread.language,
                config.profanityTerms
              ),
          language: current.thread.language,
        },
      }
    } catch (error: any) {
      if (error.status === 404) return null
      throw error
    }
  }
  async function linksForThread(threadId: string, actor: Actor | null) {
    const links = await rows({ threadId, state: "visible" })
    const output = []
    const cache = new Map<string, Promise<any>>()
    for (const row of links) {
      const result = await projection(
        row,
        actor,
        (await permission(actor, row.target)) === "manage",
        cache
      )
      if (result) output.push(result)
    }

    return output
  }
  async function metadata(actor: Actor | null, value: unknown) {
    const { target, projection: targetProjection } = await resolveTarget(
      strapi,
      config,
      actor,
      value
    )
    const access = await permission(actor, target)
    const settings = await setting(target)
    const links = []
    const cache = new Map<string, Promise<any>>()
    for (const row of await rows({ targetKey: targetKey(target) })) {
      if (
        row.state !== "visible" &&
        access !== "manage" &&
        row.actorKey !== actor?.key
      )
        continue
      const result = await projection(
        row,
        actor,
        access === "manage",
        cache,
        row.state !== "visible" && Boolean(actor) && row.actorKey === actor?.key
      )
      if (result) links.push(result)
    }

    return {
      target,
      projection: targetProjection,
      enabled: settings.enabled,
      version: settings.version,
      canManage: access === "manage",
      canPropose: Boolean(access),
      links,
    }
  }
  async function add(
    actorInput: Actor | null,
    value: unknown,
    automatic = false,
    parentTransaction?: any
  ) {
    const actor = actorInput ?? fail(401, "Authentication required")
    const input = object(value),
      threadId = id(input.threadId)
    const { target } = await resolveTarget(strapi, config, actor, input.target)
    const access = await permission(actor, target)
    if (!automatic && !access) fail(403, "Context linking permission denied")
    const write = async (trx: any) => {
      if (!automatic) await consume(trx, actor)
      const current = await lock(trx, "thread", threadId)
      if (automatic) {
        if (current.authorKey !== actor.key && !actor.admin)
          fail(403, "Context linking permission denied")
      } else {
        const visible = await context(threadId, actor, true)
        await requirePermission(
          strapi,
          config,
          actor,
          "editOwn",
          visible.subject,
          visible.thread
        )
      }
      const key = dedupeKey(threadId, target)
      const existing = await query("context-link").findOne({
        where: { dedupeKey: key },
      })
      if (
        existing?.state === "pending" &&
        existing.actorKey !== actor.key &&
        access !== "manage" &&
        !actor.admin
      )
        fail(409, "Context link unavailable")
      if (existing && ["visible", "pending"].includes(existing.state))
        return { id: existing.documentId, state: existing.state }
      if (
        (await rows({ threadId, state: "visible" })).length >= 20 ||
        (await rows({ threadId, state: "pending" })).length >= 20
      )
        fail(429, "Too many discussion context links")
      if (
        existing &&
        version(input.baseVersion ?? existing.version) !== existing.version
      )
        fail(409, "Context link has changed")
      const data = {
        threadId,
        target,
        targetUid: target.uid,
        targetKey: targetKey(target),
        dedupeKey: key,
        actorKey: actor.key,
        moderationFeedback: null,
        state: automatic || access === "manage" ? "visible" : "pending",
        version: (existing?.version ?? 0) + 1,
      }
      if (
        automatic &&
        !(await query("context-link").findOne({
          where: { featuredKey: targetKey(target) },
        }))
      )
        Object.assign(data, { featuredKey: targetKey(target) })
      const saved = existing
        ? await update("context-link", existing.documentId, data)
        : await create("context-link", data)
      await audit(actor, "context_linked", "thread", threadId, threadId)

      return { id: saved.documentId, state: saved.state }
    }

    return parentTransaction
      ? write(parentTransaction)
      : strapi.db.transaction(({ trx }: any) => write(trx))
  }
  async function act(actorInput: Actor | null, linkId: string, value: unknown) {
    const actor = actorInput ?? fail(401, "Authentication required")
    const input = object(value)

    return strapi.db.transaction(async ({ trx }: any) => {
      await consume(trx, actor)
      const initial = await query("context-link").findOne({
        where: { documentId: id(linkId) },
      })
      if (!initial) fail(404, "Context link unavailable")
      await resolveTarget(strapi, config, actor, initial.target)
      if ((await permission(actor, initial.target)) !== "manage")
        fail(403, "Context linking permission denied")
      // Lock one context before its links so concurrent feature swaps use a
      // consistent lock order. The unique key also handles first-write races.
      let settings = (await setting(initial.target)).row
      if (!settings)
        settings = await create("context-setting", {
          targetKey: initial.targetKey,
          target: initial.target,
          enabled: (await setting(initial.target)).enabled,
          version: 0,
        })
      await lock(trx, "context-setting", settings.documentId)
      const row = await lock(trx, "context-link", id(linkId))
      await resolveTarget(strapi, config, actor, row.target)
      if ((await permission(actor, row.target)) !== "manage")
        fail(403, "Context linking permission denied")
      await context(row.threadId, actor, true)
      if (version(input.baseVersion) !== row.version)
        fail(409, "Context link has changed")
      const action = input.action
      if (
        !["remove", "feature", "unfeature", "approve", "reject"].includes(
          action
        )
      )
        fail(400, "Invalid context action")
      if (
        ["approve", "reject"].includes(action) &&
        (row.state !== "pending" || row.actorKey === actor.key)
      )
        fail(403, "Another context manager must review this link")
      if (["feature", "unfeature"].includes(action) && row.state !== "visible")
        fail(409, "Context link is not published")
      if (action === "reject") text(input.feedback, "feedback", 1000)
      const data: any = { version: row.version + 1 }
      if (["remove", "reject"].includes(action)) {
        data.state = action === "remove" ? "removed" : "rejected"
        data.featuredKey = null
      }
      if (action === "reject")
        data.moderationFeedback = text(input.feedback, "feedback", 1000)
      if (action === "approve") {
        data.state = "visible"
        data.moderationFeedback = null
      }
      if (action === "unfeature") data.featuredKey = null
      if (action === "feature") {
        const featured = await query("context-link").findOne({
          where: { featuredKey: row.targetKey },
        })
        if (featured && featured.documentId !== row.documentId)
          await update("context-link", featured.documentId, {
            featuredKey: null,
            version: featured.version + 1,
          })
        data.featuredKey = row.targetKey
      }
      await update("context-link", row.documentId, data)
      await audit(
        actor,
        `context_${action}`,
        "thread",
        row.threadId,
        row.threadId,
        action === "reject" ? { feedback: input.feedback } : {}
      )

      return { ok: true }
    })
  }
  async function configure(
    actorInput: Actor | null,
    value: unknown,
    inputValue: unknown
  ) {
    const actor = actorInput ?? fail(401, "Authentication required")
    const input = object(inputValue),
      { target } = await resolveTarget(strapi, config, actor, value)
    if ((await permission(actor, target)) !== "manage")
      fail(403, "Context management permission denied")
    if (typeof input.enabled !== "boolean") fail(400, "Invalid context setting")

    return strapi.db.transaction(async ({ trx }: any) => {
      await consume(trx, actor)
      const current = await setting(target)
      if (current.row)
        await lock(trx, "context-setting", current.row.documentId)
      const fresh = await setting(target)
      if (version(input.baseVersion ?? 0) !== fresh.version)
        fail(409, "Context settings have changed")
      const data = {
        targetKey: targetKey(target),
        target,
        enabled: input.enabled,
        version: fresh.version + 1,
      }
      await (fresh.row
        ? update("context-setting", fresh.row.documentId, data)
        : create("context-setting", data))

      return { ok: true, version: data.version }
    })
  }
  async function eligible(actor: Actor | null, params: any) {
    if (
      params.contextType &&
      !Object.hasOwn(config.contextKinds ?? {}, params.contextType)
    )
      fail(400, "Invalid discussion context type")
    const kind = params.contextType
      ? config.contextKinds?.[params.contextType]
      : undefined
    if (params.contextType && !kind)
      fail(400, "Invalid discussion context type")
    let target: Target | undefined
    if (params.contextUid || params.contextId)
      target = (
        await resolveTarget(strapi, config, actor, {
          uid: params.contextUid,
          documentId: params.contextId,
          ...(params.contextLocale ? { locale: params.contextLocale } : {}),
        })
      ).target
    if (!target && !kind) return null
    if (target && kind && target.uid !== kind.uid)
      fail(400, "Discussion context type does not match the target")
    const links = await rows({
      state: "visible",
      ...(target ? { targetKey: targetKey(target) } : { targetUid: kind!.uid }),
    })
    const ids = new Map<string, boolean>()
    const cache = new Map<string, Promise<any>>()
    for (const row of links) {
      const projected = await projection(row, actor, false, cache)
      if (
        projected &&
        (params.activeContexts !== "1" || projected.active === true)
      )
        ids.set(
          row.threadId,
          Boolean(row.featuredKey) || ids.get(row.threadId) === true
        )
    }

    return ids
  }
  async function discover(actor: Actor | null, params: any) {
    if (!Object.hasOwn(config.contextKinds ?? {}, params.contextType))
      fail(400, "Invalid discussion context type")
    const kind =
      config.contextKinds?.[params.contextType] ??
      fail(400, "Invalid discussion context type")
    const search = text(params.q ?? "", "search", 180, true).toLocaleLowerCase()
    const found = new Map<string, any>()
    const cache = new Map<string, Promise<any>>()
    for (const row of await rows({ targetUid: kind.uid, state: "visible" })) {
      const key = row.targetKey
      if (found.has(key)) continue
      const value = await projection(row, actor, false, cache)
      if (
        value &&
        (!search || value.title.toLocaleLowerCase().includes(search))
      )
        found.set(key, {
          target: value.target,
          title: value.title,
          url: value.url,
        })
      if (found.size >= 50) break
    }

    return { data: [...found.values()] }
  }
  async function backfill() {
    const threads = await query("thread").findMany({
      where: { targetKey: { $ne: null } },
      limit: config.maxScanEntries + 1,
    })
    if (threads.length > config.maxScanEntries)
      fail(503, "Discussion attachment backfill exceeds its safe limit")
    for (const thread of threads) {
      if (!thread.target || !thread.targetKey) continue
      const key = dedupeKey(thread.documentId, thread.target)
      if (
        !(await query("context-link").findOne({ where: { dedupeKey: key } }))
      ) {
        const data = {
          threadId: thread.documentId,
          targetKey: thread.targetKey,
          targetUid: thread.target.uid,
          target: thread.target,
          dedupeKey: key,
          actorKey: thread.authorKey,
          state: "visible",
          version: 1,
          ...(!(await query("context-link").findOne({
            where: { featuredKey: thread.targetKey },
          }))
            ? { featuredKey: thread.targetKey }
            : {}),
        }
        try {
          await create("context-link", data)
        } catch (error: any) {
          if (
            !["23505", "SQLITE_CONSTRAINT_UNIQUE", "ER_DUP_ENTRY"].includes(
              error?.code
            )
          )
            throw error
          if (
            await query("context-link").findOne({ where: { dedupeKey: key } })
          )
            continue
          // Another process may have featured a different link for this context.
          if (
            !(await query("context-link").findOne({
              where: { featuredKey: thread.targetKey },
            }))
          )
            throw error
          await create("context-link", { ...data, featuredKey: null })
        }
      }
    }
  }

  return {
    linkedIds: async (target: Target) =>
      (await rows({ targetKey: targetKey(target), state: "visible" })).map(
        (row: any) => row.threadId
      ),
    metadata,
    add,
    act,
    configure,
    eligible,
    discover,
    linksForThread,
    backfill,
    setting,
    permission,
  }
}
