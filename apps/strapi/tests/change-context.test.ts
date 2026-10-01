import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  resolveChangeContext,
  runWithChangeContext,
  type ChangeContext,
} from "../src/utils/change-context"

const withRequest = (ctx: unknown) => ({
  requestContext: { get: () => ctx },
})

describe("resolveChangeContext", () => {
  const saved = process.env.STRAPI_BRIDGE_SECRET
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
  })
  afterEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = saved
  })

  it("prefers the runWithChangeContext value over the request context", async () => {
    const strapi = withRequest({
      state: { user: { id: 1, firstname: "Ada", lastname: "L" } },
    })
    const ctx: ChangeContext = {
      source: "submission",
      actorKind: "contributor",
      actorId: "ba:u1",
      reviewerId: "admin:2",
      submissionDocumentId: "sub1",
    }
    const got = await runWithChangeContext(ctx, async () =>
      resolveChangeContext(strapi)
    )
    expect(got).toEqual(ctx)
    // Outside the run the request context applies again.
    expect(resolveChangeContext(strapi).actorKind).toBe("admin")
  })

  it("resolves an admin user", () => {
    expect(
      resolveChangeContext(
        withRequest({
          state: {
            user: { id: 5, firstname: "Ada", lastname: "Lovelace" },
            auth: { strategy: { name: "admin" } },
          },
        })
      )
    ).toEqual({
      source: "admin",
      actorKind: "admin",
      actorId: "admin:5",
      actorName: "Ada Lovelace",
    })
  })

  it("classes ingest/import tokens as imports and others as api_token", () => {
    const token = (name: string) =>
      resolveChangeContext(
        withRequest({
          state: {
            auth: {
              strategy: { name: "content-api-token" },
              credentials: { name },
            },
          },
        })
      )
    expect(token("ingest-uk")).toMatchObject({
      source: "import",
      actorKind: "token",
      actorId: "ingest-uk",
    })
    expect(token("import-libraryon")).toMatchObject({ source: "import" })
    expect(token("ci-bot")).toMatchObject({
      source: "api_token",
      actorKind: "token",
      actorId: "ci-bot",
    })
  })

  it("trusts credentials.name as a token only under the content API token strategy", () => {
    const withStrategy = (strategy: unknown) =>
      resolveChangeContext(
        withRequest({
          state: { auth: { strategy, credentials: { name: "ingest-uk" } } },
        })
      )
    // Strapi 5.55.1 registers the content API token strategy as
    // "content-api-token" (@strapi/admin server/src/strategies).
    expect(withStrategy({ name: "content-api-token" })).toMatchObject({
      source: "import",
      actorKind: "token",
      actorId: "ingest-uk",
    })
    // Any other strategy (or none) carrying a `name` is not a token.
    expect(withStrategy({ name: "users-permissions" })).toMatchObject({
      source: "system",
      actorKind: "system",
    })
    expect(withStrategy(undefined)).toMatchObject({ source: "system" })
  })

  it("resolves a bridge call with a valid secret", () => {
    const bridge = (secret: string) =>
      resolveChangeContext(
        withRequest({
          state: {},
          request: {
            headers: {
              "x-service-secret": secret,
              "x-ba-user-id": "u42",
              "x-ba-user-name": "Grace",
            },
          },
        })
      )
    expect(bridge("s3cret")).toEqual({
      source: "submission",
      actorKind: "contributor",
      actorId: "ba:u42",
      actorName: "Grace",
    })
    expect(bridge("wrong")).toMatchObject({ source: "system" })
  })

  it("falls back to system", () => {
    const system = {
      source: "system",
      actorKind: "system",
      actorId: "system",
    }
    expect(resolveChangeContext({})).toEqual(system)
    expect(resolveChangeContext(withRequest(undefined))).toEqual(system)
  })
})
