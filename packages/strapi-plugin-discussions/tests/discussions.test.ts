import { describe, expect, it, vi } from "vitest"

import { harness } from "./harness"
import { defaults } from "../server/config"
import schemas from "../server/content-types"
import type { Actor } from "../server/contracts"
import { resolveActor } from "../server/identity"
import routes from "../server/routes"
import { safeUrl } from "../server/validation"

const member: Actor = {
  key: "user:1",
  name: "Writer",
  capabilities: [
    "read",
    "createThread",
    "reply",
    "editOwn",
    "report",
    "subscribe",
  ],
}
const other: Actor = { ...member, key: "user:2", name: "Reader" }
const moderator: Actor = {
  ...member,
  key: "user:3",
  name: "Moderator",
  capabilities: [...member.capabilities!, "moderate"],
}
const admin: Actor = { key: "admin:1", name: "Admin", admin: true }
async function fixture(options: Record<string, any> = {}) {
  const db = harness(options)
  const subject = await db.service.saveSubject(admin, {
    name: "Reading",
    slug: "reading",
    description: "Talk about books",
    languages: ["en", "es"],
    visibility: "public",
    createPolicy: "members",
  })
  const created = await db.service.createThread(member, {
    subjectId: subject.documentId,
    title: "An event",
    body: "Initial text",
    language: "en",
    authorKey: "forged",
  })

  return { ...db, subject, thread: created.thread, revision: created.revision }
}
async function publish(db: Awaited<ReturnType<typeof fixture>>) {
  await db.service.review(moderator, db.revision.id, {
    decision: "approve",
    baseVersion: 0,
  })

  return db.service.getThread(null, db.thread.id)
}

