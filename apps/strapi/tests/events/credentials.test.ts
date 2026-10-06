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
        documentId: "credA0000000000000000001",
        provider: "ical",
        label: "A",
        scope: "library",
        status: "active",
        credentialsEncrypted: "{}",
        libraries: [{ documentId: "lib00000000000000000001" }],
      },
      {
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
