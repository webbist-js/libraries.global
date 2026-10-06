import { decrypt } from "@repo/events-crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

import credentialsFactory from "../../src/plugins/events/server/services/credentials"
import { sealValues } from "../../src/plugins/events/server/utils/credential-crypto"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"
const LIBRARY = "api::library.library"
const EVENTS = "plugin::events.credential-event"
const KEY = "a".repeat(64)

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = KEY
  delete process.env.EVENTS_CREDENTIAL_KEY_PREV
})

function seed() {
  return makeFakeStrapi({
    [LIBRARY]: [
      {
        documentId: "lib00000000000000000001",
        entityRef: "GB-1",
        hasActiveFeed: true,
      },
      {
        documentId: "lib00000000000000000002",
        entityRef: "GB-2",
        hasActiveFeed: true,
      },
    ],
    [CRED]: [
      {
        id: 1,
        documentId: "credA0000000000000000001",
        provider: "ical",
        label: "A",
        scope: "library",
        status: "active",
        credentialsEncrypted: "{}",
        libraries: [{ documentId: "lib00000000000000000001" }],
      },
      {
        id: 2,
        documentId: "credB0000000000000000002",
        provider: "ical",
        label: "B",
        scope: "library",
        status: "active",
        credentialsEncrypted: "{}",
        libraries: [{ documentId: "lib00000000000000000002" }],
      },
    ],
    [EVENTS]: [],
  })
}

const publishedFlag = async (strapi: any, documentId: string) =>
  (await strapi.documents(LIBRARY).findOne({ documentId, status: "published" }))
    ?.hasActiveFeed

describe("credentials service: hasActiveFeed", () => {
  it("pausing the only credential clears the flag", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    await service.update(
      "credA0000000000000000001",
      { status: "paused" },
      "admin:1"
    )
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
    expect(await publishedFlag(strapi, "lib00000000000000000002")).toBe(true)
  })

  it("keeps the flag while another active credential feeds the library", async () => {
    const { strapi, store } = seed()
    store[CRED]![1]!.libraries = [{ documentId: "lib00000000000000000001" }]
    const service = credentialsFactory({ strapi })
    await service.update(
      "credA0000000000000000001",
      { status: "paused" },
      "admin:1"
    )
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(true)
  })

  it("a pending credential never sets the flag", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.status = "pending"
    const service = credentialsFactory({ strapi })
    await service.syncLibraryFeedFlags(["lib00000000000000000001"])
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
  })

  it("only asks about the libraries it was given", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    const spy = vi.spyOn(strapi, "documents")
    await service.syncLibraryFeedFlags(["lib00000000000000000001"])
    const credReads = spy.mock.calls.filter((c) => c[0] === CRED)
    expect(credReads.length).toBe(1)
  })
})

describe("credentials service: admin writes", () => {
  it("creates a validated, encrypted, active credential and logs it", async () => {
    const { strapi, store } = seed()
    const service = credentialsFactory({ strapi })
    const created = await service.create(
      {
        provider: "ticketsource",
        label: "Central",
        scope: "library",
        status: "active",
        libraryDocumentIds: ["lib00000000000000000002"],
        credentials: { apiKey: "ts_live_ABCDEFGHIJ" },
      },
      "admin:7"
    )
    const row = store[CRED]!.find((c) => c.documentId === created.documentId)!
    expect(row.source).toBe("admin")
    expect(row.connectedBy).toBe("admin:7")
    expect(row.hints).toEqual({ apiKey: "••••GHIJ" })
    expect(row.credentialsEncrypted).not.toContain("ts_live")
    expect(created).not.toHaveProperty("credentialsEncrypted")
    expect(store[EVENTS]!.map((e) => e.action)).toContain("admin_created")
  })

  it("refuses values the registry rejects", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    await expect(
      service.create(
        {
          provider: "eventbrite",
          label: "x",
          scope: "library",
          credentials: { apiKey: "x" },
        },
        "admin:7"
      )
    ).rejects.toThrow(/Unexpected field|required/)
  })

  it("a values-only update writes an audit note of exactly 'values'", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.credentialsEncrypted = sealValues(
      { feedUrl: "https://x.example/a.ics" },
      "credA0000000000000000001",
      "current"
    )
    const service = credentialsFactory({ strapi })
    await service.update(
      "credA0000000000000000001",
      { credentials: { feedUrl: "https://y.example/b.ics" } },
      "admin:5"
    )
    const lastEvent = store[EVENTS]!.at(-1)
    expect(lastEvent).toMatchObject({
      action: "admin_updated",
      actor: "admin:5",
      note: "values",
    })
  })
})

