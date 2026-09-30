import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

const { POST } = await import("../route")

const post = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/newsletter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "203.0.113.7",
        ...headers,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

/** A fresh client address per test, so the per-IP limiter starts empty. */
let nextIp = 0
const ip = () => {
  nextIp += 1

  return `198.51.100.${nextIp}`
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("STRAPI_URL", "http://strapi.test")
  vi.stubEnv("STRAPI_BRIDGE_SECRET", "s3cret")
  fetchMock.mockResolvedValue(Response.json({ data: { id: 1 } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("POST /api/newsletter", () => {
  it("subscribes a valid address through the bridge with the client IP", async () => {
    const res = await post(
      { email: "reader@example.org" },
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe("http://strapi.test/api/subscribers")
    expect(init.method).toBe("POST")
    expect(init.headers).toMatchObject({
      "X-Service-Secret": "s3cret",
      "X-Forwarded-For": expect.stringMatching(/^198\.51\.100\.\d+$/),
    })
    expect(JSON.parse(init.body as string)).toEqual({
      email: "reader@example.org",
    })
  })

  it.each([
    ["a bad email", { email: "not-an-email" }],
    ["no email", {}],
    ["an email that isn't a string", { email: 42 }],
    ["a body that isn't JSON", "email=x"],
  ])("returns 400 for %s", async (_label, body) => {
    const res = await post(body, { "x-forwarded-for": ip() })

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects a filled honeypot without calling Strapi", async () => {
    const res = await post(
      { email: "bot@example.org", website: "http://spam.example" },
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("accepts an empty honeypot", async () => {
    const res = await post(
      { email: "reader@example.org", website: "" },
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(200)
  })

  it("returns 429 on the sixth call from one address within an hour", async () => {
    const address = ip()
    for (let i = 0; i < 5; i++) {
      const res = await post(
        { email: `r${i}@example.org` },
        { "x-forwarded-for": address }
      )
      expect(res.status).toBe(200)
    }

    const sixth = await post(
      { email: "r6@example.org" },
      { "x-forwarded-for": address }
    )

    expect(sixth.status).toBe(429)
    expect(sixth.headers.get("retry-after")).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it("does not count another address's calls", async () => {
    const a = ip()
    for (let i = 0; i < 5; i++)
      await post({ email: `r${i}@example.org` }, { "x-forwarded-for": a })

    const other = await post(
      { email: "other@example.org" },
      { "x-forwarded-for": ip() }
    )

    expect(other.status).toBe(200)
  })

  it("returns 503 without calling Strapi when the bridge secret isn't set", async () => {
    vi.stubEnv("STRAPI_BRIDGE_SECRET", "")

    const res = await post(
      { email: "reader@example.org" },
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("treats an already-subscribed address as success", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ error: "exists" }, { status: 409 })
    )

    const res = await post(
      { email: "reader@example.org" },
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(200)
  })

  it("returns 502 without echoing Strapi's body on any other failure", async () => {
    fetchMock.mockResolvedValue(
      new Response("classified upstream detail", { status: 500 })
    )

    const res = await post(
      { email: "reader@example.org" },
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(502)
    expect(await res.text()).not.toContain("classified upstream detail")
  })

  it("returns 502 when Strapi is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"))

    const res = await post(
      { email: "reader@example.org" },
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(502)
  })

  it("returns 413 for an oversized body before reading it", async () => {
    const res = await post(
      JSON.stringify({ email: "reader@example.org" }) + " ".repeat(5000),
      { "x-forwarded-for": ip() }
    )

    expect(res.status).toBe(413)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
