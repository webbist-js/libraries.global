/* eslint-disable sonarjs/no-hardcoded-ip -- SSRF guard fixtures */
import { describe, expect, it } from "vitest"

import { mockHttp } from "./helpers"
import { CatalogueHttp, isBlockedAddress } from "../src/http"
import { CatalogueError } from "../src/types"

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "::1",
    "fd00::1",
    "::ffff:10.0.0.1",
  ])("blocks %s", (ip) => expect(isBlockedAddress(ip)).toBe(true))
  it("allows public addresses", () => {
    expect(isBlockedAddress("93.184.216.34")).toBe(false)
  })
})

describe("CatalogueHttp", () => {
  it("refuses private hosts with the default guard", async () => {
    const http = new CatalogueHttp({ minIntervalMs: 0 })
    await expect(http.get("http://127.0.0.1/")).rejects.toMatchObject({
      code: "unsafe_url",
    })
  })

  it("refuses non-http schemes", async () => {
    const http = new CatalogueHttp({ minIntervalMs: 0 })
    await expect(http.get("file:///etc/passwd")).rejects.toMatchObject({
      code: "unsafe_url",
    })
  })

  it("follows redirects, records them, and carries cookies", async () => {
    const { http, requests } = mockHttp([
      {
        match: "/start",
        status: 302,
        headers: { location: "/end", "set-cookie": "JSESSIONID=abc; Path=/" },
      },
      { match: "/end", body: "done" },
    ])
    const res = await http.get("https://opac.example.org/start")

    expect(res.text).toBe("done")
    expect(res.url).toBe("https://opac.example.org/end")
    expect(res.redirects).toEqual(["https://opac.example.org/start"])
    expect(requests).toHaveLength(2)
  })

  it("sends stored cookies on later requests", async () => {
    const seen: string[] = []
    const http = new CatalogueHttp({
      hostGuard: async () => {},
      minIntervalMs: 0,
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        seen.push((init?.headers as Record<string, string>).Cookie ?? "")

        return new Response("ok", {
          headers: { "set-cookie": "SID=1; Path=/" },
        })
      }) as typeof fetch,
    })
    await http.get("https://opac.example.org/a")
    await http.get("https://opac.example.org/b")
    expect(seen).toEqual(["", "SID=1"])
  })

  it("identifies itself honestly", async () => {
    let ua = ""
    const http = new CatalogueHttp({
      hostGuard: async () => {},
      minIntervalMs: 0,
      fetchImpl: (async (_url: string, init?: RequestInit) => {
        ua = (init?.headers as Record<string, string>)["User-Agent"]!

        return new Response("ok")
      }) as typeof fetch,
    })
    await http.get("https://opac.example.org/")
    expect(ua).toMatch(/^libraries\.global-catalogue-bot/)
  })

  it("raises bot_challenge instead of solving challenges", async () => {
    const { http } = mockHttp([
      {
        match: "/",
        body: "<script>function leastFactor(n) { return n; }</script>",
      },
    ])
    const err = await http.get("https://opac.example.org/").catch((e) => e)
    expect(err).toBeInstanceOf(CatalogueError)
    expect(err.code).toBe("bot_challenge")
  })

  it("throws on non-2xx unless allowed", async () => {
    const { http } = mockHttp([{ match: "/missing", status: 404 }])
    await expect(
      http.get("https://opac.example.org/missing")
    ).rejects.toMatchObject({ code: "http" })
    const res = await http.get("https://opac.example.org/missing", {
      allowStatus: [404],
    })
    expect(res.status).toBe(404)
  })
})

describe("blocking", () => {
  it("treats an Anubis proof-of-work page as a challenge", async () => {
    const { http } = mockHttp([
      { match: "/", body: '<div id="anubis_challenge"></div>' },
    ])
    await expect(http.get("https://opac.example.org/")).rejects.toMatchObject({
      code: "bot_challenge",
    })
  })

  it("reports a CDN access-denied page as blocked", async () => {
    const { http } = mockHttp([
      {
        match: "/",
        status: 403,
        body: "<HTML><HEAD><TITLE>Access Denied</TITLE></HEAD></HTML>",
      },
    ])
    await expect(http.get("https://opac.example.org/")).rejects.toMatchObject({
      code: "blocked",
    })
  })
})