describe("credentials service: reveal", () => {
  it("returns the value of a slot and logs who asked", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.credentialsEncrypted = sealValues(
      { feedUrl: "https://x.example/a.ics" },
      "credA0000000000000000001",
      "current"
    )
    const service = credentialsFactory({ strapi })
    expect(
      await service.reveal("credA0000000000000000001", "current", "admin:3")
    ).toEqual({
      feedUrl: "https://x.example/a.ics",
    })
    expect(store[EVENTS]!.at(-1)).toMatchObject({
      action: "revealed",
      actor: "admin:3",
    })
  })

  it("answers null for an empty pending slot", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    expect(
      await service.reveal("credA0000000000000000001", "pending", "admin:3")
    ).toBeNull()
  })
})

describe("credentials service: test", () => {
  it("stores the result code, not the provider's message", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.credentialsEncrypted = sealValues(
      { feedUrl: "https://x.example/a.ics" },
      "credA0000000000000000001",
      "current"
    )
    const service = credentialsFactory({
      strapi,
      testFeed: async () => ({
        result: "auth_failed",
        detail: "401 for https://x.example",
      }),
    })
    expect(
      await service.test("credA0000000000000000001", "current", "admin:1")
    ).toEqual({ result: "auth_failed" })
    expect(store[CRED]![0]!.lastTestResult).toBe("auth_failed")
  })

  it("records decrypt_failed when the stored blob can't be opened and does not call testFeed", async () => {
    const { strapi, store } = seed()
    // Seal for a different documentId so opening with the real id fails
    store[CRED]![0]!.credentialsEncrypted = sealValues(
      { feedUrl: "https://x.example/a.ics" },
      "credOTHER000000000000000000",
      "current"
    )
    const testFeedSpy = vi.fn(async () => ({
      result: "ok" as const,
    }))
    const service = credentialsFactory({
      strapi,
      testFeed: testFeedSpy,
    })
    expect(
      await service.test("credA0000000000000000001", "current", "admin:1")
    ).toEqual({ result: "decrypt_failed" })
    expect(store[CRED]![0]!.lastTestResult).toBe("decrypt_failed")
    expect(testFeedSpy).not.toHaveBeenCalled()
  })

  it("records provider_error when testFeed rejects", async () => {
    const { strapi, store } = seed()
    store[CRED]![0]!.credentialsEncrypted = sealValues(
      { feedUrl: "https://x.example/a.ics" },
      "credA0000000000000000001",
      "current"
    )
    const service = credentialsFactory({
      strapi,
      testFeed: async () => {
        throw new Error("Network timeout")
      },
    })
    expect(
      await service.test("credA0000000000000000001", "current", "admin:1")
    ).toEqual({ result: "provider_error" })
    expect(store[CRED]![0]!.lastTestResult).toBe("provider_error")
  })
})

describe("credentials service: delete", () => {
  it("removes only the deleted credential's events, logs it and resyncs its libraries", async () => {
    const { strapi, store } = seed()
    const EVENT_UID = "plugin::events.event"
    store[EVENT_UID] = [
      { documentId: "evA1", credentialId: 1 },
      { documentId: "evB1", credentialId: 2 },
    ]
    const service = credentialsFactory({ strapi })

    const removed = await service.delete("credA0000000000000000001", "admin:9")

    expect(removed?.documentId).toBe("credA0000000000000000001")
    expect(store[EVENT_UID]!.map((e) => e.documentId)).toEqual(["evB1"])
    expect(store[EVENTS]!.at(-1)).toMatchObject({
      action: "admin_deleted",
      actor: "admin:9",
    })
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
  })
})

describe("credentials service: encryption binding", () => {
  it("create binds the stored blob to the credential's documentId", async () => {
    const { strapi, store } = seed()
    store[LIBRARY]![0]!.hasActiveFeed = false
    store[CRED]!.length = 0
    const service = credentialsFactory({ strapi })

    const created = await service.create(
      {
        provider: "ical",
        label: "New",
        scope: "library",
        status: "active",
        libraryDocumentIds: ["lib00000000000000000001"],
        credentials: { feedUrl: "https://example.com/cal.ics" },
      },
      "admin:7"
    )

    const row = store[CRED]!.find((c) => c.documentId === created.documentId)!
    expect(row).toBeDefined()
    expect(
      JSON.parse(
        decrypt(row.credentialsEncrypted, KEY, undefined, {
          aad: row.documentId,
        })
      )
    ).toEqual({ feedUrl: "https://example.com/cal.ics" })
    expect(() => decrypt(row.credentialsEncrypted, KEY)).toThrow()
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(true)
  })
})