describe("discussion workflows and access boundaries", () => {
  it("denies anonymous writes and pending public reads; ignores submitted authority", async () => {
    const db = await fixture()
    await expect(
      db.service.getThread(null, db.thread.id)
    ).rejects.toMatchObject({ status: 404 })
    await expect(db.service.createThread(null, {})).rejects.toMatchObject({
      status: 401,
    })
    expect(db.rows("thread")[0].authorKey).toBe(member.key)
    expect(JSON.stringify(await publish(db))).not.toContain(member.key)
  })
  it("recovers only the authenticated author pending proposals", async () => {
    const db = await fixture()
    expect(
      (await db.service.myRecords(member, "thread")).data[0]
    ).toMatchObject({
      id: db.thread.id,
      pendingRevision: { body: "Initial text" },
    })
    expect((await db.service.myRecords(other, "thread")).data).toEqual([])
    await expect(db.service.myRecords(null, "thread")).rejects.toMatchObject({
      status: 401,
    })
  })
  it("filters author recovery by validated record id beyond the first page", async () => {
    const db = await fixture()
    await db.service.createThread(member, {
      subjectId: db.subject.documentId,
      title: "A newer thread",
      body: "New",
      language: "en",
    })
    expect(
      (
        await db.service.myRecords(member, "thread", {
          limit: 1,
          recordId: db.thread.id,
        })
      ).data[0].id
    ).toBe(db.thread.id)
    expect(
      (await db.service.myRecords(other, "thread", { recordId: db.thread.id }))
        .data
    ).toEqual([])
    await expect(
      db.service.myRecords(member, "thread", { recordId: "x".repeat(129) })
    ).rejects.toMatchObject({ status: 400 })
  })
  it("reprojects public bylines after profile opt-out for every reader", async () => {
    let profile: any = {
      name: "Public Writer",
      slug: "writer",
      url: "/members/writer",
      id: "private-profile-id",
      email: "private@example.invalid",
    }
    const db = await fixture({ publicAuthor: async () => profile })
    await publish(db)
    expect((await db.service.getThread(null, db.thread.id)).author).toEqual({
      name: "Public Writer",
      slug: "writer",
      url: "/members/writer",
    })
    const reply = await db.service.createReply(other, db.thread.id, {
      body: "A reply",
    })
    await db.service.review(moderator, reply.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    profile = { name: "Community member" }
    for (const actor of [null, member]) {
      expect((await db.service.getThread(actor, db.thread.id)).author).toEqual({
        name: "Community member",
      })
      expect(
        (await db.service.listReplies(actor, db.thread.id)).data[0].author
      ).toEqual({ name: "Community member" })
      expect(JSON.stringify(await db.service.listThreads(actor))).not.toContain(
        "/members/writer"
      )
    }
    profile = null
    expect((await db.service.getThread(null, db.thread.id)).author).toBeNull()
    expect(
      (await db.service.myRecords(member, "thread")).data[0].author
    ).toBeNull()
    profile = { name: "Unsafe", url: "//invalid.example" }
    await expect(
      db.service.getThread(null, db.thread.id)
    ).rejects.toMatchObject({ status: 400 })
  })
  it("preserves approved text while an edit awaits review", async () => {
    const db = await fixture()
    await publish(db)
    const revision = await db.service.edit(member, "thread", db.thread.id, {
      body: "Changed",
      title: "Edited title",
      baseVersion: 1,
    })
    expect((await db.service.getThread(null, db.thread.id)).body).toBe(
      "Initial text"
    )
    await db.service.review(moderator, revision.id, {
      decision: "approve",
      baseVersion: 1,
    })
    expect((await db.service.getThread(null, db.thread.id)).body).toBe(
      "Changed"
    )
    expect(db.rows("revision")[0].body).toBe("Initial text")
  })
  it("enforces ownership and private revision projections", async () => {
    const db = await fixture()
    await publish(db)
    await expect(
      db.service.edit(other, "thread", db.thread.id, {
        body: "Stolen",
        baseVersion: 1,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.revisions(other, "thread", db.thread.id)
    ).rejects.toMatchObject({ status: 404 })
    expect(
      await db.service.revisions(member, "thread", db.thread.id)
    ).toMatchObject({ data: [{ body: "Initial text" }] })
    expect(
      JSON.stringify(await db.service.revisions(member, "thread", db.thread.id))
    ).not.toContain("reviewerKey")
  })
  it("denies self review and community moderation without explicit permission", async () => {
    const db = await fixture()
    await expect(
      db.service.review(member, db.revision.id, {
        decision: "approve",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.review(
        { ...member, capabilities: [...member.capabilities!, "moderate"] },
        db.revision.id,
        { decision: "approve", baseVersion: 0 }
      )
    ).rejects.toMatchObject({ status: 403 })
  })
  it("serializes competing reviews and makes the same committed decision idempotent", async () => {
    const db = await fixture()
    const results = await Promise.allSettled([
      db.service.review(moderator, db.revision.id, {
        decision: "approve",
        baseVersion: 0,
      }),
      db.service.review({ ...moderator, key: "user:4" }, db.revision.id, {
        decision: "reject",
        baseVersion: 0,
      }),
    ])
    expect(
      results.filter((result) => result.status === "fulfilled")
    ).toHaveLength(1)
    expect(db.rows("outbox")).toHaveLength(1)
    await db.service.review(moderator, db.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    expect(db.rows("outbox")).toHaveLength(1)
  })
  it("detects stale edits and conflicting revision approvals; allows stale rejection", async () => {
    const db = await fixture()
    await publish(db)
    await expect(
      db.service.edit(member, "thread", db.thread.id, {
        body: "Bad",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 409 })
    const first = await db.service.edit(member, "thread", db.thread.id, {
      body: "First",
      baseVersion: 1,
    })
    const second = await db.service.edit(member, "thread", db.thread.id, {
      body: "Second",
      baseVersion: 1,
    })
    await db.service.review(moderator, first.id, {
      decision: "approve",
      baseVersion: 1,
    })
    await expect(
      db.service.review(moderator, second.id, {
        decision: "approve",
        baseVersion: 1,
      })
    ).rejects.toMatchObject({ status: 409 })
    await db.service.review(moderator, second.id, {
      decision: "reject",
      baseVersion: 1,
    })
    expect((await db.service.getThread(null, db.thread.id)).body).toBe("First")
  })
  it("keeps a rejected edit from changing published content", async () => {
    const db = await fixture()
    await publish(db)
    const edit = await db.service.edit(member, "thread", db.thread.id, {
      body: "Wrong",
      baseVersion: 1,
    })
    await db.service.review(moderator, edit.id, {
      decision: "reject",
      baseVersion: 1,
    })
    expect((await db.service.getThread(null, db.thread.id)).body).toBe(
      "Initial text"
    )
  })
  it("bounds page size, body, language policy and rolls invalid writes back", async () => {
    const db = await fixture({ maxBodyLength: 30 })
    const before = db.rows("thread").length
    await expect(
      db.service.createThread(member, {
        subjectId: db.subject.documentId,
        title: "Too big",
        body: "a".repeat(31),
        language: "en",
      })
    ).rejects.toMatchObject({ status: 400 })
    expect(db.rows("thread")).toHaveLength(before)
    await expect(
      db.service.listThreads(null, { limit: 1000 })
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      db.service.createThread(member, {
        subjectId: db.subject.documentId,
        title: "No",
        body: "text",
        language: "fr",
      })
    ).rejects.toMatchObject({ status: 400 })
  })
  it("limits writes across threads durably by authenticated actor", async () => {
    const db = await fixture({ maxWritesPerHour: 1 })
    await publish(db)
    await expect(
      db.service.createReply(member, db.thread.id, { body: "Spam" })
    ).rejects.toMatchObject({ status: 429 })
    expect(db.rows("reply")).toHaveLength(0)
    expect(db.rows("rate-window")[0].actions).toBe(1)
  })
  it("limits nesting to one level and rejects cross-thread parents", async () => {
    const db = await fixture()
    await publish(db)
    const root = await db.service.createReply(other, db.thread.id, {
      body: "Root",
      language: "es",
    })
    await db.service.review(moderator, root.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    const child = await db.service.createReply(member, db.thread.id, {
      body: "Child",
      parentId: root.reply.id,
    })
    await db.service.review(moderator, child.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    await expect(
      db.service.createReply(other, db.thread.id, {
        body: "Deep",
        parentId: child.reply.id,
      })
    ).rejects.toMatchObject({ status: 400 })
    const next = await db.service.createThread(member, {
      subjectId: db.subject.documentId,
      title: "Next",
      body: "Another",
      language: "en",
    })
    await db.service.review(moderator, next.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    await expect(
      db.service.createReply(member, next.thread.id, {
        body: "Wrong parent",
        parentId: root.reply.id,
      })
    ).rejects.toMatchObject({ status: 400 })
    expect(
      (await db.service.listReplies(null, db.thread.id, { language: "es" }))
        .data
    ).toHaveLength(1)
  })
  it("hides descendants of removed replies and all replies of removed threads", async () => {
    const db = await fixture()
    await publish(db)
    const root = await db.service.createReply(other, db.thread.id, {
      body: "Root",
    })
    await db.service.review(moderator, root.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    const child = await db.service.createReply(member, db.thread.id, {
      body: "Child",
      parentId: root.reply.id,
    })
    await db.service.review(moderator, child.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    await db.service.moderate(moderator, "reply", root.reply.id, {
      action: "remove",
      baseVersion: 1,
    })
    expect((await db.service.listReplies(null, db.thread.id)).data).toEqual([])
    await expect(
      db.service.revisions(member, "reply", child.reply.id)
    ).rejects.toMatchObject({ status: 404 })
    await db.service.moderate(moderator, "thread", db.thread.id, {
      action: "remove",
      baseVersion: 1,
    })
    await expect(
      db.service.listReplies(member, db.thread.id)
    ).rejects.toMatchObject({ status: 404 })
  })
  it("rejects all pending proposals when removing their thread", async () => {
    const db = await fixture()
    await publish(db)
    await db.service.createReply(other, db.thread.id, {
      body: "Still awaiting review",
    })
    await db.service.edit(member, "thread", db.thread.id, {
      body: "Pending edit",
      baseVersion: 1,
    })
    await db.service.moderate(moderator, "thread", db.thread.id, {
      action: "remove",
      baseVersion: 1,
    })
    expect((await db.service.reviewQueue(moderator)).data).toEqual([])
    expect(
      db.rows("revision").filter((row) => row.state === "pending")
    ).toHaveLength(0)
  })
  it("locks writing separately from publication state", async () => {
    const db = await fixture()
    await publish(db)
    await db.service.moderate(moderator, "thread", db.thread.id, {
      action: "lock",
      baseVersion: 1,
    })
    expect((await db.service.getThread(null, db.thread.id)).state).toBe(
      "visible"
    )
    await expect(
      db.service.createReply(other, db.thread.id, { body: "Blocked" })
    ).rejects.toMatchObject({ status: 409 })
    await expect(
      db.service.edit(member, "thread", db.thread.id, {
        body: "Blocked",
        baseVersion: 2,
      })
    ).rejects.toMatchObject({ status: 409 })
    await db.service.moderate(moderator, "thread", db.thread.id, {
      action: "unlock",
      baseVersion: 2,
    })
    expect(
      (await db.service.createReply(other, db.thread.id, { body: "Allowed" }))
        .reply.state
    ).toBe("pending")
  })
  it("deduplicates reports without exposing reporter identity and audits decisions", async () => {
    const db = await fixture()
    await publish(db)
    const report = await db.service.report(other, "thread", db.thread.id, {
      reason: "Off topic",
    })
    const duplicate = await db.service.report(other, "thread", db.thread.id, {
      reason: "Repeated",
    })
    expect(duplicate.id).toBe(report.id)
    expect(db.rows("report")).toHaveLength(1)
    await expect(db.service.reports(member)).rejects.toMatchObject({ status: 403 })
    expect(JSON.stringify(await db.service.reports(moderator))).not.toContain(
      other.key
    )
    await db.service.decideReport(moderator, report.id, {
      decision: "remove",
      baseVersion: 0,
      recordBaseVersion: 1,
      note: "Confirmed",
    })
    await expect(
      db.service.getThread(null, db.thread.id)
    ).rejects.toMatchObject({ status: 404 })
    expect(
      (await db.service.auditLog(moderator, db.thread.id)).data.some(
        (row: any) => row.action === "report_decided"
      )
    ).toBe(true)
  })
  it("preserves report snapshots and rejects stale content removal", async () => {
    const db = await fixture()
    await publish(db)
    const report = await db.service.report(other, "thread", db.thread.id, {
      reason: "Original text is wrong",
    })
    const revision = await db.service.edit(member, "thread", db.thread.id, {
      body: "Corrected text",
      baseVersion: 1,
    })
    await db.service.review(moderator, revision.id, {
      decision: "approve",
      baseVersion: 1,
    })
    expect((await db.service.reports(moderator)).data[0]).toMatchObject({
      reportedBody: "Initial text",
      currentBody: "Corrected text",
      recordVersion: 1,
      currentVersion: 2,
    })
    await expect(
      db.service.decideReport(moderator, report.id, {
        decision: "remove",
        baseVersion: 0,
        recordBaseVersion: 1,
      })
    ).rejects.toMatchObject({ status: 409 })
    expect(db.rows("report")[0].state).toBe("open")
    await db.service.decideReport(moderator, report.id, {
      decision: "dismiss",
      baseVersion: 0,
    })
  })
  it("restricts internal thread administration to Strapi admins", async () => {
    const db = await fixture()
    await expect(db.service.adminThreads(moderator)).rejects.toMatchObject({
      status: 403,
    })
    expect(
      (await db.service.adminThreads(admin, { state: "pending" })).data[0].id
    ).toBe(db.thread.id)
  })
  it("enforces subject visibility and current custom authorization", async () => {
    let allowed = true
    const db = await fixture({ authorize: async () => allowed })
    await publish(db)
    allowed = false
    expect((await db.service.listThreads(member)).data).toEqual([])
    await expect(
      db.service.createReply(member, db.thread.id, { body: "Denied" })
    ).rejects.toMatchObject({ status: 404 })
    allowed = true
    await db.service.saveSubject(
      admin,
      {
        name: "Reading",
        slug: "reading",
        description: "",
        languages: ["en"],
        visibility: "members",
        createPolicy: "members",
        baseVersion: 0,
      },
      db.subject.documentId
    )
    expect((await db.service.listSubjects(null)).data).toEqual([])
    await expect(
      db.service.getThread(null, db.thread.id)
    ).rejects.toMatchObject({ status: 404 })
    expect((await db.service.getThread(member, db.thread.id)).title).toBe(
      "An event"
    )
  })
  it("allowlists attachment resolvers and rechecks target visibility on every read", async () => {
    let visible = true
    const resolver = vi.fn(async () =>
      visible ? { title: "Article", url: "/articles/one" } : null
    )
    const db = await fixture({ targets: { "api::article.article": resolver } })
    await expect(
      db.service.createThread(member, {
        subjectId: db.subject.documentId,
        title: "Attack",
        body: "Body",
        language: "en",
        target: { uid: "api::secret.secret", documentId: "one" },
      })
    ).rejects.toMatchObject({ status: 404 })
    const attached = await db.service.createThread(member, {
      subjectId: db.subject.documentId,
      title: "Attached",
      body: "Body",
      language: "en",
      target: { uid: "api::article.article", documentId: "one", locale: "en" },
    })
    await db.service.review(moderator, attached.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    expect(
      (await db.service.getThread(null, attached.thread.id)).target?.url
    ).toBe("/articles/one")
    await expect(
      db.service.createThread(other, {
        subjectId: db.subject.documentId,
        title: "Duplicate translation",
        body: "Body",
        language: "es",
        target: {
          uid: "api::article.article",
          documentId: "one",
          locale: "es",
        },
      })
    ).rejects.toMatchObject({ status: 409 })
    visible = false
    await expect(
      db.service.getThread(member, attached.thread.id)
    ).rejects.toMatchObject({ status: 404 })
    expect(
      (await db.service.listThreads(null)).data.map((row) => row.id)
    ).not.toContain(attached.thread.id)
  })
})

describe("trusted actor erasure", () => {
  it("preserves public bodies while erasing drafts, identity and recipient records", async () => {
    const notify = vi.fn(),
      db = await fixture({
        notify,
        notificationActor: async (key: string) =>
          key === member.key ? member : other,
      })
    await publish(db)
    await db.service.subscribe(member, db.thread.id, true)
    await db.service.subscribe(other, db.thread.id, true)
    await db.service.flushNotifications()
    const pendingReply = await db.service.createReply(member, db.thread.id, {
      body: "Private pending text",
    })
    const visibleReply = await db.service.createReply(member, db.thread.id, {
      body: "Public surviving reply",
    })
    await db.service.review(moderator, visibleReply.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    const rejectedReply = await db.service.createReply(member, db.thread.id, {
      body: "Private rejected text",
    })
    await db.service.review(moderator, rejectedReply.revision.id, {
      decision: "reject",
      baseVersion: 0,
    })
    const pendingThread = await db.service.createThread(member, {
      subjectId: db.subject.documentId,
      title: "Private title",
      body: "Private thread text",
      language: "en",
    })
    const otherReply = await db.service.createReply(other, db.thread.id, {
      body: "Another member's public reply",
    })
    const memberModerator = {
      ...member,
      capabilities: [...member.capabilities!, "moderate" as const],
    }
    await db.service.review(memberModerator, otherReply.revision.id, {
      decision: "approve",
      baseVersion: 0,
      note: "Private moderator note",
    })
    await db.service.report(member, "thread", db.thread.id, {
      reason: "Private own report",
    })
    const otherReport = await db.service.report(other, "thread", db.thread.id, {
      reason: "Other reporter",
    })
    await db.service.decideReport(memberModerator, otherReport.id, {
      decision: "dismiss",
      baseVersion: 0,
      note: "Private reviewer note",
    })
    expect(await db.service.eraseActor(member.key)).toMatchObject({
      erased: true,
      alreadyErased: false,
      anonymized: 2,
      unpublishedRemoved: 3,
    })
    expect(await db.service.getThread(null, db.thread.id)).toMatchObject({
      body: "Initial text",
      author: { name: "Former member" },
    })
    expect(
      (await db.service.listReplies(null, db.thread.id)).data.map(
        (row) => row.body
      )
    ).toEqual(["Public surviving reply", "Another member's public reply"])
    expect(
      db.rows("reply").find((row) => row.documentId === pendingReply.reply.id)
    ).toMatchObject({ state: "removed", body: "", authorKey: "erased" })
    expect(
      db.rows("reply").find((row) => row.documentId === rejectedReply.reply.id)
    ).toMatchObject({ state: "removed", body: "" })
    expect(
      db
        .rows("thread")
        .find((row) => row.documentId === pendingThread.thread.id)
    ).toMatchObject({ state: "removed", title: "Removed discussion", body: "" })
    expect(db.rows("subscription").map((row) => row.actorKey)).toEqual([
      other.key,
    ])
    expect(db.rows("report")).toHaveLength(1)
    expect(db.rows("report")[0]).toMatchObject({
      reviewerKey: "erased",
      reviewNote: null,
    })
    expect(db.rows("outbox").some((row) => row.actorKey === member.key)).toBe(
      false
    )
    expect(
      db.rows("rate-window").some((row) => row.actorKey === member.key)
    ).toBe(false)
    for (const kind of [
      "thread",
      "reply",
      "revision",
      "report",
      "subscription",
      "audit-event",
      "outbox",
    ])
      expect(JSON.stringify(db.rows(kind))).not.toContain(member.key)
    expect(JSON.stringify(db.rows("revision"))).not.toContain(
      "Private pending text"
    )
    expect(JSON.stringify(db.rows("revision"))).not.toContain(
      "Private rejected text"
    )
    expect(JSON.stringify(db.rows("audit-event"))).not.toContain(
      "Private moderator note"
    )
    expect(
      db.rows("outbox").some((row) => row.event.type === "anonymized")
    ).toBe(true)
    await expect(
      db.service.createReply(member, db.thread.id, {
        body: "Stale in-flight authority",
      })
    ).rejects.toMatchObject({ status: 401 })
    expect(await db.service.eraseActor(member.key)).toEqual({
      erased: true,
      alreadyErased: true,
    })
    expect(
      db.rows("rate-window").some((row) => row.actorKey === member.key)
    ).toBe(false)
  })

  it("cannot resurrect a pending proposal across competing erasure and review", async () => {
    const db = await fixture()
    await publish(db)
    const reply = await db.service.createReply(member, db.thread.id, {
      body: "Competing proposal",
    })
    await Promise.allSettled([
      db.service.review(moderator, reply.revision.id, {
        decision: "approve",
        baseVersion: 0,
      }),
      db.service.eraseActor(member.key),
    ])
    const row = db
      .rows("reply")
      .find((row) => row.documentId === reply.reply.id)
    expect(row.authorKey).toBe("erased")
    expect(
      row.state === "visible"
        ? row.body === "Competing proposal"
        : row.body === ""
    ).toBe(true)
    expect(
      db.rows("revision").some((row) => row.authorKey === member.key)
    ).toBe(false)
    await expect(
      db.service.review({ ...moderator, key: member.key }, db.revision.id, {
        decision: "reject",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 401 })
  })

  it("rolls erasure back without committing cache events on storage failure", async () => {
    const db = await fixture()
    await publish(db)
    const original = db.strapi.db.query
    db.strapi.db.query = (uid: string) => {
      const query = original(uid)
      if (uid.endsWith(".subscription"))
        query.deleteMany = async () => {
          throw new Error("Storage failed")
        }

      return query
    }
    const committed = db.committed.length,
      outbox = db.rows("outbox").length
    await expect(db.service.eraseActor(member.key)).rejects.toThrow(
      "Storage failed"
    )
    expect(db.rows("thread")[0].authorKey).toBe(member.key)
    expect(db.rows("erased-actor")).toHaveLength(0)
    expect(db.rows("outbox")).toHaveLength(outbox)
    expect(db.committed).toHaveLength(committed)
  })
})

describe("notifications and authentication", () => {
  it("dispatches only after commit and retries with a stable delivery key", async () => {
    const eventHook = vi.fn(),
      notify = vi
        .fn()
        .mockRejectedValueOnce(new Error("transport"))
        .mockResolvedValue(undefined)
    const db = await fixture({
      notify,
      onEvent: eventHook,
      notificationActor: async () => other,
    })
    await publish(db)
    await db.service.subscribe(other, db.thread.id, true)
    expect(notify).not.toHaveBeenCalled()
    expect(eventHook).not.toHaveBeenCalled()
    expect(db.committed).toHaveLength(1)
    await db.service.flushNotifications()
    await db.service.flushNotifications()
    await db.service.flushNotifications()
    expect(eventHook).toHaveBeenCalledTimes(1)
    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify.mock.calls[0][0].idempotencyKey).toBe(
      notify.mock.calls[1][0].idempotencyKey
    )
    await db.service.flushNotifications()
    expect(notify).toHaveBeenCalledTimes(2)
  })
  it("suppresses notifications after access revocation and permits unsubscribe", async () => {
    let active = true
    const notify = vi.fn(),
      db = await fixture({
        notify,
        notificationActor: async () => (active ? other : null),
      })
    await publish(db)
    await db.service.subscribe(other, db.thread.id, true)
    await db.service.flushNotifications()
    active = false
    await db.service.flushNotifications()
    expect(notify).not.toHaveBeenCalled()
    await db.service.moderate(moderator, "thread", db.thread.id, {
      action: "remove",
      baseVersion: 1,
    })
    await db.service.subscribe(other, db.thread.id, false)
    expect(db.rows("subscription")).toHaveLength(0)
  })
  it("validates built-in JWT against a current confirmed, unblocked user and role", async () => {
    const db = harness()
    let claims: any = { id: 7 }
    const token = vi.fn(async () => claims)
    db.strapi.plugin = () => ({ service: () => ({ getToken: token }) })
    db.seed("user", {
      id: 7,
      username: "Contributor",
      confirmed: true,
      blocked: false,
      role: { id: 2 },
    })
    const ctx = {
      request: { header: { authorization: "Bearer valid" } },
      state: { user: { id: "forged" } },
    }
    expect(
      await resolveActor(db.strapi, { ...defaults, moderatorRoleIds: [2] }, ctx)
    ).toMatchObject({
      key: "up:7",
      capabilities: expect.arrayContaining(["moderate"]),
    })
    db.rows("user")[0].blocked = true
    await expect(resolveActor(db.strapi, defaults, ctx)).rejects.toMatchObject({
      status: 401,
    })
    claims = {}
    await expect(resolveActor(db.strapi, defaults, ctx)).rejects.toMatchObject({
      status: 401,
    })
  })
  it("ignores caller identity headers and rejects privileged custom actors", async () => {
    const db = harness()
    expect(
      await resolveActor(db.strapi, defaults, {
        request: { header: { "x-user-id": "1" } },
      })
    ).toBeNull()
    await expect(
      resolveActor(db.strapi, { ...defaults, identity: async () => admin }, {})
    ).rejects.toMatchObject({ status: 401 })
  })
  it("gives every schema field an independent object for Strapi metadata mutation", () => {
    for (const definition of Object.values(schemas)) {
      const attributes = Object.values(definition.schema.attributes)
      expect(new Set(attributes).size).toBe(attributes.length)
      for (const [field, attribute] of Object.entries(
        definition.schema.attributes
      )) {
        if (attribute.unique)
          expect(
            definition.schema.indexes.some(
              (index) =>
                index.type === "unique" &&
                index.columns.includes(
                  field.replaceAll(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)
                )
            )
          ).toBe(true)
      }
    }
  })
  it("denies unsafe links and guards every admin route with explicit RBAC", () => {
    for (const value of [
      // eslint-disable-next-line sonarjs/code-eval -- This literal is rejected as unsafe and never executed.
      "javascript:alert(1)",
      "//evil.example",
      String.raw`/\evil.example`,
      "https://name:password@example.com",
    ])
      expect(() => safeUrl(value)).toThrow()
    for (const route of routes.admin.routes)
      expect(route.config.policies).toEqual(
        expect.arrayContaining([
          "admin::isAuthenticatedAdmin",
          expect.objectContaining({ name: "admin::hasPermissions" }),
        ])
      )
  })
})

describe("record language authorization", () => {
  const enModerator = { ...moderator, key: "moderator:en" }
  const esModerator = { ...moderator, key: "moderator:es" }
  const authorize = async ({
    actor,
    action,
    subject,
    thread,
    recordLanguage,
  }: any) => {
    if (action !== "moderate" && subject.visibility !== "private") return true
    if (actor?.key === enModerator.key)
      return (recordLanguage ?? thread?.language) === "en"
    if (actor?.key === esModerator.key)
      return (recordLanguage ?? thread?.language) === "es"

    return true
  }
  it("scopes proposal history, decisions, removal, reports and audit notes to the reply language", async () => {
    const db = await fixture({ authorize })
    await publish(db)
    const created = await db.service.createReply(other, db.thread.id, {
      body: "Una respuesta",
      language: "es",
    })
    expect((await db.service.reviewQueue(enModerator)).data).toEqual([])
    expect((await db.service.reviewQueue(esModerator)).data[0]).toMatchObject({
      id: created.revision.id,
      language: "es",
    })
    await expect(
      db.service.revisions(enModerator, "reply", created.reply.id)
    ).rejects.toMatchObject({ status: 404 })
    expect(
      (await db.service.revisions(esModerator, "reply", created.reply.id))
        .data[0].body
    ).toBe("Una respuesta")
    await expect(
      db.service.review(enModerator, created.revision.id, {
        decision: "approve",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.review(enModerator, created.revision.id, {
        decision: "reject",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.moderate(enModerator, "reply", created.reply.id, {
        action: "remove",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 403 })
    await db.service.review(esModerator, created.revision.id, {
      decision: "approve",
      baseVersion: 0,
      note: "Nota privada",
    })
    expect(
      (await db.service.auditLog(enModerator, db.thread.id)).data.every(
        (event: any) => event.recordId !== created.reply.id
      )
    ).toBe(true)
    const report = await db.service.report(member, "reply", created.reply.id, {
      reason: "Please review",
    })
    expect((await db.service.reports(enModerator)).data).toEqual([])
    expect((await db.service.reports(esModerator)).data[0]).toMatchObject({
      id: report.id,
      language: "es",
    })
    await expect(
      db.service.decideReport(enModerator, report.id, {
        decision: "dismiss",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.decideReport(enModerator, report.id, {
        decision: "remove",
        baseVersion: 0,
        recordBaseVersion: 1,
      })
    ).rejects.toMatchObject({ status: 403 })
    await db.service.decideReport(esModerator, report.id, {
      decision: "dismiss",
      baseVersion: 0,
    })
    expect(db.rows("report")[0].state).toBe("dismissed")
  })
  it("does not expand access to a private thread through a different-language reply", async () => {
    const db = await fixture({ authorize })
    await publish(db)
    const created = await db.service.createReply(other, db.thread.id, {
      body: "Private Spanish proposal",
      language: "es",
    })
    await db.service.saveSubject(
      admin,
      { ...db.subject, baseVersion: db.subject.version, visibility: "private" },
      db.subject.documentId
    )
    expect((await db.service.reviewQueue(enModerator)).data).toEqual([])
    expect((await db.service.reviewQueue(esModerator)).data).toEqual([])
    await expect(
      db.service.getThread(esModerator, db.thread.id)
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      db.service.review(esModerator, created.revision.id, {
        decision: "approve",
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.revisions(enModerator, "reply", created.reply.id)
    ).rejects.toMatchObject({ status: 404 })
    expect((await db.service.reviewQueue(moderator)).data[0].id).toBe(
      created.revision.id
    )
  })
  it("passes immutable record language to custom edit and report policies", async () => {
    const checked: any[] = []
    const db = await fixture({
      authorize: async (context: any) => {
        checked.push({
          action: context.action,
          language: context.recordLanguage,
        })

        return (
          !["editOwn", "report"].includes(context.action) ||
          context.recordLanguage !== "es"
        )
      },
    })
    await publish(db)
    const created = await db.service.createReply(other, db.thread.id, {
      body: "Spanish original",
      language: "es",
    })
    await db.service.review(moderator, created.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    await expect(
      db.service.edit(other, "reply", created.reply.id, {
        body: "New text",
        language: "en",
        baseVersion: 1,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.report(member, "reply", created.reply.id, {
        reason: "Check this",
        language: "en",
      })
    ).rejects.toMatchObject({ status: 403 })
    expect(checked).toEqual(
      expect.arrayContaining([
        { action: "editOwn", language: "es" },
        { action: "report", language: "es" },
      ])
    )
  })
})
