import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock("@/lib/contact/email", () => ({ sendContactNotification: send }))
import { POST } from "../route"

let address = 0
const contact = {
  mode: "contact",
  type: "general_inquiry",
  name: "Reader",
  email: " Reader@Example.org ",
  message: "I would like to ask about the project.",
  context: {
    page: "/libraries?token=secret#private",
    locale: "en",
    viewport: { width: 390, height: 844 },
  },
}
const request = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("https://libraries.global/api/contact", {
    method: "POST",
    headers: {
      origin: "https://libraries.global",
      "Content-Type": "application/json",
      "x-forwarded-for": `198.51.100.${++address}`,
      "user-agent": "Test browser",
      ...headers,
    },
    body: JSON.stringify(body),
  })
beforeEach(() => {
  vi.clearAllMocks()
  send.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe("website contact delivery", () => {
  it("sends normalized contact data with safe context and a server-generated reference", async () => {
    const response = await POST(request(contact))
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    const result = await response.json()
    expect(result.reference).toMatch(/^[\da-f-]{36}$/)
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "reader@example.org",
        context: {
          page: "/libraries",
          locale: "en",
          viewport: { width: 390, height: 844 },
        },
      }),
      "Test browser",
      result.reference
    )
  })
  it("accepts anonymous structured beta feedback without an account", async () => {
    const response = await POST(
      request({
        mode: "feedback",
        topic: "idea",
        task: "find_library",
        outcome: "partly",
        ease: 3,
        message: "A filter for quiet study spaces would help.",
        context: { page: "/map", locale: "cs" },
      })
    )
    expect(response.status).toBe(200)
    expect(send.mock.calls[0]![0].email).toBeUndefined()
  })
  it("rejects cross-origin requests and missing origin", async () => {
    expect(
      (await POST(request(contact, { origin: "https://other.test" }))).status
    ).toBe(403)
    expect((await POST(request(contact, { origin: "" }))).status).toBe(403)
    expect(send).not.toHaveBeenCalled()
  })
  it.each([
    { ...contact, to: "injected@example.org" },
    { ...contact, type: "unknown" },
    { ...contact, email: "" },
    { ...contact, name: "Injected\r\nBcc: test@example.org" },
    { ...contact, message: "short" },
    {
      ...contact,
      context: {
        page: "/",
        locale: "en",
        viewport: { width: -1, height: 100 },
      },
    },
  ])("rejects invalid or injected submissions", async (body) => {
    expect((await POST(request(body))).status).toBe(400)
    expect(send).not.toHaveBeenCalled()
  })
  it("caps the actual request size", async () => {
    expect(
      (await POST(request({ ...contact, message: "x".repeat(21000) }))).status
    ).toBe(413)
    expect(send).not.toHaveBeenCalled()
  })
  it("suppresses honeypot submissions", async () => {
    expect(
      (await POST(request({ ...contact, website: "https://spam.test" }))).status
    ).toBe(200)
    expect(send).not.toHaveBeenCalled()
  })
  it("preserves a provider failure instead of claiming the message was sent", async () => {
    send.mockRejectedValue(new Error("SMTP unavailable"))
    expect((await POST(request(contact))).status).toBe(503)
  })
  it("limits the combined contact and feedback endpoint", async () => {
    const headers = { "x-forwarded-for": "203.0.113.250" }
    for (let i = 0; i < 5; i++)
      expect((await POST(request(contact, headers))).status).toBe(200)
    const limited = await POST(request(contact, headers))
    expect(limited.status).toBe(429)
    expect(limited.headers.get("retry-after")).toBeTruthy()
    expect(send).toHaveBeenCalledTimes(5)
  })
})
