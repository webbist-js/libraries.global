import { describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import { applyDriveProposal } from "../src/plugins/content-moderation/server/utils/drive-proposal"
import {
  configureDriveDiscussions,
  validateDriveConversationRequest,
} from "../src/utils/drive-discussions"

const DRIVE = "api::drive.drive"
const SETTINGS = "plugin::discussions.context-setting"
const input = {
  title: "Fill in opening hours",
  summary: "Help visitors find current opening times for their libraries.",
  steps: ["Find a Library", "Check its hours"],
  focus: { kind: "gaps", gaps: ["hours"] },
  scope: { places: { region: ["ohio"] } },
  unit: "library",
  startsAt: "2026-10-20T00:00:00Z",
  endsAt: "2026-11-20T00:00:00Z",
  goalPercent: 50,
  whereToLook: { name: "", url: "", licenceNote: "" },
}
function fixture(readable = true) {
  const db = makeFakeStrapi({
    [DRIVE]: [],
    ["api::user-profile.user-profile"]: [
      { baUserId: "proposer", username: "proposer" },
    ],
  })
  db.services[DRIVE] = {
    createDrive: async (data: any) => ({
      data: await db.strapi
        .documents(DRIVE)
        .create({ data: { ...data, locale: "en", status: "scheduled" } }),
    }),
  }
  const discussions = {
    contextMetadata: vi.fn(async () => ({ version: 0, links: [] })),
    configureContext: vi.fn(async () =>
      db.strapi.documents(SETTINGS).create({ data: { enabled: true } })
    ),
    getThread: vi.fn(async () => {
      if (!readable)
        throw Object.assign(new Error("Unavailable"), { status: 404 })

      return { state: "visible" }
    }),
    addContextLink: vi.fn(async () => ({})),
    actContextLink: vi.fn(),
    listSubjects: vi.fn(async () => ({
      data: [{ id: "drive-subject", slug: "drives" }],
    })),
    createThread: vi.fn(async () => ({ thread: { state: "pending" } })),
  }
  db.services["discussions.discussion"] = discussions

  return { ...db, discussions }
}
describe("Drive conversation requests", () => {
  it.each([
    { enabled: true, threadIds: [42] },
    { enabled: true, threadIds: Array.from({ length: 11 }).fill("thread") },
    { enabled: true, threadIds: ["thread"], featuredThreadId: "other" },
    { enabled: true, threadIds: [], baseVersion: -1 },
    {
      enabled: true,
      threadIds: [],
      start: { title: "Title", body: "Text", language: "en" },
    },
  ])("rejects malformed or inline-text contributor requests", (value) => {
    expect(() => validateDriveConversationRequest(value, false)).toThrow(
      "Invalid Drive conversations"
    )
  })
  it("applies approved link requests only after checking the proposer's current access", async () => {
    const db = fixture()
    const id = await db.strapi.db.transaction(() =>
      applyDriveProposal(db.strapi, {
        documentId: "proposal",
        submittedByUserId: "proposer",
        draftData: {
          drive: {
            ...input,
            discussions: { enabled: true, threadIds: ["thread"] },
          },
        },
      })
    )
    expect(db.store[DRIVE][0]).toMatchObject({
      documentId: id,
      status: "scheduled",
    })
    expect(db.discussions.getThread).toHaveBeenCalledWith(
      expect.objectContaining({ key: "ba:proposer" }),
      "thread"
    )
    expect(db.discussions.addContextLink).toHaveBeenCalledWith(
      expect.objectContaining({ key: "system:approved-drive", admin: true }),
      {
        threadId: "thread",
        target: { uid: DRIVE, documentId: id, locale: "en" },
      }
    )
  })
  it("rolls back proposal application if a requested conversation is no longer readable", async () => {
    const db = fixture(false)
    await expect(
      db.strapi.db.transaction(() =>
        applyDriveProposal(db.strapi, {
          documentId: "proposal",
          submittedByUserId: "proposer",
          draftData: {
            drive: {
              ...input,
              discussions: { enabled: true, threadIds: ["thread"] },
            },
          },
        })
      )
    ).rejects.toMatchObject({ reason: "invalid_drive" })
    expect(db.store[DRIVE]).toEqual([])
    expect(db.discussions.addContextLink).not.toHaveBeenCalled()
  })
  it("routes new Drive conversation text through the normal moderated thread creator", async () => {
    const db = fixture()
    await configureDriveDiscussions(db.strapi, "proposer", "drive", "en", {
      enabled: true,
      threadIds: [],
      start: {
        title: "Coordinate hours",
        body: "How can we check holiday closures?",
        language: "es",
      },
    })
    expect(db.discussions.createThread).toHaveBeenCalledWith(
      expect.objectContaining({ key: "ba:proposer" }),
      {
        subjectId: "drive-subject",
        target: { uid: DRIVE, documentId: "drive", locale: "en" },
        title: "Coordinate hours",
        body: "How can we check holiday closures?",
        language: "es",
      }
    )
  })
})
