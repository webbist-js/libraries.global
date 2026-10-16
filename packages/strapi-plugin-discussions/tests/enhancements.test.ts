import { randomUUID } from "node:crypto"

import sharp from "sharp"
import { afterEach, describe, expect, it, vi } from "vitest"

import { harness } from "./harness"
import type { Actor } from "../server/contracts"
import plugin from "../server/index"

const writer: Actor = {
  key: "user:writer",
  name: "Writer",
  capabilities: [
    "read",
    "createThread",
    "reply",
    "editOwn",
    "report",
    "subscribe",
    "react",
    "upload",
  ],
}
const reader: Actor = { ...writer, key: "user:reader", name: "Reader" }
const moderator: Actor = {
  ...writer,
  key: "user:moderator",
  name: "Moderator",
  capabilities: [...writer.capabilities!, "moderate", "sanction"],
}
const admin: Actor = { key: "admin:1", name: "Administrator", admin: true }
const png = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
    .png()
    .toBuffer()
async function fixture(options: Record<string, any> = {}) {
  const files = new Map<string, Uint8Array>()
  const mediaStore = {
    put: vi.fn(async (key: string, bytes: Uint8Array) => {
      files.set(key, bytes)
    }),
    get: async (key: string) => files.get(key) ?? null,
    delete: vi.fn(async (key: string) => {
      files.delete(key)
    }),
  }
  const db = harness({ mediaStore, ...options })
  const subject = await db.service.saveSubject(admin, {
    name: "Library visits",
    slug: "visits",
    visibility: "public",
    createPolicy: "members",
    languages: ["en", "es"],
  })
  const pending = await db.service.createThread(writer, {
    subjectId: subject.documentId,
    title: "Visit Colombia",
    body: "Libraries and books",
    language: "en",
  })
  await db.service.review(moderator, pending.revision.id, {
    decision: "approve",
    baseVersion: 0,
  })

  return { ...db, subject, threadId: pending.thread.id, files, mediaStore }
}
async function reply(
  db: Awaited<ReturnType<typeof fixture>>,
  body: string,
  options: any = {},
  actor = reader
) {
  const proposal = await db.service.createReply(actor, db.threadId, {
    body,
    ...options,
  })
  await db.service.review(moderator, proposal.revision.id, {
    decision: "approve",
    baseVersion: 0,
  })

  return proposal.reply.id
}
async function image(
  db: Awaited<ReturnType<typeof fixture>>,
  altText = "Reading room"
) {
  return db.service.uploadImage(
    writer,
    { subjectId: db.subject.documentId, altText },
    await png()
  )
}

