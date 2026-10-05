import { describe, expect, it, vi } from "vitest"

import createService from "../../src/plugins/content-moderation/server/services/submission"
import { payloadHash } from "../../src/plugins/content-moderation/server/utils/payload-hash"
import { adminReviewer } from "../../src/plugins/content-moderation/server/utils/reviewer"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const REVIEWER = adminReviewer({ id: 1, email: "moderator@example.org" })

const SUBMISSION = "plugin::content-moderation.submission"
const TOPIC = "api::topic.topic"
const SID = "s0000000000000000000001"

/** A topic suggestion as the "Suggest a topic" route sends it: a name, no target. */
const suggestion = (fields: Record<string, unknown>, extra = {}) => {
  const s: any = {
    documentId: SID,
    submissionType: "topic_suggestion",
    status: "pending",
    submittedByUserId: "u1",
    submittedByEmail: "u1@example.org",
    fields,
    draftData: null,
    ...extra,
  }
  s.payloadHash = payloadHash(s)

  return s
}

function setup(seed: any, topics: any[] = []) {
  const f = makeFakeStrapi({ [SUBMISSION]: [seed], [TOPIC]: topics })
  f.services["rewards.points"] = { award: vi.fn(async () => {}) }

  return { ...f, svc: createService({ strapi: f.strapi }) }
}

const stored = (store: any) =>
  store[SUBMISSION].find((d: any) => d.documentId === SID)

describe("approving a topic suggestion", () => {
  it("creates the suggested topic, approved, and records it on the submission", async () => {
    const { svc, store } = setup(suggestion({ name: "Seed Libraries" }))

    const result = await svc.updateStatus(SID, "approved", REVIEWER)

    expect("data" in result).toBe(true)
    expect(store[TOPIC]).toHaveLength(1)
    const topic = store[TOPIC]![0]!
    expect(topic).toMatchObject({
      name: "Seed Libraries",
      slug: "seed-libraries",
      status: "approved",
      suggestedByUserId: "u1",
    })
    expect(stored(store).resultDocumentId).toBe(topic.documentId)
  })

  it("approves a topic that already exists under the same name in any case", async () => {
    const { svc, store } = setup(suggestion({ name: "seed libraries" }), [
      {
        documentId: "t0000000000000000000001",
        name: "Seed Libraries",
        slug: "seed-libraries",
        status: "rejected",
      },
    ])

    await svc.updateStatus(SID, "approved", REVIEWER)

    expect(store[TOPIC]).toHaveLength(1)
    expect(store[TOPIC]![0]!.status).toBe("approved")
    expect(stored(store).resultDocumentId).toBe("t0000000000000000000001")
  })

  it("still approves the reviewed target when the suggestion names a topic", async () => {
    const { svc, store } = setup(
      suggestion(
        { name: "ignored" },
        {
          targetEntityType: "topic",
          targetDocumentId: "t0000000000000000000002",
        }
      ),
      [
        {
          documentId: "t0000000000000000000002",
          name: "Prison Libraries",
          slug: "prison-libraries",
          status: "pending",
        },
      ]
    )

    await svc.updateStatus(SID, "approved", REVIEWER)

    expect(store[TOPIC]).toHaveLength(1)
    expect(store[TOPIC]![0]!.status).toBe("approved")
  })

  it("creates nothing for a blank name", async () => {
    const { svc, store } = setup(suggestion({ name: "   " }))

    const result = await svc.updateStatus(SID, "approved", REVIEWER)

    expect("data" in result).toBe(true)
    expect(store[TOPIC]).toHaveLength(0)
    expect(stored(store).resultDocumentId).toBeFalsy()
  })

  it("creates nothing when the suggestion is rejected", async () => {
    const { svc, store } = setup(suggestion({ name: "Seed Libraries" }))

    await svc.updateStatus(SID, "rejected", REVIEWER, "Already covered")

    expect(store[TOPIC]).toHaveLength(0)
  })
})
