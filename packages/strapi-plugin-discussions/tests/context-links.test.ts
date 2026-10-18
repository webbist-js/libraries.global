import { describe, expect, it } from "vitest"

import { harness } from "./harness"
import type { Actor } from "../server/contracts"

const writer: Actor = {
  key: "writer",
  name: "Writer",
  capabilities: ["read", "createThread", "editOwn", "reply", "subscribe"],
}
const staff: Actor = { ...writer, key: "staff", name: "Staff" }
const board: Actor = {
  ...writer,
  key: "board",
  name: "Board",
  capabilities: [...writer.capabilities!, "moderate", "sanction"],
}
const admin: Actor = { key: "admin", name: "Admin", admin: true }
const library = { uid: "host.library", documentId: "library" }
const drive = { uid: "host.drive", documentId: "drive" }

async function fixture() {
  const visibility = { library: true, drive: true, active: true }
  const db = harness({
    contextKinds: {
      libraries: { uid: library.uid },
      drives: { uid: drive.uid, defaultEnabled: false },
    },
    targets: {
      [library.uid]: async () =>
        visibility.library ? { title: "Library", url: "/libraries/one" } : null,
      [drive.uid]: async (_target: any, { actor }: any) =>
        visibility.drive || actor?.key === "board"
          ? { title: "Drive", url: "/drives/one", active: visibility.active }
          : null,
    },
    authorizeContext: async ({ actor, target }: any) =>
      actor?.key === "board"
        ? "manage"
        : actor?.key === "staff" && target.uid === library.uid
          ? "propose"
          : false,
    profanityTerms: { en: ["swearword"] },
  })
  const subject = await db.service.saveSubject(admin, {
    name: "Life",
    slug: "life",
    languages: [],
    visibility: "public",
    createPolicy: "members",
  })
  const created = await db.service.createThread(writer, {
    subjectId: subject.documentId,
    title: "One conversation",
    body: "Approved body",
    language: "en",
  })
  await db.service.review(board, created.revision.id, {
    decision: "approve",
    baseVersion: 0,
  })
  await db.service.configureContext(board, drive, {
    enabled: true,
    baseVersion: 0,
  })

  return { ...db, visibility, subject, threadId: created.thread.id }
}