describe("community discovery and participation", () => {
  it("toggles one reaction per actor and returns real subscription/count state", async () => {
    const db = await fixture()
    await db.service.react(reader, "thread", db.threadId, { reaction: "like" })
    expect(
      await db.service.react(reader, "thread", db.threadId, {
        reaction: "love",
      })
    ).toEqual({ reactions: { like: 0, love: 1 }, myReaction: "love" })
    await db.service.subscribe(reader, db.threadId, true)
    const dto = await db.service.getThread(reader, db.threadId)
    expect(dto).toMatchObject({
      subscribed: true,
      replyCount: 0,
      reactions: { like: 0, love: 1 },
      myReaction: "love",
      viewer: { canReact: true, canReply: true },
    })
    expect(
      (await db.service.getThread(null, db.threadId)).myReaction
    ).toBeNull()
    expect(JSON.stringify(dto)).not.toContain(reader.key)
    expect(
      await db.service.react(reader, "thread", db.threadId, {
        reaction: "love",
      })
    ).toEqual({ reactions: { like: 0, love: 0 }, myReaction: null })
    expect(db.rows("reaction")).toHaveLength(0)
    await expect(
      db.service.react(null, "thread", db.threadId, { reaction: "like" })
    ).rejects.toMatchObject({ status: 401 })
    await expect(
      db.service.react(reader, "thread", db.threadId, { reaction: "wow" })
    ).rejects.toMatchObject({ status: 400 })
  })
  it("filters current discovery and projects public authors only on the selected page", async () => {
    const publicAuthor = vi.fn(async () => ({ name: "Member" }))
    const db = await fixture({ publicAuthor })
    const second = await db.service.createThread(writer, {
      subjectId: db.subject.documentId,
      title: "Archive visit",
      body: "History and collections",
      language: "es",
    })
    await db.service.review(moderator, second.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    await reply(db, "A useful answer")
    await db.service.subscribe(reader, db.threadId, true)
    expect(
      (await db.service.listThreads(reader, { view: "following" })).data.map(
        (row: any) => row.id
      )
    ).toEqual([db.threadId])
    expect(
      (await db.service.listThreads(null, { view: "unanswered" })).data.map(
        (row: any) => row.id
      )
    ).toEqual([second.thread.id])
    expect(
      (await db.service.listThreads(null, { q: "colombia", language: "en" }))
        .data[0]
    ).toMatchObject({
      id: db.threadId,
      replyCount: 1,
      excerpt: "Libraries and books",
    })
    expect((await db.service.listSubjects(null)).data[0].threadCount).toBe(2)
    publicAuthor.mockClear()
    expect((await db.service.listThreads(null, { limit: 1 })).nextOffset).toBe(
      1
    )
    expect(publicAuthor).toHaveBeenCalledTimes(1)
    await expect(
      db.service.listThreads(null, { view: "following" })
    ).rejects.toMatchObject({ status: 401 })
  })
  it("orders root replies with their children and never leaks an unreadable parent excerpt", async () => {
    const db = await fixture({
      authorize: async ({ actor, action, recordLanguage }: any) =>
        !(action === "read" && !actor && recordLanguage === "es"),
    })
    const parent = await reply(db, "Private by language", { language: "es" })
    const root = await reply(db, "Other root")
    const child = await reply(db, "English child", {
      parentId: parent,
      language: "en",
    })
    const authenticated = await db.service.listReplies(reader, db.threadId)
    expect(authenticated.data.map((row: any) => row.id)).toEqual([
      parent,
      child,
      root,
    ])
    const publicRows = (await db.service.listReplies(null, db.threadId)).data
    expect(publicRows.find((row: any) => row.id === child)).toMatchObject({
      subjectId: db.subject.documentId,
      parent: null,
    })
    expect(JSON.stringify(publicRows)).not.toContain("Private by language")
  })
  it("never republishes a quoted excerpt after its source was corrected or removed", async () => {
    const db = await fixture()
    const source = await reply(db, "Old personal details")
    const quote = await reply(db, "Responding", {
      quote: { kind: "reply", id: source, version: 1 },
    })
    const quoted = () =>
      db.service
        .listReplies(null, db.threadId)
        .then(
          (value: any) => value.data.find((row: any) => row.id === quote).quote
        )
    expect(await quoted()).toMatchObject({
      available: true,
      excerpt: "Old personal details",
    })
    const correction = await db.service.edit(reader, "reply", source, {
      body: "Corrected",
      baseVersion: 1,
    })
    await db.service.review(moderator, correction.id, {
      decision: "approve",
      baseVersion: 1,
    })
    expect(await quoted()).toEqual({
      kind: "reply",
      id: source,
      version: 1,
      available: false,
    })
    await db.service.moderate(moderator, "reply", source, {
      action: "remove",
      baseVersion: 2,
    })
    expect(JSON.stringify(await quoted())).not.toContain("Old personal details")
    expect(await quoted()).toMatchObject({ available: false })
  })
  it("limits outstanding proposals transactionally and gives authors explicit feedback, never private notes", async () => {
    const db = await fixture({ maxPendingPerActor: 1 })
    const first = await db.service.edit(writer, "thread", db.threadId, {
      body: "Proposal one",
      baseVersion: 1,
    })
    await expect(
      db.service.edit(writer, "thread", db.threadId, {
        body: "Proposal two",
        baseVersion: 1,
      })
    ).rejects.toMatchObject({ status: 429 })
    expect(
      db.rows("revision").filter((row) => row.state === "pending")
    ).toHaveLength(1)
    await db.service.review(moderator, first.id, {
      decision: "request_changes",
      baseVersion: 1,
      note: "Private internal assessment",
      contributorFeedback: "Please include the library name.",
    })
    const owned = (await db.service.myRecords(writer, "thread")).data[0]
    expect(owned.latestRevision).toMatchObject({
      state: "changes_requested",
      feedback: "Please include the library name.",
      body: "Proposal one",
    })
    expect(JSON.stringify(owned)).not.toContain("Private internal assessment")
    await db.service.edit(writer, "thread", db.threadId, {
      body: "Library named",
      baseVersion: 1,
    })
  })
  it("deduplicates repeated reports for a version but accepts changed content after a closed report", async () => {
    const db = await fixture()
    const first = await db.service.report(reader, "thread", db.threadId, {
      reason: "Concern",
    })
    await db.service.decideReport(moderator, first.id, {
      decision: "dismiss",
      baseVersion: 0,
    })
    expect(
      (
        await db.service.report(reader, "thread", db.threadId, {
          reason: "Same concern",
        })
      ).id
    ).toBe(first.id)
    const correction = await db.service.edit(writer, "thread", db.threadId, {
      body: "Changed text",
      baseVersion: 1,
    })
    await db.service.review(moderator, correction.id, {
      decision: "approve",
      baseVersion: 1,
    })
    const next = await db.service.report(reader, "thread", db.threadId, {
      reason: "New concern",
    })
    expect(next.id).not.toBe(first.id)
    expect(
      (
        await db.service.report(reader, "thread", db.threadId, {
          reason: "Repeated new concern",
        })
      ).id
    ).toBe(next.id)
    expect(db.rows("report")).toHaveLength(2)
  })
  it("rejects queue occupancy probes before scanning and paginates authorized rows only", async () => {
    const db = await fixture({
      authorize: async ({ actor, action, recordLanguage }: any) =>
        actor?.key !== moderator.key ||
        action !== "moderate" ||
        recordLanguage === "en",
    })
    const es = await db.service.createReply(reader, db.threadId, {
      body: "Hidden Spanish proposal",
      language: "es",
    })
    const en = await db.service.createReply(reader, db.threadId, {
      body: "Visible English proposal",
      language: "en",
    })
    const query = vi.spyOn(db.strapi.db, "query")
    await expect(db.service.reviewQueue(reader)).rejects.toMatchObject({
      status: 403,
    })
    await expect(db.service.reports(reader)).rejects.toMatchObject({
      status: 403,
    })
    expect(query).not.toHaveBeenCalled()
    const page = await db.service.reviewQueue(moderator, { limit: 1 })
    expect(page.data.map((row: any) => row.id)).toEqual([en.revision.id])
    expect(page.nextOffset).toBeNull()
    expect(JSON.stringify(page)).not.toContain(es.revision.id)
  })
  it("paginates report queues only after applying the moderator's reply language scope", async () => {
    const db = await fixture({
      authorize: async ({ actor, action, recordLanguage }: any) =>
        actor?.key !== moderator.key ||
        action !== "moderate" ||
        recordLanguage === "en",
    })
    const es = await db.service.createReply(reader, db.threadId, {
      body: "Spanish report",
      language: "es",
    })
    await db.service.review(admin, es.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    await db.service.report(reader, "reply", es.reply.id, {
      reason: "Spanish concern",
    })
    const en = await db.service.report(reader, "thread", db.threadId, {
      reason: "English concern",
    })
    const page = await db.service.reports(moderator, { limit: 1 })
    expect(page.data.map((row: any) => row.id)).toEqual([en.id])
    expect(page.nextOffset).toBeNull()
    expect(JSON.stringify(page)).not.toContain("Spanish concern")
  })
})

describe("private picture lifecycle and content policy", () => {
  it("decodes and strips uploaded images and denies strangers until approved, then hides removed bytes", async () => {
    const db = await fixture()
    const staged = await image(db)
    expect(staged).toMatchObject({ mime: "image/webp", width: 8, height: 8 })
    await expect(db.service.image(null, staged.id)).rejects.toMatchObject({
      status: 404,
    })
    await expect(db.service.image(reader, staged.id)).rejects.toMatchObject({
      status: 404,
    })
    expect((await db.service.image(writer, staged.id)).bytes).toBeInstanceOf(
      Buffer
    )
    await expect(
      db.service.edit(reader, "thread", db.threadId, {
        body: "Borrowed",
        baseVersion: 1,
        attachments: [{ id: staged.id }],
      })
    ).rejects.toMatchObject({ status: 403 })
    const proposal = await db.service.edit(writer, "thread", db.threadId, {
      body: "Photo visit",
      baseVersion: 1,
      attachments: [{ id: staged.id }],
    })
    expect((await db.service.image(moderator, staged.id)).mime).toBe(
      "image/webp"
    )
    await db.service.review(moderator, proposal.id, {
      decision: "approve",
      baseVersion: 1,
    })
    expect(
      (await db.service.getThread(null, db.threadId)).attachments[0].id
    ).toBe(staged.id)
    expect(
      (await sharp((await db.service.image(null, staged.id)).bytes).metadata())
        .format
    ).toBe("webp")
    await db.service.moderate(moderator, "thread", db.threadId, {
      action: "remove",
      baseVersion: 2,
    })
    await expect(db.service.image(null, staged.id)).rejects.toMatchObject({
      status: 404,
    })
    await expect(db.service.image(reader, staged.id)).rejects.toMatchObject({
      status: 404,
    })
  })
  it("rejects SVG, corrupt bytes, unauthorized subjects, size and quota before decoding", async () => {
    const db = await fixture({ maxImagesPerActor: 1 })
    await expect(
      db.service.uploadImage(
        writer,
        { subjectId: db.subject.documentId, altText: "SVG" },
        Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg" width="5" height="5"/>'
        )
      )
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      db.service.uploadImage(
        writer,
        { subjectId: db.subject.documentId, altText: "Broken" },
        Buffer.from("not an image")
      )
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      db.service.uploadImage(
        writer,
        { subjectId: db.subject.documentId, altText: "Big" },
        new Uint8Array(4 * 1024 * 1024 + 1)
      )
    ).rejects.toMatchObject({ status: 413 })
    await image(db)
    // A decode failure would be 400; quota admission must reject first, with no stored bytes.
    await expect(
      db.service.uploadImage(
        writer,
        { subjectId: db.subject.documentId, altText: "Quota" },
        Buffer.from("bad")
      )
    ).rejects.toMatchObject({ status: 429 })
    expect(db.mediaStore.put).toHaveBeenCalledTimes(1)
    await expect(
      db.service.uploadImage(
        { ...writer, capabilities: ["read"] },
        { subjectId: db.subject.documentId, altText: "Denied" },
        await png()
      )
    ).rejects.toMatchObject({ status: 403 })
  })
  it("retains approved media across target withdrawal and restores its checked delivery after republishing", async () => {
    let readable = true
    const db = await fixture({
      targets: {
        "api::article.article": async () =>
          readable ? { title: "Source", url: "/source" } : null,
      },
    })
    Object.assign(db.rows("thread")[0], {
      target: { uid: "api::article.article", documentId: "source" },
    })
    const staged = await image(db)
    const proposal = await db.service.edit(writer, "thread", db.threadId, {
      body: "Photo",
      baseVersion: 1,
      attachments: [{ id: staged.id }],
    })
    await db.service.review(moderator, proposal.id, {
      decision: "approve",
      baseVersion: 1,
    })
    db.rows("attachment")[0].createdAt = "2000-01-01T00:00:00.000Z"
    readable = false
    await expect(db.service.image(null, staged.id)).rejects.toMatchObject({
      status: 404,
    })
    await db.service.cleanupImages()
    expect(db.rows("attachment")[0].retired).toBe(false)
    await db.service.eraseActor(writer.key)
    expect(db.rows("attachment")[0].ownerKey).toBe("erased")
    readable = true
    expect((await db.service.image(null, staged.id)).mime).toBe("image/webp")
  })
  it("masks body and image descriptions publicly, retaining flagged originals for review and explicit exceptions", async () => {
    const db = await fixture({ profanityTerms: { en: ["swear"] } })
    const staged = await image(db, "A swear sign")
    const proposal = await db.service.edit(writer, "thread", db.threadId, {
      title: "Visit",
      body: "A swear quotation",
      baseVersion: 1,
      attachments: [{ id: staged.id, caption: "swear caption" }],
    })
    const privateRow = (await db.service.reviewQueue(moderator)).data[0]
    expect(privateRow).toMatchObject({
      body: "A swear quotation",
      contentFlags: { covered: true, terms: ["swear"] },
      attachments: [{ altText: "A swear sign", caption: "swear caption" }],
    })
    await db.service.review(moderator, proposal.id, {
      decision: "approve",
      baseVersion: 1,
    })
    expect(await db.service.getThread(null, db.threadId)).toMatchObject({
      body: "A ••••• quotation",
      attachments: [{ altText: "A ••••• sign", caption: "••••• caption" }],
    })
    const exception = await db.service.edit(writer, "thread", db.threadId, {
      body: "A swear quotation",
      baseVersion: 2,
    })
    await db.service.review(moderator, exception.id, {
      decision: "approve",
      baseVersion: 2,
      profanityException: true,
      exceptionReason: "Relevant historical quotation",
    })
    expect(
      (await db.service.getThread(null, db.threadId)).attachments[0].caption
    ).toBe("swear caption")
    expect(db.rows("audit-event").at(-1).detail.exceptionReason).toBe(
      "Relevant historical quotation"
    )
  })
  it("preserves approved/pending/report references and retries failed erasure deletion durably", async () => {
    const db = await fixture()
    const staged = await image(db),
      orphan = await image(db, "Unused")
    db.rows("attachment").forEach((row) => {
      row.createdAt = "2000-01-01T00:00:00.000Z"
    })
    const proposal = await db.service.edit(writer, "thread", db.threadId, {
      body: "Photo visit",
      baseVersion: 1,
      attachments: [{ id: staged.id }],
    })
    await db.service.cleanupImages()
    expect(
      db.rows("attachment").find((row) => row.documentId === staged.id).retired
    ).toBe(false)
    expect(
      db.rows("attachment").find((row) => row.documentId === orphan.id).retired
    ).toBe(true)
    await Promise.all(db.committed.splice(0).map((hook) => hook()))
    await db.service.review(moderator, proposal.id, {
      decision: "approve",
      baseVersion: 1,
    })
    const report = await db.service.report(reader, "thread", db.threadId, {
      reason: "Picture concern",
    })
    await db.service.moderate(moderator, "thread", db.threadId, {
      action: "remove",
      baseVersion: 2,
    })
    expect(
      (await db.service.reports(moderator)).data[0].reportedAttachments[0].id
    ).toBe(staged.id)
    expect((await db.service.image(moderator, staged.id)).mime).toBe(
      "image/webp"
    )
    await db.service.cleanupImages()
    expect(
      db.rows("attachment").find((row) => row.documentId === staged.id).retired
    ).toBe(false)
    db.mediaStore.delete.mockRejectedValueOnce(
      new Error("Storage temporarily unavailable")
    )
    await db.service.eraseActor(writer.key)
    await Promise.all(db.committed.splice(0).map((hook) => hook()))
    expect(db.rows("attachment").some((row) => row.retired)).toBe(true)
    await db.service.cleanupImages()
    await Promise.all(db.committed.splice(0).map((hook) => hook()))
    expect(db.rows("attachment")).toHaveLength(0)
    expect(db.files.size).toBe(0)
    expect(report.state).toBe("open")
  })
  it("rechecks publication after cleanup waits for a thread lock", async () => {
    const db = await fixture()
    const staged = await image(db)
    db.rows("attachment")[0].createdAt = "2000-01-01T00:00:00.000Z"
    const proposal = await db.service.edit(writer, "thread", db.threadId, {
      body: "Photo",
      baseVersion: 1,
      attachments: [{ id: staged.id }],
    })
    const original = db.strapi.db.transaction
    db.strapi.db.transaction = async (fn: any) =>
      original(async (tx: any) => {
        const originalTrx = tx.trx
        const trx = (table: string) => {
          const builder = originalTrx(table)
          if (table === "thread")
            builder.where = () => ({
              forUpdate: () => ({
                first: async () => {
                  // Simulate an approval committing while cleanup waited on the parent row lock.
                  const revision = db
                    .rows("revision")
                    .find((row) => row.documentId === proposal.id)
                  revision.state = "approved"
                  Object.assign(db.rows("thread")[0], {
                    attachments: revision.attachments,
                    body: revision.body,
                    version: 2,
                  })
                },
              }),
            })

          return builder
        }

        return fn({ ...tx, trx })
      })
    await db.service.cleanupImages()
    expect(db.rows("attachment")[0].retired).toBe(false)
    expect(db.mediaStore.delete).not.toHaveBeenCalled()
  })
})

describe("sanction and background retry lifecycle", () => {
  afterEach(() => {
    vi.useRealTimers()
  })
  it("enforces current sanctions, permits own rate-bounded appeal, and lifts with scope/version checks", async () => {
    const db = await fixture()
    const sanction = await db.service.sanctionRecord(
      moderator,
      "thread",
      db.threadId,
      {
        mode: "ban",
        scope: "subject",
        reason: "Private evidence",
        contributorFeedback: "Please stop posting abuse.",
      }
    )
    await expect(
      db.service.createReply(writer, db.threadId, { body: "Blocked" })
    ).rejects.toMatchObject({ status: 404 })
    const own = await db.service.myStatus(writer)
    expect(own.data[0]).toMatchObject({
      id: sanction.id,
      reason: "Please stop posting abuse.",
      version: 1,
    })
    expect(JSON.stringify(own)).not.toContain("Private evidence")
    await expect(
      db.service.appealSanction(reader, sanction.id, {
        message: "Other person",
      })
    ).rejects.toMatchObject({ status: 404 })
    await db.service.appealSanction(writer, sanction.id, {
      message: "Please review",
    })
    await expect(
      db.service.appealSanction(writer, sanction.id, { message: "Again" })
    ).rejects.toMatchObject({ status: 429 })
    expect((await db.service.sanctions(moderator)).data[0]).toMatchObject({
      appeal: "Please review",
      version: 2,
      canLift: true,
    })
    await expect(
      db.service.liftSanction(moderator, sanction.id, {
        baseVersion: 1,
        reason: "Stale",
        contributorFeedback: "Welcome back",
      })
    ).rejects.toMatchObject({ status: 409 })
    await db.service.liftSanction(moderator, sanction.id, {
      baseVersion: 2,
      reason: "Evidence reviewed",
      contributorFeedback: "Your restriction has been lifted.",
    })
    expect((await db.service.myStatus(writer)).data).toEqual([])
    await db.service.createReply(writer, db.threadId, { body: "Allowed again" })
    expect(
      db.rows("audit-event").some((row) => row.action === "sanction_lifted")
    ).toBe(true)
  })
  it("scrubs new internal sanction/audit notes when their moderator is erased", async () => {
    const db = await fixture()
    await db.service.sanctionRecord(moderator, "thread", db.threadId, {
      mode: "mute",
      scope: "subject",
      reason: "Private moderator evidence",
      contributorFeedback: "Please revise your conduct.",
    })
    await db.service.eraseActor(moderator.key)
    expect(db.rows("sanction")[0].moderatorKey).toBe("erased")
    expect(
      JSON.stringify([db.rows("sanction"), db.rows("audit-event")])
    ).not.toContain("Private moderator evidence")
    expect(db.rows("sanction")[0].contributorFeedback).toBe(
      "Please revise your conduct."
    )
  })
  it("cannot hide a new ban behind 101 expired active rows", async () => {
    const db = await fixture()
    for (let i = 0; i < 101; i++)
      db.seed("sanction", {
        documentId: randomUUID(),
        actorKey: writer.key,
        subjectId: null,
        mode: "ban",
        expiresAt: "2000-01-01T00:00:00.000Z",
        active: true,
      })
    await db.service.sanctionRecord(moderator, "thread", db.threadId, {
      mode: "ban",
      scope: "all",
      reason: "Abuse",
    })
    await expect(
      db.service.getThread(writer, db.threadId)
    ).rejects.toMatchObject({ status: 404 })
    expect((await db.service.myStatus(writer)).data).toHaveLength(1)
  })
  it("requires the stored global sanction scope on lift and keeps locale-scoped queues private", async () => {
    const db = await fixture({
      authorize: async ({
        actor,
        action,
        sanctionScope,
        recordLanguage,
      }: any) =>
        actor?.key !== reader.key ||
        (!(action === "sanction" && sanctionScope === "all") &&
          !(action === "moderate" && recordLanguage === "es")),
    })
    const scoped: Actor = {
      ...reader,
      capabilities: [...reader.capabilities!, "moderate", "sanction"],
    }
    const sanction = await db.service.sanctionRecord(
      moderator,
      "thread",
      db.threadId,
      { mode: "mute", scope: "all", reason: "Global abuse" }
    )
    expect((await db.service.sanctions(scoped)).data[0].canLift).toBe(false)
    await expect(
      db.service.liftSanction(scoped, sanction.id, {
        baseVersion: 1,
        reason: "Out of scope",
        contributorFeedback: "Lifted",
      })
    ).rejects.toMatchObject({ status: 403 })
  })
  it("retries outbox and private image cleanup without cron and clears timers on destroy", async () => {
    vi.useFakeTimers()
    const service = {
      flushNotifications: vi
        .fn()
        .mockRejectedValueOnce(new Error("Transient"))
        .mockResolvedValue(undefined),
      cleanupImages: vi.fn().mockResolvedValue(undefined),
    }
    const strapi: any = {
      service: () => ({ actionProvider: { registerMany: vi.fn() } }),
      plugin: () => ({ service: () => service }),
      log: { warn: vi.fn() },
    }
    await plugin.bootstrap({ strapi })
    await vi.advanceTimersByTimeAsync(60_000)
    expect(service.flushNotifications).toHaveBeenCalledTimes(2)
    expect(service.cleanupImages).toHaveBeenCalledTimes(2)
    await plugin.destroy({ strapi })
    await vi.advanceTimersByTimeAsync(120_000)
    expect(service.flushNotifications).toHaveBeenCalledTimes(2)
  })
})
