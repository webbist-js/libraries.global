import { createHash, randomUUID } from "node:crypto"

import { defaults } from "./config"
import type { Actor, CommittedEvent, DiscussionConfig } from "./contracts"
import { permitted, requirePermission, resolveTarget } from "./permissions"
import {
  fail,
  id,
  language,
  object,
  page,
  safeUrl,
  text,
  version,
} from "./validation"

const uid = (kind: string) => `plugin::discussions.${kind}`
const fingerprint = (...parts: string[]) =>
  createHash("sha256").update(JSON.stringify(parts)).digest("hex")
const now = () => new Date().toISOString()
const author = (actor: Actor) => ({
  authorKey: actor.key,
  authorName: actor.name,
  authorProfile: actor.profile ?? null,
})
const snapshotAuthor = (row: any) => ({
  name: row.authorName,
  ...(row.authorProfile?.slug ? { slug: row.authorProfile.slug } : {}),
  ...(row.authorProfile?.url ? { url: row.authorProfile.url } : {}),
})

export default function discussionService({ strapi }: { strapi: any }) {
  const config: DiscussionConfig = {
    ...defaults,
    ...strapi.config.get("plugin::discussions", {}),
  }
  const query = (kind: string) => strapi.db.query(uid(kind))
  const find = (kind: string, documentId: string) =>
    query(kind).findOne({ where: { documentId } })
  const create = (kind: string, data: any) =>
    query(kind).create({ data: { documentId: randomUUID(), ...data } })
  const update = (kind: string, documentId: string, data: any) =>
    query(kind).update({ where: { documentId }, data })
  async function required(kind: string, documentId: string) {
    return (
      (await find(kind, id(documentId))) ??
      fail(404, "Discussion record unavailable")
    )
  }
  async function lock(trx: any, kind: string, documentId: string) {
    const table = strapi.db.metadata.get(uid(kind)).tableName
    await trx(table).where("document_id", documentId).forUpdate().first()

    return required(kind, documentId)
  }
  async function lockActor(trx: any, key: string) {
    const table = strapi.db.metadata.get(uid("rate-window")).tableName
    const timestamp = now()
    await trx(table)
      .insert({
        document_id: randomUUID(),
        actor_key: key,
        window_started_at: timestamp,
        actions: 0,
        created_at: timestamp,
        updated_at: timestamp,
      })
      .onConflict("actor_key")
      .ignore()
    await trx(table).where("actor_key", key).forUpdate().first()

    return query("rate-window").findOne({ where: { actorKey: key } })
  }
  async function activeActor(trx: any, actor: Actor) {
    if (actor.admin) return null
    const row = await lockActor(trx, actor.key)
    if (
      await query("erased-actor").findOne({
        where: { actorHash: fingerprint("erased", actor.key) },
      })
    )
      fail(401, "Discussion identity was erased")

    return row
  }
  async function consume(trx: any, actor: Actor) {
    const row = await activeActor(trx, actor)
    if (!row) return
    const timestamp = now(),
      reset =
        Date.now() - new Date(row.windowStartedAt).getTime() >= 60 * 60 * 1000
    if (!reset && row.actions >= config.maxWritesPerHour)
      fail(429, "Discussion write limit reached; try again later")
    await update("rate-window", row.documentId, {
      actions: reset ? 1 : row.actions + 1,
      windowStartedAt: reset ? timestamp : row.windowStartedAt,
    })
  }
  function authenticated(actor: Actor | null): Actor {
    return actor ?? fail(401, "Authentication required")
  }
  function contentLanguage(value: unknown, subject: any) {
    const result = language(value)
    if (subject.languages?.length && !subject.languages.includes(result))
      fail(400, "Language is not allowed in this subject")

    return result
  }
  async function context(
    threadId: string,
    actor: Actor | null,
    requireVisible = false
  ) {
    const thread = await required("thread", threadId)
    const subject = await required("subject", thread.subjectId)
    if (!(await permitted(strapi, config, actor, "read", subject, thread)))
      return fail(404, "Discussion record unavailable")
    const moderator = await permitted(
      strapi,
      config,
      actor,
      "moderate",
      subject,
      thread
    )
    if (
      thread.state !== "visible" &&
      (requireVisible || (!moderator && actor?.key !== thread.authorKey))
    )
      return fail(404, "Discussion record unavailable")
    const target = thread.target
      ? (await resolveTarget(strapi, config, actor, thread.target)).projection
      : undefined

    return { thread, subject, moderator, target }
  }
  async function recordModerator(
    actor: Actor | null,
    subject: any,
    thread: any,
    row: any
  ) {
    return (
      (await permitted(strapi, config, actor, "read", subject, thread)) &&
      permitted(
        strapi,
        config,
        actor,
        "moderate",
        subject,
        thread,
        row.language
      )
    )
  }
  async function requireRecordModeration(
    actor: Actor,
    subject: any,
    thread: any,
    row: any
  ) {
    await requirePermission(strapi, config, actor, "read", subject, thread)
    await requirePermission(
      strapi,
      config,
      actor,
      "moderate",
      subject,
      thread,
      row.language
    )
  }
  async function replyReadable(
    reply: any,
    thread: any,
    actor: Actor | null,
    _threadModerator: boolean,
    visibleOnly = false
  ) {
    if (reply.threadId !== thread.documentId) return false
    const subject = await required("subject", thread.subjectId)
    if (
      !(await permitted(
        strapi,
        config,
        actor,
        "read",
        subject,
        thread,
        reply.language
      ))
    )
      return false
    // A thread moderator does not automatically moderate every reply language.
    const moderator =
      !visibleOnly && (await recordModerator(actor, subject, thread, reply))
    if (
      reply.state !== "visible" &&
      (visibleOnly || (!moderator && actor?.key !== reply.authorKey))
    )
      return false
    if (reply.parentId) {
      const parent = await find("reply", reply.parentId)
      if (
        !parent ||
        parent.threadId !== thread.documentId ||
        parent.state !== "visible"
      )
        return false
    }

    return true
  }
  async function projectedAuthor(row: any) {
    if (!config.publicAuthor) return snapshotAuthor(row)
    const projection = await config.publicAuthor(row.authorKey, { strapi })
    if (!projection) return null

    return {
      name: text(projection.name, "public author name", 120),
      ...(projection.slug
        ? { slug: text(projection.slug, "public author slug", 120) }
        : {}),
      ...(projection.url ? { url: safeUrl(projection.url) } : {}),
    }
  }
  async function threadDto(thread: any, target?: any) {
    return {
      id: thread.documentId,
      subjectId: thread.subjectId,
      title: thread.title,
      body: thread.body,
      language: thread.language,
      state: thread.state,
      version: thread.version,
      locked: thread.locked,
      pinned: thread.pinned,
      author: await projectedAuthor(thread),
      activityAt: thread.activityAt,
      createdAt: thread.createdAt,
      ...(target ? { target } : {}),
    }
  }
  async function replyDto(reply: any) {
    return {
      id: reply.documentId,
      threadId: reply.threadId,
      parentId: reply.parentId || null,
      body: reply.body,
      language: reply.language,
      state: reply.state,
      version: reply.version,
      author: await projectedAuthor(reply),
      createdAt: reply.createdAt,
    }
  }
  async function audit(
    actor: Actor,
    action: string,
    recordType: string,
    recordId: string,
    threadId: string,
    detail = {}
  ) {
    await create("audit-event", {
      actorKey: actor.key,
      action,
      recordType,
      recordId,
      threadId,
      detail,
    })
  }
  async function event(
    recordType: "thread" | "reply",
    row: any,
    type: "visible" | "removed" | "anonymized",
    tx: any
  ) {
    const payload: CommittedEvent = {
      id: randomUUID(),
      type,
      recordType,
      recordId: row.documentId,
      threadId: recordType === "thread" ? row.documentId : row.threadId,
      version: row.version,
    }
    await create("outbox", {
      dedupeKey: fingerprint(
        "event",
        recordType,
        row.documentId,
        String(row.version),
        type
      ),
      event: payload,
    })
    tx.onCommit(() => {
      service
        .flushNotifications()
        .catch(() =>
          strapi.log.warn(
            "[discussions] outbox dispatch failed; durable retry pending"
          )
        )
    })
  }
  async function submitRevision(
    actor: Actor,
    kind: "thread" | "reply",
    row: any,
    input: any
  ) {
    const revision = await create("revision", {
      ...author(actor),
      recordType: kind,
      recordId: row.documentId,
      threadId: kind === "thread" ? row.documentId : row.threadId,
      body: text(input.body, "body", config.maxBodyLength),
      ...(kind === "thread"
        ? { title: text(input.title ?? row.title, "title", 250) }
        : {}),
      baseVersion: row.version,
      state: "pending",
    })
    await audit(
      actor,
      "revision_submitted",
      kind,
      row.documentId,
      revision.threadId,
      { revisionId: revision.documentId, baseVersion: row.version }
    )

    return {
      id: revision.documentId,
      recordId: row.documentId,
      baseVersion: row.version,
      state: revision.state,
    }
  }
  async function remove(
    actor: Actor,
    kind: "thread" | "reply",
    row: any,
    note: string,
    tx: any
  ) {
    if (row.state === "removed") return row
    const result = await update(kind, row.documentId, {
      state: "removed",
      version: row.version + 1,
    })
    const pendingWhere =
      kind === "thread"
        ? { threadId: row.documentId, state: "pending" }
        : { recordType: kind, recordId: row.documentId, state: "pending" }
    await query("revision").updateMany({
      where: pendingWhere,
      data: {
        state: "rejected",
        reviewerKey: actor.key,
        reviewNote: "Record removed",
        decidedAt: now(),
      },
    })
    await audit(
      actor,
      "removed",
      kind,
      row.documentId,
      kind === "thread" ? row.documentId : row.threadId,
      { note }
    )
    await event(kind, result, "removed", tx)

    return result
  }
  const service = {
    async listSubjects(actor: Actor | null, params: any = {}) {
      const pagination = page(params, config.maxPageSize)
      const rows = await query("subject").findMany({
        ...pagination,
        orderBy: { name: "asc" },
      })
      const data = []
      for (const row of rows)
        if (await permitted(strapi, config, actor, "read", row))
          data.push({
            id: row.documentId,
            name: row.name,
            slug: row.slug,
            description: row.description,
            languages: row.languages,
            visibility: row.visibility,
            createPolicy: row.createPolicy,
            version: row.version,
          })

      return {
        data,
        nextOffset:
          rows.length === pagination.limit
            ? pagination.offset + rows.length
            : null,
      }
    },
    async saveSubject(actor: Actor, value: unknown, subjectId?: string) {
      if (!actor.admin) return fail(403, "Administrator required")
      const input = object(value)
      const name = text(input.name, "name", 120),
        slug = text(input.slug, "slug", 120)
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) fail(400, "Invalid slug")
      if (!["public", "members", "private"].includes(input.visibility))
        fail(400, "Invalid visibility")
      if (!["members", "moderators"].includes(input.createPolicy))
        fail(400, "Invalid creation policy")
      if (!Array.isArray(input.languages) || input.languages.length > 30)
        fail(400, "Invalid languages")
      const data = {
        name,
        slug,
        description: text(input.description, "description", 2000, true),
        languages: [...new Set(input.languages.map(language))],
        visibility: input.visibility,
        createPolicy: input.createPolicy,
      }

      return strapi.db.transaction(async ({ trx }: any) => {
        if (!subjectId) return create("subject", data)
        const current = await lock(trx, "subject", id(subjectId))
        if (version(input.baseVersion) !== current.version)
          fail(409, "Subject has changed")

        return update("subject", current.documentId, {
          ...data,
          version: current.version + 1,
        })
      })
    },
    async listThreads(actor: Actor | null, params: any = {}) {
      const pagination = page(params, config.maxPageSize)
      const where: any = { state: "visible" }
      if (params.subjectId) {
        const subject = await required("subject", id(params.subjectId))
        await requirePermission(strapi, config, actor, "read", subject)
        where.subjectId = subject.documentId
      }
      if (params.language) where.language = language(params.language)
      if (params.targetUid || params.targetId) {
        const { target } = await resolveTarget(strapi, config, actor, {
          uid: params.targetUid,
          documentId: params.targetId,
          ...(params.targetLocale ? { locale: params.targetLocale } : {}),
        })
        // Locale deliberately does not enter the identity: one attached thread across translations.
        where.targetKey = `${target.uid}:${target.documentId}`
      }
      const rows = await query("thread").findMany({
        where,
        ...pagination,
        orderBy: [{ pinned: "desc" }, { activityAt: "desc" }, { id: "desc" }],
      })
      const data = []
      for (const row of rows) {
        try {
          const current = await context(row.documentId, actor, true)
          data.push(await threadDto(current.thread, current.target))
        } catch (error: any) {
          if (error.status !== 404) throw error
        }
      }

      return {
        data,
        nextOffset:
          rows.length === pagination.limit
            ? pagination.offset + rows.length
            : null,
      }
    },
    async getThread(actor: Actor | null, threadId: string) {
      const current = await context(id(threadId), actor)

      return threadDto(current.thread, current.target)
    },
    async createThread(actorInput: Actor | null, value: unknown) {
      const actor = authenticated(actorInput),
        input = object(value),
        subjectId = id(input.subjectId)

      return strapi.db.transaction(async ({ trx }: any) => {
        await consume(trx, actor)
        const subject = await lock(trx, "subject", subjectId)
        await requirePermission(strapi, config, actor, "createThread", subject)
        const target = input.target
          ? (await resolveTarget(strapi, config, actor, input.target)).target
          : null
        const targetKey = target ? `${target.uid}:${target.documentId}` : null
        if (
          targetKey &&
          (await query("thread").findOne({ where: { targetKey } }))
        )
          fail(409, "An attached discussion already exists for this target")
        const row = await create("thread", {
          title: text(input.title, "title", 250),
          subjectId,
          language: contentLanguage(input.language, subject),
          ...author(actor),
          target,
          targetKey,
          state: "pending",
          version: 0,
          activityAt: now(),
        })

        return {
          thread: await threadDto(row),
          revision: await submitRevision(actor, "thread", row, input),
        }
      })
    },
    async listReplies(actor: Actor | null, threadId: string, params: any = {}) {
      const current = await context(id(threadId), actor, true),
        pagination = page(params, config.maxPageSize)
      const where: any = {
        threadId: current.thread.documentId,
        state: "visible",
      }
      if (params.language) where.language = language(params.language)
      const rows = await query("reply").findMany({
        where,
        ...pagination,
        orderBy: { id: "asc" },
      })
      const data = []
      for (const row of rows)
        if (
          await replyReadable(
            row,
            current.thread,
            actor,
            current.moderator,
            true
          )
        )
          data.push(await replyDto(row))

      return {
        data,
        nextOffset:
          rows.length === pagination.limit
            ? pagination.offset + rows.length
            : null,
      }
    },
    async createReply(
      actorInput: Actor | null,
      threadId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value)

      return strapi.db.transaction(async ({ trx }: any) => {
        await consume(trx, actor)
        await lock(trx, "thread", id(threadId))
        const { thread, subject, moderator } = await context(
          threadId,
          actor,
          true
        )
        await requirePermission(strapi, config, actor, "reply", subject, thread)
        if (thread.locked) fail(409, "Thread is locked")
        let parentId = null
        if (input.parentId) {
          const parent = await required("reply", id(input.parentId))
          if (
            parent.parentId ||
            !(await replyReadable(parent, thread, actor, moderator, true))
          )
            fail(400, "Only one visible reply level is supported")
          parentId = parent.documentId
        }
        const row = await create("reply", {
          threadId,
          parentId,
          language: contentLanguage(input.language ?? thread.language, subject),
          ...author(actor),
          state: "pending",
          version: 0,
        })

        return {
          reply: await replyDto(row),
          revision: await submitRevision(actor, "reply", row, input),
        }
      })
    },
    async edit(
      actorInput: Actor | null,
      kind: "thread" | "reply",
      recordId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        row = await required(kind, id(recordId))
      const threadId = kind === "thread" ? row.documentId : row.threadId

      return strapi.db.transaction(async ({ trx }: any) => {
        await consume(trx, actor)
        await lock(trx, "thread", threadId)
        const { thread, subject, moderator } = await context(threadId, actor)
        const current = await required(kind, row.documentId)
        if (
          kind === "reply" &&
          !(await replyReadable(current, thread, actor, moderator))
        )
          fail(404, "Discussion record unavailable")
        await requirePermission(
          strapi,
          config,
          actor,
          "editOwn",
          subject,
          thread,
          current.language
        )
        if (current.authorKey !== actor.key)
          fail(403, "Only the author can submit an edit")
        if (current.state === "removed" || thread.locked)
          fail(409, "Discussion is not editable")
        if (version(input.baseVersion) !== current.version)
          fail(409, "Content has changed; reload before editing")

        return submitRevision(actor, kind, current, input)
      })
    },
    async revisions(
      actor: Actor | null,
      kind: "thread" | "reply",
      recordId: string,
      params: any = {}
    ) {
      const row = await required(kind, id(recordId))
      const { thread, subject, moderator } = await context(
        kind === "thread" ? row.documentId : row.threadId,
        actor
      )
      if (
        kind === "reply" &&
        !(await replyReadable(row, thread, actor, moderator))
      )
        fail(404, "Discussion record unavailable")
      if (
        !(await recordModerator(actor, subject, thread, row)) &&
        row.authorKey !== actor?.key
      )
        fail(404, "Discussion record unavailable")
      const rows = await query("revision").findMany({
        where: { recordType: kind, recordId: row.documentId },
        ...page(params, config.maxPageSize),
        orderBy: { id: "desc" },
      })

      return {
        data: rows.map((revision: any) => ({
          id: revision.documentId,
          recordId: revision.recordId,
          body: revision.body,
          title: revision.title,
          baseVersion: revision.baseVersion,
          state: revision.state,
          createdAt: revision.createdAt,
          decidedAt: revision.decidedAt,
        })),
      }
    },
    async adminThreads(actor: Actor, params: any = {}) {
      if (!actor.admin) fail(403, "Administrator required")
      const pagination = page(params, config.maxPageSize),
        state = params.state ?? "visible"
      if (!["pending", "visible", "rejected", "removed"].includes(state))
        fail(400, "Invalid state")
      const rows = await query("thread").findMany({
        where: { state },
        ...pagination,
        orderBy: [{ activityAt: "desc" }, { id: "desc" }],
      })

      return {
        data: await Promise.all(rows.map((row: any) => threadDto(row))),
        nextOffset:
          rows.length === pagination.limit
            ? pagination.offset + rows.length
            : null,
      }
    },
    async myRecords(
      actorInput: Actor | null,
      kind: "thread" | "reply",
      params: any = {}
    ) {
      const actor = authenticated(actorInput),
        pagination = page(params, config.maxPageSize)
      const where: any = { authorKey: actor.key }
      if (params.recordId) where.documentId = id(params.recordId)
      if (kind === "reply" && params.threadId)
        where.threadId = id(params.threadId)
      const rows = await query(kind).findMany({
        where,
        ...pagination,
        orderBy: { id: "desc" },
      })
      const data = []
      for (const row of rows) {
        try {
          const current = await context(
            kind === "thread" ? row.documentId : row.threadId,
            actor
          )
          if (
            kind === "reply" &&
            !(await replyReadable(
              row,
              current.thread,
              actor,
              current.moderator
            ))
          )
            continue
          const proposals = await query("revision").findMany({
            where: {
              recordType: kind,
              recordId: row.documentId,
              authorKey: actor.key,
              state: "pending",
            },
            limit: 1,
            orderBy: { id: "desc" },
          })
          const pending = proposals[0]
          data.push({
            ...(await (kind === "thread"
              ? threadDto(row, current.target)
              : replyDto(row))),
            ...(pending
              ? {
                  pendingRevision: {
                    id: pending.documentId,
                    body: pending.body,
                    title: pending.title,
                    baseVersion: pending.baseVersion,
                  },
                }
              : {}),
          })
        } catch (error: any) {
          if (error.status !== 404) throw error
        }
      }

      return {
        data,
        nextOffset:
          rows.length === pagination.limit
            ? pagination.offset + rows.length
            : null,
      }
    },
    async reviewQueue(actorInput: Actor | null, params: any = {}) {
      const actor = authenticated(actorInput),
        pagination = page(params, config.maxPageSize)
      const rows = await query("revision").findMany({
        where: { state: "pending" },
        ...pagination,
        orderBy: { id: "asc" },
      })
      const data = []
      for (const revision of rows) {
        const thread = await required("thread", revision.threadId),
          subject = await required("subject", thread.subjectId)
        const row = await required(revision.recordType, revision.recordId)
        if (!(await recordModerator(actor, subject, thread, row))) continue
        if (!actor.admin && thread.target) {
          try {
            await resolveTarget(strapi, config, actor, thread.target)
          } catch (error: any) {
            if (error.status === 404) continue
            throw error
          }
        }
        data.push({
          id: revision.documentId,
          recordType: revision.recordType,
          recordId: revision.recordId,
          threadId: revision.threadId,
          title: revision.title,
          body: revision.body,
          language: row.language,
          previousBody: row.body,
          previousTitle: row.title,
          baseVersion: revision.baseVersion,
          currentVersion: row.version,
          author: await projectedAuthor(revision),
          state: revision.state,
          createdAt: revision.createdAt,
          subjectId: thread.subjectId,
          threadTitle: thread.title,
          threadVersion: thread.version,
        })
      }

      return {
        data,
        nextOffset:
          rows.length === pagination.limit
            ? pagination.offset + rows.length
            : null,
      }
    },
    async review(actorInput: Actor | null, revisionId: string, value: unknown) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required("revision", id(revisionId))
      if (!["approve", "reject"].includes(input.decision))
        fail(400, "Invalid decision")
      const note = text(input.note, "review note", 2000, true)

      return strapi.db.transaction(async (tx: any) => {
        await activeActor(tx.trx, actor)
        await lock(tx.trx, "thread", initial.threadId)
        const revision = await required("revision", initial.documentId)
        const row = await required(revision.recordType, revision.recordId),
          thread = await required("thread", revision.threadId),
          subject = await required("subject", thread.subjectId)
        await requireRecordModeration(actor, subject, thread, row)
        if (!actor.admin && thread.target)
          await resolveTarget(strapi, config, actor, thread.target)
        if (!config.allowSelfReview && actor.key === revision.authorKey)
          fail(403, "Self review is disabled")
        const desired = input.decision === "approve" ? "approved" : "rejected"
        if (revision.state !== "pending") {
          if (revision.state === desired && revision.reviewerKey === actor.key)
            return {
              id: revision.documentId,
              state: revision.state,
              recordVersion: row.version,
            }
          fail(409, "Revision already reviewed")
        }
        if (
          version(input.baseVersion) !== revision.baseVersion ||
          (input.decision === "approve" && revision.baseVersion !== row.version)
        )
          fail(409, "Revision conflicts with current content")
        if (
          input.decision === "approve" &&
          (row.state === "removed" || thread.state === "removed")
        )
          fail(409, "Discussion was removed")
        if (input.decision === "approve" && revision.recordType === "reply") {
          if (thread.state !== "visible")
            fail(409, "Thread must be visible before approving replies")
          if (
            row.parentId &&
            (await required("reply", row.parentId)).state !== "visible"
          )
            fail(409, "Parent reply must be visible")
        }
        await update("revision", revision.documentId, {
          state: desired,
          reviewerKey: actor.key,
          reviewNote: note,
          decidedAt: now(),
        })
        let recordVersion = row.version
        if (input.decision === "approve") {
          const result = await update(revision.recordType, row.documentId, {
            body: revision.body,
            ...(revision.recordType === "thread"
              ? { title: revision.title }
              : {}),
            state: "visible",
            version: row.version + 1,
          })
          recordVersion = result.version
          await update("thread", thread.documentId, { activityAt: now() })
          await event(revision.recordType, result, "visible", tx)
        } else if (row.state === "pending")
          await update(revision.recordType, row.documentId, {
            state: "rejected",
          })
        await audit(
          actor,
          desired,
          revision.recordType,
          row.documentId,
          revision.threadId,
          { revisionId: revision.documentId, note, version: recordVersion }
        )

        return { id: revision.documentId, state: desired, recordVersion }
      })
    },
    async moderate(
      actorInput: Actor | null,
      kind: "thread" | "reply",
      recordId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required(kind, id(recordId))

      return strapi.db.transaction(async (tx: any) => {
        await activeActor(tx.trx, actor)
        const threadId =
          kind === "thread" ? initial.documentId : initial.threadId
        const thread = await lock(tx.trx, "thread", threadId),
          subject = await required("subject", thread.subjectId),
          row = await required(kind, initial.documentId)
        await requireRecordModeration(actor, subject, thread, row)
        if (!actor.admin && thread.target)
          await resolveTarget(strapi, config, actor, thread.target)
        if (version(input.baseVersion) !== row.version)
          fail(409, "Content has changed")
        if (input.action === "remove") {
          const removed = await remove(
            actor,
            kind,
            row,
            text(input.note, "review note", 2000, true),
            tx
          )

          return {
            id: removed.documentId,
            state: removed.state,
            version: removed.version,
          }
        }
        if (row.state === "removed")
          fail(409, "Removed discussions cannot change flags")
        if (
          kind !== "thread" ||
          !["lock", "unlock", "pin", "unpin"].includes(input.action)
        )
          fail(400, "Invalid moderation action")
        const flag = ["lock", "unlock"].includes(input.action)
            ? "locked"
            : "pinned",
          enabled = ["lock", "pin"].includes(input.action)
        if (row[flag] === enabled)
          return { id: row.documentId, version: row.version, [flag]: enabled }
        const result = await update("thread", row.documentId, {
          [flag]: enabled,
          version: row.version + 1,
        })
        await audit(actor, input.action, kind, row.documentId, threadId)

        return {
          id: result.documentId,
          version: result.version,
          [flag]: result[flag],
        }
      })
    },
    async report(
      actorInput: Actor | null,
      kind: "thread" | "reply",
      recordId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required(kind, id(recordId))

      return strapi.db.transaction(async ({ trx }: any) => {
        const threadId =
          kind === "thread" ? initial.documentId : initial.threadId
        await consume(trx, actor)
        await lock(trx, "thread", threadId)
        const { thread, subject, moderator } = await context(
          threadId,
          actor,
          true
        )
        const row = await required(kind, initial.documentId)
        await requirePermission(
          strapi,
          config,
          actor,
          "report",
          subject,
          thread,
          row.language
        )
        if (
          kind === "reply" &&
          !(await replyReadable(row, thread, actor, moderator, true))
        )
          fail(404, "Discussion record unavailable")
        const reason = text(input.reason, "report reason", 2000),
          dedupeKey = fingerprint(kind, row.documentId, actor.key)
        const existing = await query("report").findOne({ where: { dedupeKey } })
        if (existing) return { id: existing.documentId, state: existing.state }
        const result = await create("report", {
          recordType: kind,
          recordId: row.documentId,
          threadId,
          reporterKey: actor.key,
          reason,
          dedupeKey,
          recordVersion: row.version,
          snapshotBody: row.body,
          snapshotTitle: row.title ?? null,
          state: "open",
          version: 0,
        })
        await audit(actor, "reported", kind, row.documentId, threadId, {
          reportId: result.documentId,
        })

        return { id: result.documentId, state: result.state }
      })
    },
    async reports(actorInput: Actor | null, params: any = {}) {
      const actor = authenticated(actorInput),
        pagination = page(params, config.maxPageSize)
      const rows = await query("report").findMany({
        where: { state: "open" },
        ...pagination,
        orderBy: { id: "asc" },
      })
      const data = []
      for (const report of rows) {
        const thread = await required("thread", report.threadId),
          subject = await required("subject", thread.subjectId)
        const record = await required(report.recordType, report.recordId)
        if (!(await recordModerator(actor, subject, thread, record))) continue
        if (!actor.admin && thread.target) {
          try {
            await resolveTarget(strapi, config, actor, thread.target)
          } catch (error: any) {
            if (error.status === 404) continue
            throw error
          }
        }
        data.push({
          language: record.language,
          reportedBody: report.snapshotBody,
          reportedTitle: report.snapshotTitle,
          recordVersion: report.recordVersion,
          currentBody: record.body,
          currentTitle: record.title,
          currentVersion: record.version,
          id: report.documentId,
          recordType: report.recordType,
          recordId: report.recordId,
          threadId: report.threadId,
          reason: report.reason,
          version: report.version,
          state: report.state,
        })
      }

      return {
        data,
        nextOffset:
          rows.length === pagination.limit
            ? pagination.offset + rows.length
            : null,
      }
    },
    async decideReport(
      actorInput: Actor | null,
      reportId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required("report", id(reportId))
      if (!["dismiss", "remove"].includes(input.decision))
        fail(400, "Invalid report decision")

      return strapi.db.transaction(async (tx: any) => {
        await activeActor(tx.trx, actor)
        const thread = await lock(tx.trx, "thread", initial.threadId),
          report = await required("report", initial.documentId),
          subject = await required("subject", thread.subjectId)
        const record = await required(report.recordType, report.recordId)
        await requireRecordModeration(actor, subject, thread, record)
        if (!actor.admin && thread.target)
          await resolveTarget(strapi, config, actor, thread.target)
        if (
          report.state !== "open" ||
          version(input.baseVersion) !== report.version
        )
          fail(409, "Report already reviewed")
        const note = text(input.note, "review note", 2000, true)
        if (input.decision === "remove") {
          const current = await required(report.recordType, report.recordId)
          if (version(input.recordBaseVersion) !== current.version)
            fail(409, "Reported content has changed; reload before removing")
          await remove(actor, report.recordType, current, note, tx)
        }
        await update("report", report.documentId, {
          state: input.decision === "dismiss" ? "dismissed" : "actioned",
          version: report.version + 1,
          reviewerKey: actor.key,
          reviewNote: note,
        })
        await audit(
          actor,
          "report_decided",
          report.recordType,
          report.recordId,
          report.threadId,
          { reportId: report.documentId, decision: input.decision, note }
        )

        return {
          id: report.documentId,
          state: input.decision === "dismiss" ? "dismissed" : "actioned",
          version: report.version + 1,
        }
      })
    },
    async subscribe(
      actorInput: Actor | null,
      threadId: string,
      enabled: boolean
    ) {
      const actor = authenticated(actorInput)
      if (typeof enabled !== "boolean") fail(400, "enabled must be a boolean")

      return strapi.db.transaction(async ({ trx }: any) => {
        await consume(trx, actor)
        await lock(trx, "thread", id(threadId))
        const dedupeKey = fingerprint(threadId, actor.key)
        if (!enabled) {
          await query("subscription").deleteMany({ where: { dedupeKey } })

          return { enabled: false }
        }
        const { thread, subject } = await context(threadId, actor, true)
        await requirePermission(
          strapi,
          config,
          actor,
          "subscribe",
          subject,
          thread
        )
        if (!(await query("subscription").findOne({ where: { dedupeKey } })))
          await create("subscription", {
            actorKey: actor.key,
            threadId,
            dedupeKey,
          })

        return { enabled: true }
      })
    },
    async auditLog(
      actorInput: Actor | null,
      threadId: string,
      params: any = {}
    ) {
      const actor = authenticated(actorInput),
        thread = await required("thread", id(threadId)),
        subject = await required("subject", thread.subjectId)
      await requirePermission(
        strapi,
        config,
        actor,
        "moderate",
        subject,
        thread
      )
      if (!actor.admin && thread.target)
        await resolveTarget(strapi, config, actor, thread.target)
      const rows = await query("audit-event").findMany({
        where: { threadId },
        ...page(params, config.maxPageSize),
        orderBy: { id: "desc" },
      })

      const authorized = []
      for (const row of rows) {
        const record =
          row.recordType === "reply"
            ? await find("reply", row.recordId)
            : thread
        if (
          actor.admin ||
          (record && (await recordModerator(actor, subject, thread, record)))
        )
          authorized.push(row)
      }

      return {
        data: authorized.map((row: any) => ({
          id: row.documentId,
          recordType: row.recordType,
          recordId: row.recordId,
          action: row.action,
          detail: row.detail,
          createdAt: row.createdAt,
          ...(actor.admin ? { actorKey: row.actorKey } : {}),
        })),
      }
    },
    /** Trusted server-only lifecycle seam. The host revokes sessions/grants before calling. */
    async eraseActor(actorKey: string) {
      const key = text(actorKey, "identity key", 180),
        actorHash = fingerprint("erased", key)

      return strapi.db.transaction(async (tx: any) => {
        // Actor-first ordering matches every mutation, preventing both resurrection and lock cycles.
        await lockActor(tx.trx, key)
        const alreadyErased = await query("erased-actor").findOne({
          where: { actorHash },
        })
        if (alreadyErased) {
          await query("rate-window").deleteMany({ where: { actorKey: key } })

          return { erased: true, alreadyErased: true }
        }
        await create("erased-actor", { actorHash })
        const [
          threads,
          replies,
          revisions,
          reviewerRevisions,
          reports,
          audits,
        ] = await Promise.all([
          query("thread").findMany({ where: { authorKey: key } }),
          query("reply").findMany({ where: { authorKey: key } }),
          query("revision").findMany({ where: { authorKey: key } }),
          query("revision").findMany({ where: { reviewerKey: key } }),
          query("report").findMany({
            where: { $or: [{ reporterKey: key }, { reviewerKey: key }] },
          }),
          query("audit-event").findMany({ where: { actorKey: key } }),
        ])
        const threadIds = [
          ...new Set<string>([
            ...threads.map((row: any) => row.documentId),
            ...replies.map((row: any) => row.threadId),
            ...revisions.map((row: any) => row.threadId),
            ...reviewerRevisions.map((row: any) => row.threadId),
            ...reports.map((row: any) => row.threadId),
            ...audits.map((row: any) => row.threadId),
          ]),
        ].sort()
        for (const threadId of threadIds)
          if (await find("thread", threadId))
            await lock(tx.trx, "thread", threadId)
        // Re-read state after locking: a moderator may have committed an approval while erasure waited.
        let anonymized = 0,
          unpublishedRemoved = 0
        for (const kind of ["thread", "reply"] as const) {
          const authored = await query(kind).findMany({
            where: { authorKey: key },
            orderBy: { id: "asc" },
          })
          for (const row of authored) {
            const visible = row.state === "visible"
            const result = await update(kind, row.documentId, {
              authorKey: "erased",
              authorName: "Former member",
              authorProfile: null,
              version: row.version + 1,
              ...(!visible
                ? {
                    state: "removed",
                    body: "",
                    ...(kind === "thread"
                      ? {
                          title: "Removed discussion",
                          target: null,
                          targetKey: null,
                        }
                      : {}),
                  }
                : {}),
            })
            if (visible) anonymized += 1
            else {
              unpublishedRemoved += 1
              if (kind === "thread")
                await query("revision").updateMany({
                  where: {
                    threadId: row.documentId,
                    state: "pending",
                    authorKey: { $ne: key },
                  },
                  data: {
                    state: "rejected",
                    reviewerKey: "system:privacy",
                    reviewNote: "Thread removed after account erasure",
                    decidedAt: now(),
                  },
                })
            }
            await event(kind, result, visible ? "anonymized" : "removed", tx)
          }
        }
        await query("subscription").deleteMany({ where: { actorKey: key } })
        await query("report").deleteMany({ where: { reporterKey: key } })
        await query("report").updateMany({
          where: { reviewerKey: key },
          data: { reviewerKey: "erased", reviewNote: null },
        })
        await query("revision").deleteMany({
          where: { authorKey: key, state: { $in: ["pending", "rejected"] } },
        })
        await query("revision").updateMany({
          where: { authorKey: key },
          data: {
            authorKey: "erased",
            authorName: "Former member",
            authorProfile: null,
          },
        })
        await query("revision").updateMany({
          where: { reviewerKey: key },
          data: { reviewerKey: "erased", reviewNote: null },
        })
        for (const row of audits)
          await update("audit-event", row.documentId, {
            actorKey: "erased",
            detail:
              row.detail && typeof row.detail === "object"
                ? Object.fromEntries(
                    Object.entries(row.detail).filter(
                      ([field]) => field !== "note"
                    )
                  )
                : null,
          })
        await query("outbox").deleteMany({ where: { actorKey: key } })
        await query("rate-window").deleteMany({ where: { actorKey: key } })

        return {
          erased: true,
          alreadyErased: false,
          anonymized,
          unpublishedRemoved,
        }
      })
    },
    async flushNotifications() {
      const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      const rows = await query("outbox").findMany({
        where: {
          $or: [
            { state: "pending" },
            { state: "dispatching", claimedAt: { $lt: cutoff } },
          ],
        },
        limit: config.notificationBatchSize,
        orderBy: { id: "asc" },
      })
      for (const item of rows) {
        const claimed = await query("outbox").updateMany({
          where: {
            documentId: item.documentId,
            $or: [
              { state: "pending" },
              { state: "dispatching", claimedAt: { $lt: cutoff } },
            ],
          },
          data: {
            state: "dispatching",
            claimedAt: now(),
            attempts: item.attempts + 1,
          },
        })
        if (!claimed.count) continue
        try {
          const payload: CommittedEvent = item.event
          if (!item.actorKey) {
            if (!item.hookDelivered) {
              await config.onEvent?.(payload)
              await update("outbox", item.documentId, { hookDelivered: true })
            }
            if (payload.type === "visible" && config.notify) {
              // Durable fan-out cursor bounds each flush; unique delivery keys make retries safe.
              const recipients = await query("subscription").findMany({
                where: {
                  threadId: payload.threadId,
                  id: { $gt: item.subscriptionCursor || 0 },
                },
                limit: config.notificationBatchSize,
                orderBy: { id: "asc" },
              })
              await strapi.db.transaction(async () => {
                for (const recipient of recipients) {
                  const dedupeKey = fingerprint(payload.id, recipient.actorKey)
                  if (
                    !(await query("outbox").findOne({ where: { dedupeKey } }))
                  )
                    await create("outbox", {
                      event: payload,
                      actorKey: recipient.actorKey,
                      dedupeKey,
                    })
                }
                await update("outbox", item.documentId, {
                  state:
                    recipients.length === config.notificationBatchSize
                      ? "pending"
                      : "done",
                  subscriptionCursor:
                    recipients.at(-1)?.id ?? item.subscriptionCursor,
                  claimedAt: null,
                })
              })
            } else
              await update("outbox", item.documentId, {
                state: "done",
                claimedAt: null,
              })
          } else {
            const subscription = await query("subscription").findOne({
              where: {
                dedupeKey: fingerprint(payload.threadId, item.actorKey),
              },
            })
            const actor = await notificationActor(item.actorKey)
            if (subscription && actor && config.notify) {
              try {
                const current = await context(payload.threadId, actor, true)
                if (payload.recordType === "reply") {
                  const reply = await find("reply", payload.recordId)
                  if (
                    !reply ||
                    !(await replyReadable(
                      reply,
                      current.thread,
                      actor,
                      current.moderator,
                      true
                    ))
                  ) {
                    await update("outbox", item.documentId, {
                      state: "done",
                      claimedAt: null,
                    })
                    continue
                  }
                }
                await config.notify({
                  idempotencyKey: item.dedupeKey,
                  actorKey: item.actorKey,
                  event: payload,
                })
              } catch (error: any) {
                if (error.status !== 404) throw error
              }
            }
            await update("outbox", item.documentId, {
              state: "done",
              claimedAt: null,
            })
          }
        } catch {
          // Do not store credentials, transport responses or user content in diagnostic rows.
          await update("outbox", item.documentId, {
            state: "pending",
            claimedAt: null,
            lastError: "Dispatch failed; delivery will be retried",
          })
          strapi.log.warn(
            `[discussions] Dispatch ${item.documentId} failed; retry pending`
          )
        }
      }

      return { processed: rows.length }
    },
  }
  async function notificationActor(key: string): Promise<Actor | null> {
    if (config.notificationActor)
      return config.notificationActor(key, { strapi })
    if (config.identity || !key.startsWith("up:")) return null
    const user = await strapi.db
      .query("plugin::users-permissions.user")
      .findOne({ where: { id: Number(key.slice(3)) }, populate: ["role"] })
    if (!user || user.blocked || (config.requireConfirmed && !user.confirmed))
      return null

    return {
      key,
      name: user.username,
      capabilities: [
        "read",
        ...(config.moderatorRoleIds.includes(user.role?.id)
          ? ["moderate" as const]
          : []),
      ],
    }
  }

  return service
}
