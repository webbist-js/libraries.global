import http from "node:http"
import type { AddressInfo } from "node:net"

import { afterAll, beforeAll, describe, expect, it } from "vitest"

import { boundedFetchText } from "../../src/lib/safe-fetch"

// These tests use the real global fetch, a real undici Agent and a real
// local HTTP server: they prove the pinned lookup, the timeout and the byte
// cap hold on the wire, not only against mocks.

let server: http.Server
let port: number

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/hang") {
      // never respond
      return
    }
    if (req.url === "/big") {
      res.writeHead(200, { "content-type": "text/plain" })
      const chunk = Buffer.alloc(64 * 1024, "a")
      let sent = 0
      const push = () => {
        while (sent < 64 * 1024 * 1024) {
          sent += chunk.length
          if (!res.write(chunk)) {
            res.once("drain", push)

            return
          }
        }
        res.end()
      }
      push()

      return
    }
    res.writeHead(200, { "content-type": "text/plain" })
    res.end(`hello from ${req.headers.host ?? ""}`)
  })
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve())
  )
  port = (server.address() as AddressInfo).port
})

afterAll(async () => {
  server.closeAllConnections?.()
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe("boundedFetchText (real server)", () => {
  it("connects to the pinned address, not whatever the hostname resolves to", async () => {
    const r = await boundedFetchText(
      `http://pinned.invalid:${port}/ok`,
      {},
      { addresses: ["127.0.0.1"], timeoutMs: 5000, maxBytes: 1024 }
    )
    expect(r.status).toBe(200)
    expect(r.text).toBe(`hello from pinned.invalid:${port}`)
  })

  it("rejects on timeout when the server hangs", async () => {
    await expect(
      boundedFetchText(
        `http://pinned.invalid:${port}/hang`,
        {},
        { addresses: ["127.0.0.1"], timeoutMs: 200, maxBytes: 1024 }
      )
    ).rejects.toThrow(/timed out|timeout/i)
  })

  it("rejects once the body passes the byte cap", async () => {
    await expect(
      boundedFetchText(
        `http://pinned.invalid:${port}/big`,
        {},
        { addresses: ["127.0.0.1"], timeoutMs: 5000, maxBytes: 256 * 1024 }
      )
    ).rejects.toThrow(/too large/i)
  })
})
