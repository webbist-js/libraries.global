import { createHash, randomUUID } from "node:crypto"

import { defaults } from "./config"
import { maskContent, inspectContent } from "./content-policy"
import { contextLinks } from "./context-links"
import type {
  Actor,
  CommittedEvent,
  DiscussionConfig,
  DiscussionRecord,
} from "./contracts"
import { mediaStore, sanitiseImage } from "./media"
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
  const storage = mediaStore(strapi, config)
  const query = (kind: string) => strapi.db.query(uid(kind))
  const find = (kind: string, documentId: string) =>
    query(kind).findOne({ where: { documentId } })
  const create = (kind: string, data: any) =>
    query(kind).create({ data: { documentId: randomUUID(), ...data } })
  const update = (kind: string, documentId: string, data: any) =>
    query(kind).update({ where: { documentId }, data })
  const connections = contextLinks({
    strapi,
    config,
    query,
    create,
    update,
    lock,
    context,
    audit,
    consume,
  })
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
  async function projectedAuthor(row: any, target = row.target) {
    if (!config.publicAuthor) return snapshotAuthor(row)
    const projection = await config.publicAuthor(row.authorKey, {
      strapi,
      ...(target ? { target } : {}),
    })
    if (!projection) return null
    const badges = Array.isArray(projection.badges)
      ? [
          ...new Set(
            projection.badges.filter((badge) =>
              [
                "editor",
                "moderator",
                "editorial_board",
                "suggested_this",
              ].includes(badge)
            )
          ),
        ].slice(0, 4)
      : []

    return {
      name: text(projection.name, "public author name", 120),
      ...(badges.length ? { badges } : {}),
      ...(projection.avatar
        ? {
            avatar: {
              url: safeUrl(projection.avatar.url),
              ...(projection.avatar.alternativeText
                ? {
                    alternativeText: text(
                      projection.avatar.alternativeText,
                      "avatar alt",
                      250
                    ),
                  }
                : {}),
            },
          }
        : {}),
      ...(["violet", "coral", "mint", "amber", "blue", "rose"].includes(
        projection.background ?? ""
      )
        ? { background: projection.background }
        : {}),
      ...(projection.slug
        ? { slug: text(projection.slug, "public author slug", 120) }
        : {}),
      ...(projection.url ? { url: safeUrl(projection.url) } : {}),
    }
  }
  async function scan(
    kind: string,
    where: any,
    orderBy: any,
    eligible: (row: any) => Promise<boolean>
  ) {
    const matches = []
    for (let offset = 0; offset < config.maxScanEntries; offset += 100) {
      const rows = await query(kind).findMany({
        where,
        orderBy,
        offset,
        limit: Math.min(100, config.maxScanEntries - offset),
      })
      for (const row of rows) if (await eligible(row)) matches.push(row)
      if (rows.length < 100) return matches
    }

    return fail(
      503,
      "Discussion listing temporarily unavailable; narrow the filters"
    )
  }
  function slice(rows: any[], params: any) {
    const pagination = page(params, config.maxPageSize)

    return {
      data: rows.slice(pagination.offset, pagination.offset + pagination.limit),
      nextOffset:
        rows.length > pagination.offset + pagination.limit
          ? pagination.offset + pagination.limit
          : null,
      total: rows.length,
    }
  }
  function moderationGate(actor: Actor) {
    if (!actor.admin && !actor.capabilities?.includes("moderate"))
      fail(403, "Discussion moderator required")
  }
  async function visibleReplies(thread: any, actor: Actor | null) {
    return scan(
      "reply",
      { threadId: thread.documentId, state: "visible" },
      { id: "asc" },
      (reply) => replyReadable(reply, thread, actor, false, true)
    )
  }
  async function reactions(kind: string, row: any, actor: Actor | null) {
    if (row.state !== "visible")
      return { reactions: { like: 0, love: 0 }, myReaction: null }
    const values = await query("reaction").findMany({
      where: { recordType: kind, recordId: row.documentId },
      limit: config.maxScanEntries + 1,
    })
    if (values.length > config.maxScanEntries)
      fail(503, "Discussion reactions temporarily unavailable")

    return {
      reactions: {
        like: values.filter((value: any) => value.value === "like").length,
        love: values.filter((value: any) => value.value === "love").length,
      },
      myReaction:
        values.find((value: any) => value.actorKey === actor?.key)?.value ??
        null,
    }
  }
  async function attachmentDtos(
    values: any[] | undefined,
    language?: string,
    exception = false
  ) {
    const data = []
    for (const value of values ?? []) {
      const attachment = await find("attachment", value.id)
      if (attachment && !attachment.retired)
        data.push({
          id: attachment.documentId,
          altText:
            language && !exception
              ? maskContent(value.altText, language, config.profanityTerms)
              : value.altText,
          caption:
            language && !exception
              ? maskContent(
                  value.caption ?? "",
                  language,
                  config.profanityTerms
                )
              : value.caption,
          width: attachment.width,
          height: attachment.height,
          mime: attachment.mime,
        })
    }

    return data
  }
  async function isPublishedImage(attachmentId: string, actor: Actor | null) {
    for (const kind of ["thread", "reply"]) {
      const records = await query(kind).findMany({
        where: { state: "visible" },
        limit: config.maxScanEntries + 1,
      })
      if (records.length > config.maxScanEntries)
        fail(503, "Image references temporarily unavailable")
      for (const record of records)
        if (
          record.attachments?.some((image: any) => image.id === attachmentId)
        ) {
          try {
            const ctx = await context(
              kind === "thread" ? record.documentId : record.threadId,
              actor,
              true
            )
            if (
              kind === "thread" ||
              (await replyReadable(
                record,
                ctx.thread,
                actor,
                ctx.moderator,
                true
              ))
            )
              return true
          } catch (error: any) {
            if (error.status !== 404) throw error
          }
        }
    }

    return false
  }
  async function hasApprovedImage(attachmentId: string) {
    // Retention follows approval state, independently of today's target/audience visibility.
    // A target may be temporarily unpublished and later restored; its approved media survives.
    for (const kind of ["thread", "reply"]) {
      const rows = await query(kind).findMany({
        where: { state: "visible" },
        limit: config.maxScanEntries + 1,
      })
      if (rows.length > config.maxScanEntries)
        fail(503, "Image references temporarily unavailable")
      if (
        rows.some((row: any) =>
          row.attachments?.some((image: any) => image.id === attachmentId)
        )
      )
        return true
    }

    return false
  }
  async function canReviewImage(attachmentId: string, actor: Actor | null) {
    if (actor?.admin) return true
    if (!actor?.capabilities?.includes("moderate")) return false
    const revisions = await query("revision").findMany({
      where: { state: "pending" },
      limit: config.maxScanEntries + 1,
    })
    if (revisions.length > config.maxScanEntries)
      fail(503, "Image review temporarily unavailable")
    for (const revision of revisions)
      if (
        revision.attachments?.some((image: any) => image.id === attachmentId)
      ) {
        const row = await required(revision.recordType, revision.recordId),
          thread = await required("thread", revision.threadId),
          subject = await required("subject", thread.subjectId)
        if (await recordModerator(actor, subject, thread, row)) {
          if (thread.target) {
            try {
              await resolveTarget(strapi, config, actor, thread.target)
            } catch (error: any) {
              if (error.status === 404) continue
              throw error
            }
          }

          return true
        }
      }
    const reports = await query("report").findMany({
      where: { state: "open" },
      limit: config.maxScanEntries + 1,
    })
    if (reports.length > config.maxScanEntries)
      fail(503, "Image review temporarily unavailable")
    for (const report of reports)
      if (
        report.snapshotAttachments?.some(
          (image: any) => image.id === attachmentId
        )
      ) {
        const ctx = await context(report.threadId, actor),
          row = await required(report.recordType, report.recordId)
        if (await recordModerator(actor, ctx.subject, ctx.thread, row))
          return true
      }

    return false
  }
  async function deleteRetiredImage(documentId: string, key: string) {
    try {
      await storage.delete(key)
      await query("attachment").deleteMany({
        where: { documentId, retired: true },
      })
    } catch {
      strapi.log.warn(
        "[discussions] Private image deletion deferred; durable retry pending"
      )
    }
  }
  async function quoteDto(row: any, actor: Actor | null) {
    if (!row.quote) return null
    const reference = {
      kind: row.quote.kind,
      id: row.quote.id,
      version: row.quote.version,
    }
    const source = await find(reference.kind, reference.id)
    if (
      !source ||
      source.state !== "visible" ||
      source.version !== reference.version
    )
      return { ...reference, available: false }
    try {
      const ctx = await context(
        reference.kind === "thread" ? source.documentId : source.threadId,
        actor,
        true
      )
      if (
        reference.kind === "reply" &&
        !(await replyReadable(source, ctx.thread, actor, ctx.moderator, true))
      )
        return { ...reference, available: false }

      return {
        ...reference,
        available: true,
        currentVersion: source.version,
        excerpt: source.profanityException
          ? row.quote.excerpt
          : maskContent(
              row.quote.excerpt,
              source.language,
              config.profanityTerms
            ),
        author: await projectedAuthor(source, ctx.thread.target),
      }
    } catch (error: any) {
      if (error.status === 404) return { ...reference, available: false }
      throw error
    }
  }
  async function threadDto(
    thread: any,
    target?: any,
    actor: Actor | null = null
  ): Promise<DiscussionRecord> {
    const body = thread.profanityException
      ? thread.body
      : maskContent(thread.body, thread.language, config.profanityTerms)
    const replies =
      thread.state === "visible" ? await visibleReplies(thread, actor) : []
    const subject = await required("subject", thread.subjectId)
    const threadAuthor = await projectedAuthor(thread)
    const participantRows = new Map<string, any>([[thread.authorKey, thread]])
    for (const reply of [...replies].reverse()) {
      if (!participantRows.has(reply.authorKey))
        participantRows.set(reply.authorKey, reply)
    }
    const participants = (
      await Promise.all(
        [...participantRows.values()]
          .slice(0, 12)
          .map((row) =>
            row === thread ? threadAuthor : projectedAuthor(row, thread.target)
          )
      )
    ).filter((value) => value !== null)

    return {
      id: thread.documentId,
      subjectId: thread.subjectId,
      subject: {
        id: subject.documentId,
        name: subject.name,
        slug: subject.slug,
        description: subject.description ?? "",
        languages: subject.languages ?? [],
        visibility: subject.visibility,
        createPolicy: subject.createPolicy,
      },
      title: thread.profanityException
        ? thread.title
        : maskContent(thread.title, thread.language, config.profanityTerms),
      body,
      excerpt: body.replaceAll(/\s+/g, " ").slice(0, 280),
      language: thread.language,
      state: thread.state,
      version: thread.version,
      locked: thread.locked,
      pinned: thread.pinned,
      author: threadAuthor,
      activityAt: thread.activityAt,
      createdAt: thread.createdAt,
      replyCount: replies.length,
      participants,
      participantCount: participantRows.size,
      ...(replies.length ? { lastReplyAt: replies.at(-1).createdAt } : {}),
      subscribed: Boolean(
        actor &&
        (await query("subscription").findOne({
          where: { dedupeKey: fingerprint(thread.documentId, actor.key) },
        }))
      ),
      viewer: {
        canReply:
          thread.state === "visible" &&
          !thread.locked &&
          (await permitted(strapi, config, actor, "reply", subject, thread)),
        canReact:
          thread.state === "visible" &&
          (await permitted(strapi, config, actor, "react", subject, thread)),
        canModerate: await recordModerator(actor, subject, thread, thread),
        canSanction:
          (await recordModerator(actor, subject, thread, thread)) &&
          (await permitted(strapi, config, actor, "sanction", subject, thread)),
      },
      attachments: await attachmentDtos(
        thread.attachments,
        thread.language,
        thread.profanityException
      ),
      ...(await reactions("thread", thread, actor)),
      quote: await quoteDto(thread, actor),
      ...(target ? { target } : {}),
      contexts: await connections.linksForThread(thread.documentId, actor),
    }
  }
  async function replyDto(
    reply: any,
    actor: Actor | null = null
  ): Promise<DiscussionRecord> {
    const parent = reply.parentId ? await find("reply", reply.parentId) : null
    const thread = await required("thread", reply.threadId)
    const subject = await required("subject", thread.subjectId)
    const parentVisible =
      parent && (await replyReadable(parent, thread, actor, false, true))

    return {
      subjectId: thread.subjectId,
      viewer: {
        canReply:
          reply.state === "visible" &&
          !reply.parentId &&
          !thread.locked &&
          (await permitted(
            strapi,
            config,
            actor,
            "reply",
            subject,
            thread,
            reply.language
          )),
        canReact:
          reply.state === "visible" &&
          (await permitted(
            strapi,
            config,
            actor,
            "react",
            subject,
            thread,
            reply.language
          )),
        canModerate: await recordModerator(actor, subject, thread, reply),
        canSanction:
          (await recordModerator(actor, subject, thread, reply)) &&
          (await permitted(
            strapi,
            config,
            actor,
            "sanction",
            subject,
            thread,
            reply.language
          )),
      },
      id: reply.documentId,
      threadId: reply.threadId,
      parentId: reply.parentId || null,
      parent: parentVisible
        ? {
            id: parent.documentId,
            author: await projectedAuthor(parent, thread.target),
            excerpt: (parent.profanityException
              ? parent.body
              : maskContent(parent.body, parent.language, config.profanityTerms)
            ).slice(0, 180),
          }
        : null,
      body: reply.profanityException
        ? reply.body
        : maskContent(reply.body, reply.language, config.profanityTerms),
      language: reply.language,
      state: reply.state,
      version: reply.version,
      author: await projectedAuthor(reply, thread.target),
      createdAt: reply.createdAt,
      attachments: await attachmentDtos(
        reply.attachments,
        reply.language,
        reply.profanityException
      ),
      ...(await reactions("reply", reply, actor)),
      quote: await quoteDto(reply, actor),
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
    const pending = await query("revision").findMany({
      where: { authorKey: actor.key, state: "pending" },
      limit: config.maxPendingPerActor,
    })
    if (pending.length >= config.maxPendingPerActor)
      fail(429, "Outstanding review limit reached; wait for a decision")
    let quote = input.quote === undefined ? (row.quote ?? null) : null
    if (input.quote) {
      const reference = object(input.quote)
      if (!["thread", "reply"].includes(reference.kind))
        fail(400, "Invalid quote source")
      const source = await required(reference.kind, id(reference.id))
      const threadId = kind === "thread" ? row.documentId : row.threadId
      if (
        (reference.kind === "thread" ? source.documentId : source.threadId) !==
        threadId
      )
        fail(400, "Quote must belong to this conversation")
      const ctx = await context(threadId, actor, true)
      if (
        source.state !== "visible" ||
        (reference.kind === "reply" &&
          !(await replyReadable(
            source,
            ctx.thread,
            actor,
            ctx.moderator,
            true
          )))
      )
        fail(404, "Quote source unavailable")
      if (version(reference.version) !== source.version)
        fail(409, "Quote source changed")
      quote = {
        kind: reference.kind,
        id: source.documentId,
        version: source.version,
        excerpt: source.body.slice(0, 500),
      }
    }
    const attachments = []
    const images =
      input.attachments === undefined
        ? (row.attachments ?? [])
        : input.attachments
    if (!Array.isArray(images) || images.length > config.maxImagesPerRevision)
      fail(400, "Too many discussion images")
    const seen = new Set<string>()
    for (const image of images) {
      const attachment = await required("attachment", id(object(image).id))
      if (attachment.retired) fail(404, "Discussion image unavailable")
      if (
        attachment.ownerKey !== actor.key &&
        !row.attachments?.some(
          (existing: any) => existing.id === attachment.documentId
        )
      )
        fail(403, "Discussion image is not owned by this writer")
      const thread =
        kind === "thread" ? row : await required("thread", row.threadId)
      if (
        attachment.subjectId !== thread.subjectId ||
        seen.has(attachment.documentId)
      )
        fail(400, "Invalid discussion image context")
      seen.add(attachment.documentId)
      attachments.push({
        id: attachment.documentId,
        altText: text(
          image.altText ?? attachment.altText,
          "image alternative text",
          250
        ),
        caption: text(
          image.caption ?? attachment.caption,
          "image caption",
          500,
          true
        ),
      })
    }
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
      quote,
      attachments,
      contentFlags: inspectContent(
        `${kind === "thread" ? (input.title ?? row.title) : ""}\n${input.body}\n${attachments.map((image) => `${image.altText} ${image.caption}`).join("\n")}`,
        row.language,
        config.profanityTerms
      ),
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
    tx: any,
    feedback = "This message was removed by the moderators."
  ) {
    if (row.state === "removed") return row
    const result = await update(kind, row.documentId, {
      state: "removed",
      moderationFeedback: feedback,
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
      const rows = await scan("subject", {}, { name: "asc" }, (row) =>
        permitted(strapi, config, actor, "read", row)
      )
      const result = slice(rows, params)
      const data = []
      for (const row of result.data) {
        const threads = await scan(
          "thread",
          { subjectId: row.documentId, state: "visible" },
          { id: "asc" },
          async (thread) => {
            try {
              await context(thread.documentId, actor, true)

              return true
            } catch (error: any) {
              if (error.status === 404) return false
              throw error
            }
          }
        )
        data.push({
          id: row.documentId,
          name: row.name,
          slug: row.slug,
          description: row.description,
          languages: row.languages,
          visibility: row.visibility,
          createPolicy: row.createPolicy,
          version: row.version,
          threadCount: threads.length,
        })
      }

      return { ...result, data }
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
    contextMetadata: connections.metadata,
    addContextLink: connections.add,
    actContextLink: connections.act,
    configureContext: connections.configure,
    discoverContexts: connections.discover,
    backfillContextLinks: connections.backfill,
    async listThreads(actor: Actor | null, params: any = {}) {
      page(params, config.maxPageSize)
      const view = params.view ?? "latest"
      if (!["latest", "unanswered", "following"].includes(view))
        fail(400, "Invalid discussion view")
      if (view === "following" && !actor)
        fail(401, "Sign in to view followed discussions")
      const search =
        params.q === undefined
          ? ""
          : text(params.q, "search", 180, true).toLocaleLowerCase()
      const where: any = { state: "visible" }
      if (params.mine === "1") where.authorKey = authenticated(actor).key
      const eligible = await connections.eligible(actor, params)
      if (eligible) where.documentId = { $in: [...eligible.keys()] }
      if (params.subjectId) where.subjectId = id(params.subjectId)
      if (params.language) where.language = language(params.language)
      if (params.targetUid || params.targetId) {
        const { target } = await resolveTarget(strapi, config, actor, {
          uid: params.targetUid,
          documentId: params.targetId,
          ...(params.targetLocale ? { locale: params.targetLocale } : {}),
        })
        where.$or = [
          { targetKey: `${target.uid}:${target.documentId}` },
          { documentId: { $in: await connections.linkedIds(target) } },
        ]
      }
      const contexts = new Map<string, any>()
      const rows = await scan(
        "thread",
        where,
        [{ pinned: "desc" }, { activityAt: "desc" }, { id: "desc" }],
        async (row) => {
          try {
            const ctx = await context(row.documentId, actor, true)
            const publicText = row.profanityException
              ? `${row.title} ${row.body}`
              : maskContent(
                  `${row.title} ${row.body}`,
                  row.language,
                  config.profanityTerms
                )
            if (search && !publicText.toLocaleLowerCase().includes(search))
              return false
            if (
              view === "unanswered" &&
              (await visibleReplies(row, actor)).length
            )
              return false
            if (
              view === "following" &&
              !(await query("subscription").findOne({
                where: { dedupeKey: fingerprint(row.documentId, actor!.key) },
              }))
            )
              return false
            contexts.set(row.documentId, ctx)

            return true
          } catch (error: any) {
            if (error.status === 404) return false
            throw error
          }
        }
      )
      if (eligible && (params.contextUid || params.contextId))
        rows.sort(
          (a: any, b: any) =>
            Number(eligible.get(b.documentId)) -
            Number(eligible.get(a.documentId))
        )
      const result = slice(rows, params)

      return {
        ...result,
        data: await Promise.all(
          result.data.map((row: any) => {
            const ctx = contexts.get(row.documentId)

            return threadDto(ctx.thread, ctx.target, actor)
          })
        ),
      }
    },
    async getThread(actor: Actor | null, threadId: string) {
      const current = await context(id(threadId), actor)

      return threadDto(current.thread, current.target, actor)
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
        const existingTarget = targetKey
          ? await query("thread").findOne({ where: { targetKey } })
          : null
        if (
          existingTarget &&
          !Object.values(config.contextKinds ?? {}).some(
            (kind) => kind.uid === target?.uid
          )
        )
          fail(409, "An attached discussion already exists for this target")
        const row = await create("thread", {
          title: text(input.title, "title", 250),
          subjectId,
          language: contentLanguage(input.language, subject),
          ...author(actor),
          target,
          targetKey: existingTarget ? null : targetKey,
          state: "pending",
          version: 0,
          activityAt: now(),
        })
        if (target) {
          if (
            !(await connections.setting(target)).enabled &&
            (await connections.permission(actor, target)) !== "manage"
          )
            fail(403, "Conversations are disabled for this context")
          await connections.add(
            actor,
            { target, threadId: row.documentId },
            true,
            trx
          )
        }

        return {
          thread: await threadDto(row, undefined, actor),
          revision: await submitRevision(actor, "thread", row, input),
        }
      })
    },
    async listReplies(actor: Actor | null, threadId: string, params: any = {}) {
      const current = await context(id(threadId), actor, true)
      const replies = await visibleReplies(current.thread, actor)
      const selected = params.language
        ? replies.filter(
            (row: any) => row.language === language(params.language)
          )
        : replies
      const ordered: any[] = []
      for (const row of selected.filter((row: any) => !row.parentId)) {
        ordered.push(
          row,
          ...selected.filter((child: any) => child.parentId === row.documentId)
        )
      }
      for (const row of selected)
        if (!ordered.some((item) => item.documentId === row.documentId))
          ordered.push(row)
      // Inline hosts can show the newest messages without changing the default threaded order.
      const result = slice(
        params.order === "chronological"
          ? [...selected].sort(
              (a: any, b: any) =>
                (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0)
            )
          : ordered,
        params
      )

      return {
        ...result,
        data: await Promise.all(
          result.data.map((row: any) => replyDto(row, actor))
        ),
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
          reply: await replyDto(row, actor),
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
      if (params.language) where.language = language(params.language)
      if (kind === "thread" && (params.targetUid || params.targetId)) {
        const { target } = await resolveTarget(strapi, config, actor, {
          uid: params.targetUid,
          documentId: params.targetId,
          ...(params.targetLocale ? { locale: params.targetLocale } : {}),
        })
        where.$or = [
          { targetKey: `${target.uid}:${target.documentId}` },
          { documentId: { $in: await connections.linkedIds(target) } },
        ]
      }
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
          const latest = (
            await query("revision").findMany({
              where: {
                recordType: kind,
                recordId: row.documentId,
                authorKey: actor.key,
              },
              orderBy: { id: "desc" },
              limit: 1,
            })
          )[0]
          data.push({
            moderationFeedback: row.moderationFeedback ?? null,
            latestRevision: latest
              ? {
                  id: latest.documentId,
                  state: latest.state,
                  title: latest.title,
                  body: latest.body,
                  baseVersion: latest.baseVersion,
                  feedback: latest.contributorFeedback ?? null,
                  attachments: await attachmentDtos(latest.attachments),
                }
              : null,
            ...(await (kind === "thread"
              ? threadDto(row, current.target, actor)
              : replyDto(row, actor))),
            ...(pending
              ? {
                  pendingRevision: {
                    id: pending.documentId,
                    body: pending.body,
                    title: pending.title,
                    attachments: await attachmentDtos(pending.attachments),
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
      moderationGate(actor)
      if (
        params.reviewableOnly !== undefined &&
        !["true", "false", true, false].includes(params.reviewableOnly)
      )
        fail(400, "Invalid reviewable filter")
      const reviewableOnly =
        params.reviewableOnly === true || params.reviewableOnly === "true"
      const rows = await scan(
        "revision",
        {
          state: "pending",
          ...(reviewableOnly && !config.allowSelfReview
            ? { authorKey: { $ne: actor.key } }
            : {}),
          ...(params.threadId ? { threadId: id(params.threadId) } : {}),
        },
        { id: "asc" },
        async (revision) => {
          const thread = await required("thread", revision.threadId),
            subject = await required("subject", thread.subjectId),
            row = await required(revision.recordType, revision.recordId)
          if (!(await recordModerator(actor, subject, thread, row)))
            return false
          if (!actor.admin && thread.target) {
            try {
              await resolveTarget(strapi, config, actor, thread.target)
            } catch (error: any) {
              if (error.status === 404) return false
              throw error
            }
          }

          return true
        }
      )
      const data = []
      for (const revision of rows.slice(
        pagination.offset,
        pagination.offset + pagination.limit
      )) {
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
        const parent = row.parentId ? await find("reply", row.parentId) : null
        const parentVisible =
          parent && (await replyReadable(parent, thread, actor, false, true))
        data.push({
          id: revision.documentId,
          recordType: revision.recordType,
          recordId: revision.recordId,
          threadId: revision.threadId,
          title: revision.title,
          body: revision.body,
          language: row.language,
          quote: await quoteDto(revision, actor),
          contentFlags: revision.contentFlags,
          attachments: await attachmentDtos(revision.attachments),
          previousBody: row.body,
          previousTitle: row.title,
          baseVersion: revision.baseVersion,
          currentVersion: row.version,
          author: await projectedAuthor(revision, thread.target),
          state: revision.state,
          createdAt: revision.createdAt,
          subjectId: thread.subjectId,
          threadTitle: thread.title,
          threadVersion: thread.version,
          recordState: row.state,
          parentId: row.parentId || null,
          parentAuthor: parentVisible
            ? await projectedAuthor(parent, thread.target)
            : null,
          canReview: config.allowSelfReview || actor.key !== revision.authorKey,
          isOwn: actor.key === revision.authorKey,
          canSanction:
            actor.key !== row.authorKey &&
            (await permitted(
              strapi,
              config,
              actor,
              "sanction",
              subject,
              thread,
              row.language
            )),
        })
      }

      return {
        data,
        total: rows.length,
        nextOffset:
          rows.length > pagination.offset + pagination.limit
            ? pagination.offset + pagination.limit
            : null,
      }
    },
    async review(actorInput: Actor | null, revisionId: string, value: unknown) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required("revision", id(revisionId))
      if (!["approve", "reject", "request_changes"].includes(input.decision))
        fail(400, "Invalid decision")
      const note = text(input.note, "review note", 2000, true)
      const feedback = text(
        input.contributorFeedback ??
          (input.decision === "reject"
            ? "Your contribution was rejected. Contact the moderators if you need clarification."
            : undefined),
        "contributor feedback",
        2000,
        input.decision === "approve"
      )
      const exceptionReason = input.profanityException
        ? text(input.exceptionReason, "content exception reason", 1000)
        : ""

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
        const desired =
          input.decision === "approve"
            ? "approved"
            : input.decision === "request_changes"
              ? "changes_requested"
              : "rejected"
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
        if (
          input.profanityException !== undefined &&
          typeof input.profanityException !== "boolean"
        )
          fail(400, "Invalid content exception")
        if (input.decision === "approve")
          for (const attachment of revision.attachments ?? [])
            if ((await required("attachment", attachment.id)).retired)
              fail(
                409,
                "Discussion image expired; ask the writer to replace it"
              )
        await update("revision", revision.documentId, {
          state: desired,
          reviewerKey: actor.key,
          reviewNote: note,
          contributorFeedback: feedback,
          decidedAt: now(),
        })
        let recordVersion = row.version
        if (input.decision === "approve") {
          const result = await update(revision.recordType, row.documentId, {
            body: revision.body,
            quote: revision.quote,
            attachments: revision.attachments,
            moderationFeedback: null,
            profanityException: Boolean(exceptionReason),
            ...(revision.recordType === "thread"
              ? { title: revision.title }
              : {}),
            state: "visible",
            version: row.version + 1,
          })
          recordVersion = result.version
          await update("thread", thread.documentId, { activityAt: now() })
          await event(revision.recordType, result, "visible", tx)
        } else if (row.state === "pending" && input.decision === "reject")
          await update(revision.recordType, row.documentId, {
            state: "rejected",
          })
        await audit(
          actor,
          desired,
          revision.recordType,
          row.documentId,
          revision.threadId,
          {
            revisionId: revision.documentId,
            note,
            contributorFeedback: feedback,
            exceptionReason,
            version: recordVersion,
          }
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
            tx,
            text(
              input.contributorFeedback,
              "contributor feedback",
              2000,
              true
            ) || "This message was removed by the moderators."
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
          dedupeKey = fingerprint(
            kind,
            row.documentId,
            actor.key,
            String(row.version),
            "open"
          )
        const existing = await query("report").findOne({
          where: { dedupeKey, state: "open" },
        })
        if (existing) return { id: existing.documentId, state: existing.state }
        const historical = await query("report").findOne({
          where: {
            recordType: kind,
            recordId: row.documentId,
            reporterKey: actor.key,
            recordVersion: row.version,
          },
        })
        if (historical)
          return { id: historical.documentId, state: historical.state }
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
          snapshotAttachments: row.attachments ?? [],
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
      moderationGate(actor)
      const rows = await scan(
        "report",
        { state: "open" },
        { id: "asc" },
        async (report) => {
          const thread = await required("thread", report.threadId),
            subject = await required("subject", thread.subjectId),
            record = await required(report.recordType, report.recordId)
          if (!(await recordModerator(actor, subject, thread, record)))
            return false
          if (!actor.admin && thread.target) {
            try {
              await resolveTarget(strapi, config, actor, thread.target)
            } catch (error: any) {
              if (error.status === 404) return false
              throw error
            }
          }

          return true
        }
      )
      const data = []
      for (const report of rows.slice(
        pagination.offset,
        pagination.offset + pagination.limit
      )) {
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
          reportedAttachments: await attachmentDtos(report.snapshotAttachments),
          currentAttachments: await attachmentDtos(record.attachments),
          recordVersion: report.recordVersion,
          currentBody: record.body,
          currentTitle: record.title,
          currentVersion: record.version,
          currentState: record.state,
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
        total: rows.length,
        nextOffset:
          rows.length > pagination.offset + pagination.limit
            ? pagination.offset + pagination.limit
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
          await remove(
            actor,
            report.recordType,
            current,
            note,
            tx,
            text(
              input.contributorFeedback,
              "contributor feedback",
              2000,
              true
            ) || "This message was removed after a report."
          )
        }
        await update("report", report.documentId, {
          state: input.decision === "dismiss" ? "dismissed" : "actioned",
          dedupeKey: fingerprint("closed", report.documentId),
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
          dedupeKey: fingerprint("closed", report.documentId),
          version: report.version + 1,
        }
      })
    },
    async imageAdmission(actorInput: Actor | null) {
      const actor = authenticated(actorInput)
      if (!actor.capabilities?.includes("upload"))
        fail(403, "Discussion upload permission denied")
      if (
        await query("erased-actor").findOne({
          where: { actorHash: fingerprint("erased", actor.key) },
        })
      )
        fail(401, "Discussion identity was erased")
      const window = await query("rate-window").findOne({
        where: { actorKey: actor.key },
      })
      if (
        window &&
        Date.now() - new Date(window.windowStartedAt).getTime() < 3600000 &&
        window.actions >= config.maxWritesPerHour
      )
        fail(429, "Discussion write limit reached; try again later")
      const owned = await query("attachment").findMany({
        where: { ownerKey: actor.key },
        limit: config.maxImagesPerActor,
      })
      if (owned.length >= config.maxImagesPerActor)
        fail(429, "Discussion image quota reached")
    },
    async uploadImage(
      actorInput: Actor | null,
      value: unknown,
      bytes: Uint8Array
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        subject = await required("subject", id(input.subjectId))
      await requirePermission(strapi, config, actor, "upload", subject)
      const altText = text(input.altText, "image alternative text", 250),
        caption = text(input.caption, "image caption", 500, true)
      if (!bytes.length || bytes.length > config.maxImageBytes)
        fail(413, "Discussion image exceeds size limit")
      const storageKey = randomUUID()
      let written = false
      try {
        return await strapi.db.transaction(async ({ trx }: any) => {
          await consume(trx, actor)
          await requirePermission(strapi, config, actor, "upload", subject)
          const owned = await query("attachment").findMany({
            where: { ownerKey: actor.key },
            limit: config.maxImagesPerActor,
          })
          if (owned.length >= config.maxImagesPerActor)
            fail(429, "Discussion image quota reached")
          const converted = await sanitiseImage(bytes, config.maxImageBytes)
          await storage.put(storageKey, converted.bytes)
          written = true
          const row = await create("attachment", {
            ownerKey: actor.key,
            subjectId: subject.documentId,
            storageKey,
            mime: converted.mime,
            bytes: converted.bytes.length,
            width: converted.width,
            height: converted.height,
            altText,
            caption,
          })

          return {
            id: row.documentId,
            altText,
            caption,
            width: row.width,
            height: row.height,
            mime: row.mime,
          }
        })
      } catch (error) {
        if (written) await storage.delete(storageKey)
        throw error
      }
    },
    async image(actor: Actor | null, attachmentId: string) {
      const attachment = await required("attachment", id(attachmentId)),
        subject = await required("subject", attachment.subjectId)
      if (
        attachment.retired ||
        !(await permitted(strapi, config, actor, "read", subject))
      )
        fail(404, "Discussion image unavailable")
      if (
        attachment.ownerKey !== actor?.key &&
        !(await isPublishedImage(attachment.documentId, actor)) &&
        !(await canReviewImage(attachment.documentId, actor))
      )
        fail(404, "Discussion image unavailable")
      const bytes = await storage.get(attachment.storageKey)
      if (!bytes) return fail(404, "Discussion image unavailable")
      if (bytes.length > config.maxImageBytes)
        fail(413, "Discussion image exceeds limit")

      return { bytes, mime: attachment.mime }
    },
    async cleanupImages() {
      const cutoff = new Date(
        Date.now() - config.stagingRetentionHours * 3600000
      ).toISOString()
      const assets = await query("attachment").findMany({
        where: { $or: [{ retired: true }, { createdAt: { $lt: cutoff } }] },
        limit: 100,
        orderBy: { id: "asc" },
      })
      let removed = 0
      for (const asset of assets)
        await strapi.db.transaction(async (tx: any) => {
          await lockActor(tx.trx, asset.ownerKey)
          const current = await find("attachment", asset.documentId)
          if (!current || (!current.retired && current.createdAt >= cutoff))
            return
          // Publication and proposal creation serialize on the actor/thread locks. Re-read references
          // only after acquiring these locks; the initial cleanup scan is never deletion authority.
          const [threads, replies, revisions, reports] = await Promise.all([
            query("thread").findMany({ limit: config.maxScanEntries + 1 }),
            query("reply").findMany({ limit: config.maxScanEntries + 1 }),
            query("revision").findMany({
              where: { state: "pending" },
              limit: config.maxScanEntries + 1,
            }),
            query("report").findMany({
              where: { state: "open" },
              limit: config.maxScanEntries + 1,
            }),
          ])
          if (
            [threads, replies, revisions, reports].some(
              (rows) => rows.length > config.maxScanEntries
            )
          )
            return
          const references = (row: any, field = "attachments") =>
            row[field]?.some((image: any) => image.id === asset.documentId)
          const ids = [
            ...new Set<string>([
              ...threads
                .filter((row: any) => references(row))
                .map((row: any) => row.documentId),
              ...replies
                .filter((row: any) => references(row))
                .map((row: any) => row.threadId),
              ...revisions
                .filter((row: any) => references(row))
                .map((row: any) => row.threadId),
              ...reports
                .filter((row: any) => references(row, "snapshotAttachments"))
                .map((row: any) => row.threadId),
            ]),
          ].sort()
          for (const threadId of ids)
            if (await find("thread", threadId))
              await lock(tx.trx, "thread", threadId)
          if (!current.retired) {
            const pending = await query("revision").findMany({
              where: { state: "pending" },
              limit: config.maxScanEntries + 1,
            })
            const openReports = await query("report").findMany({
              where: { state: "open" },
              limit: config.maxScanEntries + 1,
            })
            if (
              [pending, openReports].some(
                (rows) => rows.length > config.maxScanEntries
              ) ||
              pending.some((row: any) => references(row)) ||
              openReports.some((row: any) =>
                references(row, "snapshotAttachments")
              ) ||
              (await hasApprovedImage(asset.documentId))
            )
              return
          }
          await update("attachment", asset.documentId, { retired: true })
          tx.onCommit(() =>
            deleteRetiredImage(asset.documentId, asset.storageKey)
          )
          removed++
        })
      if (storage.prune) {
        const retained = await query("attachment").findMany({
          limit: config.maxScanEntries + 1,
        })
        if (retained.length <= config.maxScanEntries)
          await storage.prune(
            new Set(retained.map((row: any) => row.storageKey)),
            new Date(cutoff),
            100
          )
      }

      return { removed }
    },
    async react(
      actorInput: Actor | null,
      kind: "thread" | "reply",
      recordId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required(kind, id(recordId))
      if (!["like", "love", null].includes(input.reaction))
        fail(400, "Invalid reaction")

      return strapi.db.transaction(async ({ trx }: any) => {
        await consume(trx, actor)
        const threadId =
          kind === "thread" ? initial.documentId : initial.threadId
        await lock(trx, "thread", threadId)
        const ctx = await context(threadId, actor, true),
          row = await required(kind, initial.documentId)
        if (
          row.state !== "visible" ||
          (kind === "reply" &&
            !(await replyReadable(row, ctx.thread, actor, ctx.moderator, true)))
        )
          fail(404, "Discussion record unavailable")
        await requirePermission(
          strapi,
          config,
          actor,
          "react",
          ctx.subject,
          ctx.thread,
          row.language
        )
        const dedupeKey = fingerprint(kind, row.documentId, actor.key),
          current = await query("reaction").findOne({ where: { dedupeKey } })
        if (
          current &&
          (input.reaction === null || current.value === input.reaction)
        )
          await query("reaction").deleteMany({ where: { dedupeKey } })
        else if (input.reaction) {
          await (current
            ? update("reaction", current.documentId, {
                value: input.reaction,
              })
            : create("reaction", {
                recordType: kind,
                recordId: row.documentId,
                threadId,
                actorKey: actor.key,
                value: input.reaction,
                dedupeKey,
              }))
        }

        return reactions(kind, row, actor)
      })
    },
    async myStatus(actorInput: Actor | null) {
      const actor = authenticated(actorInput)
      const rows = await query("sanction").findMany({
        where: {
          actorKey: actor.key,
          active: true,
          $or: [{ expiresAt: null }, { expiresAt: { $gt: now() } }],
        },
        limit: 101,
      })
      if (rows.length > 100)
        fail(503, "Discussion restrictions temporarily unavailable")

      return {
        data: rows.map((row: any) => ({
          id: row.documentId,
          mode: row.mode,
          subjectId: row.subjectId ?? null,
          reason: row.contributorFeedback,
          expiresAt: row.expiresAt,
          appeal: row.appeal ?? null,
          version: row.version,
          canAppeal:
            !row.lastAppealedAt ||
            Date.now() - new Date(row.lastAppealedAt).getTime() >= 3600000,
        })),
      }
    },
    async sanctions(actorInput: Actor | null, params: any = {}) {
      const actor = authenticated(actorInput)
      moderationGate(actor)
      if (
        params.state !== undefined &&
        !["active", "lifted"].includes(params.state)
      )
        fail(400, "Invalid sanction state")
      const rows = await scan(
        "sanction",
        { active: params.state !== "lifted" },
        { id: "desc" },
        async (sanction) => {
          const thread = await find("thread", sanction.threadId),
            subject = thread && (await find("subject", thread.subjectId))

          return Boolean(
            subject &&
            (await permitted(strapi, config, actor, "read", subject, thread)) &&
            (await permitted(
              strapi,
              config,
              actor,
              "moderate",
              subject,
              thread,
              sanction.language
            ))
          )
        }
      )
      const result = slice(rows, params),
        data = []
      for (const sanction of result.data) {
        const thread = await required("thread", sanction.threadId),
          subject = await required("subject", thread.subjectId),
          row = await required(sanction.recordType, sanction.recordId)
        data.push({
          id: sanction.documentId,
          version: sanction.version,
          active: sanction.active,
          mode: sanction.mode,
          subjectId: sanction.subjectId ?? null,
          subjectName: subject.name,
          recordType: sanction.recordType,
          recordId: sanction.recordId,
          threadId: sanction.threadId,
          language: sanction.language,
          author: await projectedAuthor(row, thread.target),
          reason: sanction.reason,
          contributorFeedback: sanction.contributorFeedback,
          expiresAt: sanction.expiresAt,
          appeal: sanction.appeal ?? null,
          liftReason: sanction.liftReason ?? null,
          canLift: await permitted(
            strapi,
            config,
            actor,
            "sanction",
            subject,
            thread,
            sanction.language,
            sanction.subjectId ? "subject" : "all"
          ),
        })
      }

      return { ...result, data }
    },
    async sanctionRecord(
      actorInput: Actor | null,
      kind: "thread" | "reply",
      recordId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required(kind, id(recordId))
      if (
        !["mute", "ban"].includes(input.mode) ||
        !["subject", "all"].includes(input.scope)
      )
        fail(400, "Invalid sanction")
      const reason = text(input.reason, "private sanction reason", 2000)
      const contributorFeedback = text(
        input.contributorFeedback ??
          "Your discussion participation has been restricted. You may appeal this decision.",
        "contributor feedback",
        2000
      )
      const expiry = input.expiresAt ? new Date(input.expiresAt) : null
      if (
        expiry &&
        (!Number.isFinite(expiry.getTime()) ||
          expiry.getTime() <= Date.now() ||
          expiry.getTime() > Date.now() + 366 * 86400000)
      )
        fail(400, "Invalid sanction expiry")

      return strapi.db.transaction(async (tx: any) => {
        for (const key of [...new Set([actor.key, initial.authorKey])].sort())
          await lockActor(tx.trx, key)
        await activeActor(tx.trx, actor)
        const thread = await lock(
            tx.trx,
            "thread",
            kind === "thread" ? initial.documentId : initial.threadId
          ),
          row = await required(kind, initial.documentId),
          subject = await required("subject", thread.subjectId)
        if (
          row.authorKey !== initial.authorKey ||
          row.authorKey === actor.key ||
          row.authorKey === "erased"
        )
          fail(409, "Sanction target changed or unavailable")
        await requireRecordModeration(actor, subject, thread, row)
        await requirePermission(
          strapi,
          config,
          actor,
          "sanction",
          subject,
          thread,
          row.language,
          input.scope
        )
        if (!actor.admin && thread.target)
          await resolveTarget(strapi, config, actor, thread.target)
        const sanction = await create("sanction", {
          actorKey: row.authorKey,
          subjectId: input.scope === "subject" ? subject.documentId : null,
          recordType: kind,
          recordId: row.documentId,
          threadId: thread.documentId,
          language: row.language,
          mode: input.mode,
          reason,
          contributorFeedback,
          moderatorKey: actor.key,
          expiresAt: expiry?.toISOString() ?? null,
          active: true,
          version: 1,
        })
        await audit(
          actor,
          "sanction_applied",
          kind,
          row.documentId,
          thread.documentId,
          {
            sanctionId: sanction.documentId,
            mode: input.mode,
            scope: input.scope,
            reason,
            contributorFeedback,
          }
        )

        return {
          id: sanction.documentId,
          mode: sanction.mode,
          expiresAt: sanction.expiresAt,
          version: sanction.version,
        }
      })
    },
    async liftSanction(
      actorInput: Actor | null,
      sanctionId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        input = object(value),
        initial = await required("sanction", id(sanctionId))
      const reason = text(input.reason, "private lift reason", 2000),
        contributorFeedback = text(
          input.contributorFeedback,
          "contributor feedback",
          2000
        )

      return strapi.db.transaction(async (tx: any) => {
        for (const key of [...new Set([actor.key, initial.actorKey])].sort())
          await lockActor(tx.trx, key)
        await activeActor(tx.trx, actor)
        const thread = await lock(tx.trx, "thread", initial.threadId),
          sanction = await required("sanction", initial.documentId),
          subject = await required("subject", thread.subjectId)
        await requirePermission(
          strapi,
          config,
          actor,
          "moderate",
          subject,
          thread,
          sanction.language
        )
        await requirePermission(
          strapi,
          config,
          actor,
          "sanction",
          subject,
          thread,
          sanction.language,
          sanction.subjectId ? "subject" : "all"
        )
        if (!sanction.active || version(input.baseVersion) !== sanction.version)
          fail(409, "Sanction changed; reload before lifting")
        await update("sanction", sanction.documentId, {
          active: false,
          version: sanction.version + 1,
          liftReason: reason,
          contributorFeedback,
          liftedBy: actor.key,
        })
        await audit(
          actor,
          "sanction_lifted",
          sanction.recordType,
          sanction.recordId,
          sanction.threadId,
          { sanctionId: sanction.documentId, reason, contributorFeedback }
        )

        return {
          id: sanction.documentId,
          active: false,
          version: sanction.version + 1,
        }
      })
    },
    async appealSanction(
      actorInput: Actor | null,
      sanctionId: string,
      value: unknown
    ) {
      const actor = authenticated(actorInput),
        message = text(object(value).message, "appeal", 2000)

      return strapi.db.transaction(async ({ trx }: any) => {
        await consume(trx, actor)
        const sanction = await required("sanction", id(sanctionId))
        if (
          sanction.actorKey !== actor.key ||
          !sanction.active ||
          (sanction.expiresAt &&
            new Date(sanction.expiresAt).getTime() <= Date.now())
        )
          fail(404, "Sanction unavailable")
        if (
          sanction.lastAppealedAt &&
          Date.now() - new Date(sanction.lastAppealedAt).getTime() < 3600000
        )
          fail(429, "Wait before sending another appeal")
        await update("sanction", sanction.documentId, {
          appeal: message,
          lastAppealedAt: now(),
          version: sanction.version + 1,
        })

        return { received: true, version: sanction.version + 1 }
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
        data: await Promise.all(
          authorized.map(async (row: any) => ({
            id: row.documentId,
            recordType: row.recordType,
            recordId: row.recordId,
            action: row.action,
            detail: row.detail,
            createdAt: row.createdAt,
            actor:
              config.publicAuthor && row.actorKey
                ? await projectedAuthor({ authorKey: row.actorKey })
                : null,
            ...(actor.admin ? { actorKey: row.actorKey } : {}),
          }))
        ),
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
                    attachments: [],
                    quote: null,
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
        await query("reaction").deleteMany({ where: { actorKey: key } })
        await query("sanction").deleteMany({ where: { actorKey: key } })
        await query("sanction").updateMany({
          where: { moderatorKey: key },
          data: { moderatorKey: "erased", reason: "", liftReason: "" },
        })
        await query("sanction").updateMany({
          where: { liftedBy: key },
          data: { liftedBy: "erased", liftReason: "" },
        })
        await query("context-link").deleteMany({
          where: {
            actorKey: key,
            state: { $in: ["pending", "rejected", "removed"] },
          },
        })
        await query("context-link").updateMany({
          where: { actorKey: key },
          data: { actorKey: "erased", moderationFeedback: null },
        })
        await query("report").deleteMany({ where: { reporterKey: key } })
        await query("report").updateMany({
          where: { reviewerKey: key },
          data: { reviewerKey: "erased", reviewNote: null },
        })
        await query("revision").deleteMany({
          where: {
            authorKey: key,
            state: { $in: ["pending", "rejected", "changes_requested"] },
          },
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
                      ([field]) =>
                        ![
                          "note",
                          "reason",
                          "liftReason",
                          "exceptionReason",
                        ].includes(field)
                    )
                  )
                : null,
          })
        const images = await query("attachment").findMany({
          where: { ownerKey: key },
        })
        for (const image of images) {
          if (await hasApprovedImage(image.documentId))
            await update("attachment", image.documentId, { ownerKey: "erased" })
          else {
            await update("attachment", image.documentId, {
              ownerKey: "erased",
              retired: true,
              altText: "",
              caption: "",
            })
            tx.onCommit(() =>
              deleteRetiredImage(image.documentId, image.storageKey)
            )
          }
        }
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
