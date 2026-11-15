import { once } from "node:events"
import { rm } from "node:fs/promises"
import type { Server } from "node:http"
import { createRequire } from "node:module"
import type { AddressInfo } from "node:net"

import { afterEach, describe, expect, it } from "vitest"

// Resolve exactly the copies loaded by Strapi, not unrelated workspace peers.
const fromStrapi = createRequire(require.resolve("@strapi/strapi"))
const fromCore = createRequire(fromStrapi.resolve("@strapi/core"))
const Koa = fromCore("koa")
const { koaBody } = fromCore("koa-body")
const { createSession, SessionOptions } = fromCore("koa-session")
const servers: Server[] = []
const uploads: string[] = []

type TestContext = {
  path: string
  body: unknown
  session: { count?: number } | null
  request: {
    body: Record<string, unknown>
    rawBody?: string
    files: {
      files: {
        filepath: string
        originalFilename: string
        size: number
        mimetype: string
      }
    }
  }
}

async function serve(app: {
  listen: (port: number, hostname: string) => Server
}) {
  const server: Server = app.listen(0, "127.0.0.1")
  servers.push(server)
  await once(server, "listening")

  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}
afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()))
          server.closeAllConnections()
        })
    )
  )
  await Promise.all(uploads.splice(0).map((file) => rm(file, { force: true })))
})
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ")
}

describe("Strapi HTTP dependency replacements", () => {
  it("parses JSON, preserves signed-webhook bytes and rejects malformed or oversized bodies", async () => {
    const app = new Koa()
    app.silent = true
    app.use(koaBody({ jsonLimit: "1kb", includeUnparsed: true }))
    app.use((ctx: TestContext) => {
      ctx.body = {
        data: ctx.request.body,
        raw: ctx.request.rawBody,
      }
    })
    const origin = await serve(app)
    const raw = '{ "data": {"title":"Library"} }'
    const response = await fetch(origin, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
    })
    expect(await response.json()).toEqual({
      data: { data: { title: "Library" } },
      raw,
    })
    expect(
      (
        await fetch(origin, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: "{",
        })
      ).status
    ).toBe(400)
    expect(
      (
        await fetch(origin, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ data: "x".repeat(2048) }),
        })
      ).status
    ).toBe(413)
  })

  it("preserves multipart field and file shapes used by CMS uploads", async () => {
    const app = new Koa()
    app.use(koaBody({ multipart: true }))
    app.use((ctx: TestContext) => {
      const file = ctx.request.files.files
      uploads.push(file.filepath)
      ctx.body = {
        data: ctx.request.body.data,
        name: file.originalFilename,
        size: file.size,
        type: file.mimetype,
      }
    })
    const form = new FormData()
    form.set("data", JSON.stringify({ title: "Library" }))
    form.set("files", new Blob(["hello"], { type: "text/plain" }), "sample.txt")
    const response = await fetch(await serve(app), {
      method: "POST",
      body: form,
    })
    expect(await response.json()).toEqual({
      data: '{"title":"Library"}',
      name: "sample.txt",
      size: 5,
      type: "text/plain",
    })
  })

  it("keeps signed session cookies, rejects tampering and clears sessions on logout", async () => {
    const app = new Koa()
    app.keys = ["http-dependency-test-signing-key"]
    app.use(
      createSession(
        { key: "koa.sess", httpOnly: true, signed: true, sameSite: "lax" },
        app
      )
    )
    app.use((ctx: TestContext) => {
      if (ctx.path === "/logout") {
        ctx.session = null
        ctx.body = "logged out"

        return
      }
      ctx.session.count = (ctx.session.count ?? 0) + 1
      ctx.body = { count: ctx.session.count }
    })
    const origin = await serve(app)
    const initial = await fetch(origin)
    const cookie = cookies(initial)
    expect(await initial.json()).toEqual({ count: 1 })
    expect(
      initial.headers
        .getSetCookie()
        .every((value) => value.includes("httponly"))
    ).toBe(true)
    expect(cookie).toContain("koa.sess.sig=")
    expect(await (await fetch(origin, { headers: { cookie } })).json()).toEqual(
      { count: 2 }
    )
    const forged = cookie.replace(/koa\.sess=[^;]+/, "koa.sess=forged")
    expect(
      await (await fetch(origin, { headers: { cookie: forged } })).json()
    ).toEqual({ count: 1 })
    const logout = await fetch(`${origin}/logout`, { headers: { cookie } })
    expect(
      logout.headers
        .getSetCookie()
        .some((value) => /expires=Thu, 01 Jan 1970/i.test(value))
    ).toBe(true)
  })

  it("refuses an expired signed session", async () => {
    const app = new Koa()
    app.keys = ["http-dependency-test-signing-key"]
    app.use(createSession({ maxAge: 5 }, app))
    app.use((ctx: TestContext) => {
      ctx.session.count = (ctx.session.count ?? 0) + 1
      ctx.body = { count: ctx.session.count }
    })
    const origin = await serve(app)
    const cookie = cookies(await fetch(origin))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await (await fetch(origin, { headers: { cookie } })).json()).toEqual(
      { count: 1 }
    )
  })

  it("keeps session configuration validation after the Zod migration", () => {
    expect(() => SessionOptions.parse({ signed: "false" })).toThrow()
    expect(() => SessionOptions.parse({ encode: "not a function" })).toThrow()
    expect(() =>
      SessionOptions.parse({ store: { get() {}, set() {} } })
    ).toThrow()
    const options = SessionOptions.parse({})
    expect(options.signed).toBe(true)
    expect(options.httpOnly).toBe(true)
    expect(options.decode(options.encode({ example: true }))).toEqual({
      example: true,
    })
  })
})
