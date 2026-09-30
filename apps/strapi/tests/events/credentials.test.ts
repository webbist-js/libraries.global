import { decrypt } from "@repo/events-crypto"
import { beforeEach, describe, expect, it } from "vitest"

import credentialsFactory from "../../src/plugins/events/server/services/credentials"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"
const LIBRARY = "api::library.library"
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
        isActive: true,
        credentialsEncrypted: "{}",
        libraries: [{ documentId: "lib00000000000000000001" }],
      },
      {
        documentId: "credB0000000000000000002",
        provider: "ical",
        label: "B",
        scope: "library",
        isActive: true,
        credentialsEncrypted: "{}",
        libraries: [{ documentId: "lib00000000000000000002" }],
      },
    ],
  })
}

/** Every `db.query(LIBRARY).updateMany` call's args, in order. */
const libraryUpdateManyCalls = (strapi: any) =>
  strapi.db.query.mock.results
    .filter(
      (_r: any, i: number) => strapi.db.query.mock.calls[i][0] === LIBRARY
    )
    .flatMap((r: any) => r.value.updateMany.mock.calls.map((c: any[]) => c[0]))

const publishedFlag = async (strapi: any, documentId: string) =>
  (await strapi.documents(LIBRARY).findOne({ documentId, status: "published" }))
    ?.hasActiveFeed

describe("credentials service: hasActiveFeed", () => {
  it("deactivating the only credential clears the flag on the published row, via both statuses", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })

    await service.update("credA0000000000000000001", { isActive: false })

    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
    expect(await publishedFlag(strapi, "lib00000000000000000002")).toBe(true)
    expect(libraryUpdateManyCalls(strapi)).toContainEqual({
      where: { documentId: { $in: ["lib00000000000000000001"] } },
      data: { hasActiveFeed: false },
    })
  })

  it("keeps the flag when another active credential still feeds the library", async () => {
    const { strapi, store } = seed()
    store[CRED]![1]!.libraries = [{ documentId: "lib00000000000000000001" }]
    const service = credentialsFactory({ strapi })

    await service.update("credA0000000000000000001", { isActive: false })

    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(true)
  })

  it("deleting a credential recomputes the flag for its libraries", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })

    await service.delete("credB0000000000000000002")

    expect(await publishedFlag(strapi, "lib00000000000000000002")).toBe(false)
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(true)
  })

  it("moving a credential to another library clears the old one and sets the new one", async () => {
    const { strapi, store } = seed()
    store[LIBRARY]![1]!.hasActiveFeed = false
    store[CRED]![1]!.isActive = false
    const service = credentialsFactory({ strapi })

    await service.update("credA0000000000000000001", {
      libraryDocumentIds: ["lib00000000000000000002"],
    })

    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
    expect(await publishedFlag(strapi, "lib00000000000000000002")).toBe(true)
  })

  it("update reads the credential's libraries itself when the caller passes none", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })
    // deactivate then reactivate without libraryDocumentIds: the flag follows
    await service.update("credA0000000000000000001", { isActive: false })
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(false)
    await service.update("credA0000000000000000001", { isActive: true })
    expect(await publishedFlag(strapi, "lib00000000000000000001")).toBe(true)
  })
})

describe("credentials service: encryption binding", () => {
  it("create binds the stored blob to the credential's documentId", async () => {
    const { strapi, store } = seed()
    store[LIBRARY]![0]!.hasActiveFeed = false
    store[CRED]!.length = 0
    const service = credentialsFactory({ strapi })

    const created = await service.create({
      provider: "ical",
      label: "New",
      scope: "library",
      isActive: true,
      libraryDocumentIds: ["lib00000000000000000001"],
      credentials: { feedUrl: "https://example.com/cal.ics" },
    })

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

  it("update re-encrypts under the same documentId and getDecryptedCredentials reads it back", async () => {
    const { strapi } = seed()
    const service = credentialsFactory({ strapi })

    await service.update("credA0000000000000000001", {
      credentials: { feedUrl: "https://example.com/new.ics" },
    })

    expect(
      await service.getDecryptedCredentials("credA0000000000000000001")
    ).toEqual({
      feedUrl: "https://example.com/new.ics",
    })
  })
})