describe("portable discussion context links", () => {
  it("links the same published conversation to a Library and Drive without copying messages or ownership", async () => {
    const db = await fixture()
    await db.service.addContextLink(board, {
      target: library,
      threadId: db.threadId,
    })
    await db.service.addContextLink(board, {
      target: drive,
      threadId: db.threadId,
    })
    for (const target of [library, drive]) {
      const feed = await db.service.listThreads(null, {
        contextUid: target.uid,
        contextId: target.documentId,
      })
      expect(feed.total).toBe(1)
      expect(feed.data[0]).toMatchObject({
        id: db.threadId,
        body: "Approved body",
        author: { name: "Writer" },
      })
    }
    expect(db.rows("thread")).toHaveLength(1)
    expect(
      (await db.service.getThread(null, db.threadId)).contexts
    ).toHaveLength(2)
    expect(
      JSON.stringify(await db.service.getThread(null, db.threadId))
    ).not.toContain('"actorKey"')
  })
  it("does not broaden private subject access through a public context, including totals and entity discovery", async () => {
    const db = await fixture()
    await db.service.addContextLink(board, {
      target: library,
      threadId: db.threadId,
    })
    const current = db.rows("subject")[0]
    await db.service.saveSubject(
      admin,
      { ...current, baseVersion: current.version, visibility: "private" },
      current.documentId
    )
    expect(
      (await db.service.listThreads(null, { contextType: "libraries" })).total
    ).toBe(0)
    expect(
      (await db.service.discoverContexts(null, { contextType: "libraries" }))
        .data
    ).toEqual([])
    expect((await db.service.contextMetadata(null, library)).links).toEqual([])
  })
  it("hides draft Drive titles and links from readers and rechecks changed target visibility", async () => {
    const db = await fixture()
    await db.service.addContextLink(board, {
      target: drive,
      threadId: db.threadId,
    })
    db.visibility.drive = false
    expect((await db.service.getThread(null, db.threadId)).contexts).toEqual([])
    expect(
      (await db.service.listThreads(null, { contextType: "drives" })).total
    ).toBe(0)
    const managed = await db.service.getThread(board, db.threadId)
    expect(managed.contexts![0]).toMatchObject({
      title: "Drive",
      public: false,
      canManage: true,
    })
    await expect(
      db.service.contextMetadata(writer, drive)
    ).rejects.toMatchObject({ status: 404 })
  })
  it("keeps staff-proposed links private until a different manager approves, with required rejection feedback and retry", async () => {
    const db = await fixture()
    const proposed = await db.service.addContextLink(staff, {
      target: library,
      threadId: db.threadId,
    })
    expect((await db.service.contextMetadata(null, library)).links).toEqual([])
    expect(
      (await db.service.contextMetadata(staff, library)).links[0]
    ).toMatchObject({ state: "pending", canReview: false })
    const link = (await db.service.contextMetadata(board, library)).links[0]
    const upgradedStaff = { ...staff, admin: true }
    expect(
      (await db.service.contextMetadata(upgradedStaff, library)).links[0]
        .canReview
    ).toBe(false)
    await expect(
      db.service.actContextLink(upgradedStaff, proposed.id, {
        action: "approve",
        baseVersion: link.version,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.actContextLink(staff, proposed.id, {
        action: "approve",
        baseVersion: link.version,
      })
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      db.service.actContextLink(board, proposed.id, {
        action: "reject",
        baseVersion: link.version,
      })
    ).rejects.toMatchObject({ status: 400 })
    await db.service.actContextLink(board, proposed.id, {
      action: "reject",
      baseVersion: link.version,
      feedback: "Explain why this Library is relevant",
    })
    expect(
      (await db.service.contextMetadata(staff, library)).links[0].feedback
    ).toBe("Explain why this Library is relevant")
    await db.service.addContextLink(staff, {
      target: library,
      threadId: db.threadId,
    })
    const retry = (await db.service.contextMetadata(board, library)).links[0]
    await db.service.actContextLink(board, retry.id, {
      action: "approve",
      baseVersion: retry.version,
    })
    expect(
      (
        await db.service.listThreads(null, {
          contextUid: library.uid,
          contextId: library.documentId,
        })
      ).total
    ).toBe(1)
    expect(
      db.rows("audit-event").some((row) => row.action === "context_reject")
    ).toBe(true)
  })
  it("uses optimistic versions for settings, feature swaps and removal; unlink keeps the thread", async () => {
    const db = await fixture()
    await db.service.addContextLink(board, {
      target: drive,
      threadId: db.threadId,
    })
    const link = (await db.service.contextMetadata(board, drive)).links[0]
    await db.service.actContextLink(board, link.id, {
      action: "feature",
      baseVersion: link.version,
    })
    await expect(
      db.service.actContextLink(board, link.id, {
        action: "remove",
        baseVersion: link.version,
      })
    ).rejects.toMatchObject({ status: 409 })
    const featured = (await db.service.contextMetadata(board, drive)).links[0]
    await db.service.actContextLink(board, featured.id, {
      action: "remove",
      baseVersion: featured.version,
    })
    expect(
      (await db.service.listThreads(null, { contextType: "drives" })).total
    ).toBe(0)
    expect((await db.service.getThread(null, db.threadId)).body).toBe(
      "Approved body"
    )
    await expect(
      db.service.configureContext(board, drive, {
        enabled: false,
        baseVersion: 0,
      })
    ).rejects.toMatchObject({ status: 409 })
  })
  it("allows a new Library conversation despite an older unseen pending attachment, with owner-only recovery", async () => {
    const db = await fixture()
    const create = (actor: Actor) =>
      db.service.createThread(actor, {
        target: library,
        subjectId: db.subject.documentId,
        title: "Pending",
        body: "Private submitted text",
        language: "en",
      })
    const first = await create(writer),
      second = await create(staff)
    expect(
      (await db.service.listThreads(null, { contextType: "libraries" })).total
    ).toBe(0)
    expect(
      (
        await db.service.myRecords(staff, "thread", {
          targetUid: library.uid,
          targetId: library.documentId,
        })
      ).data.map((row: any) => row.id)
    ).toEqual([second.thread.id])
    await db.service.review(board, second.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    expect(
      (
        await db.service.listThreads(null, { contextType: "libraries" })
      ).data.map((row: any) => row.id)
    ).toEqual([second.thread.id])
    await expect(
      db.service.getThread(staff, first.thread.id)
    ).rejects.toMatchObject({ status: 404 })
  })
  it("does not send extra notifications for links; masks metadata titles and reflects approved edits/removals everywhere", async () => {
    const db = await fixture()
    await db.service.subscribe(staff, db.threadId, true)
    const before = db.rows("outbox").length
    await db.service.addContextLink(board, {
      target: library,
      threadId: db.threadId,
    })
    await db.service.addContextLink(board, {
      target: drive,
      threadId: db.threadId,
    })
    expect(db.rows("outbox").length).toBe(before)
    const edit = await db.service.edit(writer, "thread", db.threadId, {
      baseVersion: 1,
      title: "swearword title",
      body: "Edited public body",
    })
    await db.service.review(board, edit.id, {
      decision: "approve",
      baseVersion: 1,
    })
    expect(
      (await db.service.contextMetadata(null, library)).links[0].thread.title
    ).not.toContain("swearword")
    await db.service.moderate(board, "thread", db.threadId, {
      action: "remove",
      baseVersion: 2,
      feedback: "Removed",
    })
    for (const contextType of ["libraries", "drives"])
      expect((await db.service.listThreads(null, { contextType })).total).toBe(
        0
      )
  })
  it("backfills primary attachments idempotently and erases identifying link ownership", async () => {
    const db = await fixture()
    await db.service.addContextLink(staff, {
      target: library,
      threadId: db.threadId,
    })
    await db.service.addContextLink(board, {
      target: drive,
      threadId: db.threadId,
    })
    await db.service.backfillContextLinks()
    await db.service.backfillContextLinks()
    expect(db.rows("context-link")).toHaveLength(2)
    await db.service.eraseActor(staff.key)
    expect(
      db.rows("context-link").some((row) => row.actorKey === staff.key)
    ).toBe(false)
  })
  it("keeps active-Drive filters and disabled feeds consistent, and rejects prototype context kinds", async () => {
    const db = await fixture()
    await db.service.addContextLink(board, {
      target: drive,
      threadId: db.threadId,
    })
    db.visibility.active = false
    expect(
      (
        await db.service.listThreads(null, {
          contextType: "drives",
          activeContexts: "1",
        })
      ).total
    ).toBe(0)
    await db.service.configureContext(board, drive, {
      enabled: false,
      baseVersion: 1,
    })
    expect(
      (await db.service.contextMetadata(board, drive)).links[0]
    ).toMatchObject({ public: false, targetPublic: true })
    expect(
      (await db.service.listThreads(null, { contextType: "drives" })).total
    ).toBe(0)
    await expect(
      db.service.discoverContexts(null, { contextType: "constructor" })
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      db.service.listThreads(null, { contextType: "__proto__" })
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      db.service.listThreads(null, {
        contextType: "drives",
        contextUid: library.uid,
        contextId: library.documentId,
      })
    ).rejects.toMatchObject({ status: 400 })
  })
  it("retains author-only association recovery when a feed is hidden", async () => {
    const db = await fixture()
    await db.service.addContextLink(staff, {
      target: library,
      threadId: db.threadId,
    })
    await db.service.configureContext(board, library, {
      enabled: false,
      baseVersion: 0,
    })
    expect(
      (await db.service.contextMetadata(staff, library)).links[0].state
    ).toBe("pending")
    expect((await db.service.contextMetadata(writer, library)).links).toEqual(
      []
    )
    expect(
      (await db.service.listThreads(staff, { contextType: "libraries" })).total
    ).toBe(0)
  })
  it("reuses concurrent links and keeps one featured association without copying threads", async () => {
    const db = await fixture()
    const linked = await Promise.all([
      db.service.addContextLink(board, {
        target: library,
        threadId: db.threadId,
      }),
      db.service.addContextLink(board, {
        target: library,
        threadId: db.threadId,
      }),
    ])
    expect(linked[0].id).toBe(linked[1].id)
    const another = await db.service.createThread(writer, {
      subjectId: db.subject.documentId,
      title: "Another public thread",
      body: "Another body",
      language: "en",
    })
    await db.service.review(board, another.revision.id, {
      decision: "approve",
      baseVersion: 0,
    })
    await db.service.addContextLink(board, {
      target: library,
      threadId: another.thread.id,
    })
    const links = (await db.service.contextMetadata(board, library)).links
    await Promise.all(
      links.map((link: any) =>
        db.service.actContextLink(board, link.id, {
          action: "feature",
          baseVersion: link.version,
        })
      )
    )
    expect(
      (await db.service.contextMetadata(null, library)).links.filter(
        (link: any) => link.featured
      )
    ).toHaveLength(1)
    expect(db.rows("thread")).toHaveLength(2)
  })
})
