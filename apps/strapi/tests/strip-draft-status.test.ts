import qs from "qs"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import middleware, {
  stripStatusFromQuerystring,
} from "../src/middlewares/strip-draft-status"

// Mirrors strapi::query: `query` is re-parsed from `querystring` (cached per
// string), and `ctx.query` delegates to `ctx.request.query`.
function makeCtx(path: string, querystring: string, secret?: string) {
  const cache: Record<string, any> = {}
  const request: any = {
    querystring,
    headers: secret ? { "x-service-secret": secret } : {},
    get query() {
      cache[this.querystring] ??= qs.parse(this.querystring)

      return cache[this.querystring]
    },
  }
  const ctx: any = {
    path,
    request,
    get querystring() {
      return request.querystring
    },
    set querystring(v: string) {
      request.querystring = v
    },
    get query() {
      return request.query
    },
  }

  return ctx
}

async function run(ctx: any) {
  const next = vi.fn(async () => {})
  await middleware({}, { strapi: {} })(ctx, next)
  expect(next).toHaveBeenCalledOnce()

  return ctx
}

describe("strip-draft-status middleware", () => {
  beforeEach(() => {
    process.env.STRAPI_BRIDGE_SECRET = "s3cret"
  })
  afterEach(() => {
    delete process.env.STRAPI_BRIDGE_SECRET
  })

  it("strips ?status on /api/* without the secret", async () => {
    const ctx = await run(
      makeCtx("/api/wiki-articles", "status=draft&populate=*")
    )
    expect(ctx.query.status).toBeUndefined()
    expect(ctx.request.query.status).toBeUndefined()
    expect(ctx.query.populate).toBe("*")
    expect(ctx.querystring).toBe("populate=*")
  })

  it("strips encoded and bracketed status keys", async () => {
    const ctx = await run(
      makeCtx(
        "/api/libraries/abc",
        "st%61tus=draft&status[0]=draft&status%5B%24eq%5D=draft&fields[0]=name"
      )
    )
    expect(ctx.query.status).toBeUndefined()
    expect(ctx.query.fields).toEqual(["name"])
  })

  it("strips with a wrong secret", async () => {
    const ctx = await run(makeCtx("/api/countries", "status=draft", "nope"))
    expect(ctx.query.status).toBeUndefined()
  })

  it("keeps status with a valid secret", async () => {
    const ctx = await run(
      makeCtx("/api/blog-articles", "status=draft", "s3cret")
    )
    expect(ctx.query.status).toBe("draft")
    expect(ctx.querystring).toBe("status=draft")
  })

  it("leaves non-/api paths untouched", async () => {
    const ctx = await run(
      makeCtx("/content-moderation/submissions", "status=pending")
    )
    expect(ctx.query.status).toBe("pending")
    expect(ctx.querystring).toBe("status=pending")
  })

  it("leaves a querystring without status unchanged", () => {
    expect(stripStatusFromQuerystring("a=1&b[0]=2")).toBe("a=1&b[0]=2")
    expect(stripStatusFromQuerystring("")).toBe("")
    expect(stripStatusFromQuerystring("statusx=1")).toBe("statusx=1")
  })
})
