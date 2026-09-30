import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { makeFakeStrapi } from "./helpers/fake-strapi"
import controller from "../src/api/auth-bridge/controllers/auth-bridge"

const PROFILE = "api::user-profile.user-profile"
const UP_USER = "plugin::users-permissions.user"
const UP_ROLE = "plugin::users-permissions.role"

function ctx(body: Record<string, unknown>, secret = "s3cret") {
  const c: any = {
    request: { body, header: { "x-service-secret": secret } },
    send: (b: unknown) => ((c.status = 200), (c.body = b)),
    unauthorized: (m: string) => ((c.status = 401), (c.body = m)),
    badRequest: (m: string) => ((c.status = 400), (c.body = m)),
    internalServerError: (m: string) => ((c.status = 500), (c.body = m)),
  }

  return c
}

describe("auth-bridge syncUser (E6)", () => {
  let fake: any
  let issue: any
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
    const faked = makeFakeStrapi({
      [UP_ROLE]: [{ id: 1, documentId: "r1", type: "authenticated" }],
      [PROFILE]: [{ documentId: "p0", baUserId: "u0", contributorNumber: 41 }],
    })
    issue = vi.fn(() => "a.jwt.token")
    faked.services["users-permissions.jwt"] = { issue }
    // The bridge reads users through `strapi.query`, an alias of db.query.
    faked.strapi.query = faked.strapi.db.query
    ;(globalThis as any).strapi = faked.strapi
    fake = faked
  })
  afterEach(() => {
    delete (globalThis as any).strapi
  })

  it("creates the user and profile and returns no JWT", async () => {
    const c = ctx({
      email: "ada@example.org",
      name: "Ada Lovelace",
      provider: "local",
      baUserId: "u1",
    })
    await controller.syncUser(c)

    expect(c.status).toBe(200)
    expect(c.body).toEqual({
      user: {
        id: expect.any(Number),
        email: "ada@example.org",
        username: "ada@example.org",
      },
    })
    expect(c.body.jwt).toBeUndefined()
    expect(issue).not.toHaveBeenCalled()
    expect(fake.store[UP_USER]).toHaveLength(1)
    const profile = fake.store[PROFILE].find((p: any) => p.baUserId === "u1")
    expect(profile).toMatchObject({ firstName: "Ada", lastName: "Lovelace" })
  })

  it("numbers a new contributor after the current maximum, not by row count", async () => {
    // A gap (a deleted profile) must not let two people share a number.
    fake.store[PROFILE].push({
      documentId: "p9",
      baUserId: "u9",
      contributorNumber: 77,
    })
    const c = ctx({ email: "b@example.org", provider: "local", baUserId: "u2" })
    await controller.syncUser(c)

    const profile = fake.store[PROFILE].find((p: any) => p.baUserId === "u2")
    expect(profile.contributorNumber).toBe(78)
  })
})
