import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"

const LIBRARY = "api::library.library"
const PROFILE = "api::user-profile.user-profile"
const AFF = "api::library-affiliation.library-affiliation"
const ROLE_GRANT = "api::role-grant.role-grant"

function ctx(body: Record<string, unknown>, secret = "s3cret") {
  const c: any = {
    request: { body, header: { "x-service-secret": secret } },
    send: (b: unknown) => ((c.status = 200), (c.body = b)),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
    forbidden: (m: string) => ((c.status = 403), (c.body = m)),
    notFound: (m: string) => ((c.status = 404), (c.body = m)),
  }

  return c
}

const claim = (userEmail: string, entityRef = "GB-BL-001") => ({
  baUserId: "u1",
  entityRef,
  verificationMethod: "email_domain",
  userEmail,
  emailVerified: true,
})

describe("auth-bridge createAffiliation: email-domain auto-claim (E6)", () => {
  let fake: any
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const faked = makeFakeStrapi({
      [LIBRARY]: [
        {
          id: 1,
          documentId: "lib1",
          entityRef: "GB-BL-001",
          website: "https://www.bl.uk/",
          email: "enquiries@bl-mail.org",
          publishedAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: 2,
          documentId: "lib2",
          entityRef: "GB-DR-002",
          website: "https://draft.example",
          publishedAt: null,
        },
        {
          id: 3,
          documentId: "lib3",
          entityRef: "GB-BT-003",
          website: "https://btinternet.com/libraries/x",
          publishedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      [PROFILE]: [
        { documentId: "p1", baUserId: "u1", contributorRole: "reader" },
      ],
    })
    ;(globalThis as any).strapi = faked.strapi
    fake = { ...faked.strapi, store: faked.store }
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("verifies a user whose email domain matches the library website", async () => {
    const c = ctx(claim("ada@bl.uk"))
    await controller.createAffiliation(c)

    expect(c.status).toBe(200)
    expect(c.body).toEqual({ ok: true })
    expect(fake.store[AFF]).toHaveLength(1)
    expect(fake.store[AFF][0]).toMatchObject({
      baUserId: "u1",
      verificationMethod: "email_domain",
      library: { connect: [{ documentId: "lib1" }] },
    })
    expect(fake.store[ROLE_GRANT]).toHaveLength(1)
    expect(fake.store[ROLE_GRANT][0]).toMatchObject({
      baUserId: "u1",
      role: "verified_librarian",
      queue: "all",
      locale: null,
      source: "claim",
      reason: "Approved Library Claim",
    })
    // The profile is not written directly: the role-grant lifecycle derives it.
    expect(fake.store[PROFILE][0]).toMatchObject({ contributorRole: "reader" })
    expect(fake.store[PROFILE][0].isVerifiedLibrarian).toBeUndefined()
  })

  it("does not duplicate the grant on a second verification", async () => {
    await controller.createAffiliation(ctx(claim("ada@bl.uk")))
    await controller.createAffiliation(ctx(claim("ada@bl.uk")))

    expect(fake.store[ROLE_GRANT]).toHaveLength(1)
  })

  it("looks the library up as a published document by entityRef", async () => {
    await controller.createAffiliation(ctx(claim("ada@bl.uk")))

    const i = fake.documents.mock.calls.findIndex(
      ([u]: [string]) => u === LIBRARY
    )
    const { findFirst } = fake.documents.mock.results[i].value
    expect(findFirst).toHaveBeenCalledTimes(1)
    expect(findFirst.mock.calls[0][0]).toMatchObject({
      status: "published",
      filters: { entityRef: { $eq: "GB-BL-001" } },
    })
    expect(fake.db.query).not.toHaveBeenCalledWith(LIBRARY)
  })

  it("does not verify on a match with the library's contact email domain alone", async () => {
    const c = ctx(claim("ada@bl-mail.org"))
    await controller.createAffiliation(c)

    expect(c.status).toBe(403)
    expect(c.body).toBe("domain_mismatch")
    expect(fake.store[AFF] ?? []).toHaveLength(0)
  })

  it.each(["ada@btinternet.com", "ada@gmail.com", "ada@yahoo.co.uk"])(
    "never verifies a consumer mailbox (%s), even when the website matches",
    async (email) => {
      const c = ctx(claim(email, "GB-BT-003"))
      await controller.createAffiliation(c)

      expect(c.status).toBe(403)
      expect(c.body).toBe("domain_mismatch")
    }
  )

  it("does not find a library that is not published", async () => {
    const c = ctx(claim("ada@draft.example", "GB-DR-002"))
    await controller.createAffiliation(c)

    expect(c.status).toBe(404)
  })

  it("requires the bridge secret and a verified email", async () => {
    const bad = ctx(claim("ada@bl.uk"), "wrong")
    await controller.createAffiliation(bad)
    expect(bad.status).toBe(401)

    const unverified = ctx({ ...claim("ada@bl.uk"), emailVerified: false })
    await controller.createAffiliation(unverified)
    expect(unverified.status).toBe(403)
  })
})
