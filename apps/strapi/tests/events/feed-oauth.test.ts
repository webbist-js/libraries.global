import { beforeEach, describe, expect, it, vi } from "vitest"

import oauthFactory from "../../src/plugins/events/server/services/feed-oauth"
import { openValues } from "../../src/plugins/events/server/utils/credential-crypto"
import { makeFakeStrapi } from "../helpers/fake-strapi"

const CRED = "plugin::events.event-credential"
const L1 = "lib00000000000000000001"
const USER = { id: "u1", email: "u@x.org", name: "U" }

beforeEach(() => {
  process.env.EVENTS_CREDENTIAL_KEY = "e".repeat(64)
  process.env.EVENTBRITE_CLIENT_ID = "cid"
  process.env.EVENTBRITE_CLIENT_SECRET = "csecret"
  process.env.EVENTBRITE_REDIRECT_URI =
    "https://libraries.global/api/contribute/event-feeds/eventbrite/callback"
})

function setup(orgs: { id: string; name: string }[]) {
  const fake = makeFakeStrapi({
    [CRED]: [],
    "plugin::events.credential-event": [],
    "api::library.library": [{ documentId: L1, name: "Central" }],
  })
  const http = vi.fn(async (url: string, init?: any) => {
    if (url.endsWith("/oauth/token")) {
      expect(String(init.body)).toContain("client_secret=csecret")

      return Response.json(
        {
          access_token: "EB_TOKEN_ABCDEFGHIJKL",
          token_type: "bearer",
        },
        { status: 200 }
      )
    }

    return Response.json(
      { organizations: orgs },
      {
        status: 200,
      }
    )
  })
  const complete = vi.fn(async () => ({
    submissionDocumentId: "s1",
    result: "ok",
  }))
  const claims = new Set([L1])
  const check = vi.fn(async () => ({ ok: true }))
  fake.strapi.plugin = vi.fn(() => ({
    service: (s: string) =>
      s === "submission-policy"
        ? {
            loadCapabilities: async () => ({
              caps: {
                claimedLibraryIds: claims,
                set: new Set(["events.feed"]),
              },
            }),
            check,
          }
        : undefined,
  }))
  const svc = oauthFactory({
    strapi: fake.strapi,
    http,
    completeDraft: complete,
  })

  return { ...fake, svc, http, complete, check }
}

describe("Eventbrite OAuth", () => {
  it("stores the token encrypted on a draft and lists organisations", async () => {
    const { svc, store } = setup([
      { id: "111", name: "A" },
      { id: "222", name: "B" },
    ])
    const r: any = await svc.exchangeEventbrite(USER, {
      code: "c0de",
      libraryDocumentId: L1,
    })
    const row = store[CRED]![0]!
    expect(row.status).toBe("draft")
    expect(
      openValues(row.credentialsEncrypted, row.documentId, "current")
    ).toEqual({ accessToken: "EB_TOKEN_ABCDEFGHIJKL" })
    expect(r.organizations).toHaveLength(2)
    expect(JSON.stringify(r)).not.toContain("EB_TOKEN")
  })

  it("completes at once when there is one organisation", async () => {
    const { svc, complete } = setup([{ id: "111", name: "A" }])
    const r: any = await svc.exchangeEventbrite(USER, {
      code: "c0de",
      libraryDocumentId: L1,
    })
    expect(complete).toHaveBeenCalledWith(USER, expect.any(String), "111")
    expect(r.completed).toEqual({ submissionDocumentId: "s1", result: "ok" })
  })

  it("refuses an unclaimed library and an unconfigured app", async () => {
    const { svc } = setup([])
    expect(
      await svc.exchangeEventbrite(USER, {
        code: "c",
        libraryDocumentId: "libX0000000000000000001",
      })
    ).toMatchObject({ error: { status: 404 } })
    delete process.env.EVENTBRITE_CLIENT_SECRET
    expect(
      await svc.exchangeEventbrite(USER, { code: "c", libraryDocumentId: L1 })
    ).toMatchObject({ error: { status: 503 } })
  })

  // Finding 4: the OAuth exchange used to skip the submission policy and
  // the per-library feed quota entirely — only `feeds.connect` ran them.
  it("passes the submission policy's refusal through, before any token exchange", async () => {
    const { svc, http, check } = setup([])
    check.mockResolvedValueOnce({
      ok: false,
      status: 429,
      message: "Too many pending",
    })
    const r: any = await svc.exchangeEventbrite(USER, {
      code: "c0de",
      libraryDocumentId: L1,
    })
    expect(r.error).toMatchObject({ status: 429 })
    expect(http).not.toHaveBeenCalled()
  })

  it("refuses a sixth feed on the library, before any token exchange", async () => {
    const { svc, store, http } = setup([])
    for (let i = 0; i < 5; i++)
      store[CRED]!.push({
        documentId: `credX00000000000000000${i}`,
        provider: "ical",
        status: "active",
        scope: "library",
        libraries: [{ documentId: L1 }],
      } as any)
    const r: any = await svc.exchangeEventbrite(USER, {
      code: "c0de",
      libraryDocumentId: L1,
    })
    expect(r.error).toMatchObject({ status: 409, name: "too_many_feeds" })
    expect(http).not.toHaveBeenCalled()
  })
})
