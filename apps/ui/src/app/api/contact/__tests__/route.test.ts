import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { send, queue } = vi.hoisted(() => ({ send: vi.fn(), queue: vi.fn() }))
vi.mock("@/lib/contact/email", () => ({ sendContactNotification: send }))
vi.mock("@/lib/contact/slack", () => ({ queueFeedbackNotification: queue }))
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
  queue.mockResolvedValue(false)
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
  it("delivers membership support through the existing contact route", async () => {
    const response = await POST(
      request({ ...contact, type: "membership_support" })
    )
    expect(response.status).toBe(200)
    const { reference } = await response.json()
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "contact",
        type: "membership_support",
        email: "reader@example.org",
      }),
      "Test browser",
      reference
    )
  })
  it("delivers normalized Atlas feedback with its feature answers and wishlist", async () => {
    const response = await POST(
      request({
        mode: "feedback",
        topic: "experience",
        task: "check_accessibility",
        outcome: "yes",
        message: "The accessibility filters helped me plan a visit.",
        atlas: {
          features: ["filters", "accessibility", "library_details"],
          clarity: 5,
          wishlist: "  Show public transport connections.  ",
        },
        context: { page: "/atlas?search=private", locale: "en" },
      })
    )
    expect(response.status).toBe(200)
    const { reference } = await response.json()
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        task: "check_accessibility",
        atlas: {
          features: ["filters", "accessibility", "library_details"],
          clarity: 5,
          wishlist: "Show public transport connections.",
        },
        context: { page: "/atlas", locale: "en" },
      }),
      "Test browser",
      reference
    )
  })
  it("rejects duplicate Atlas feature answers before sending email", async () => {
    const response = await POST(
      request({
        mode: "feedback",
        topic: "problem",
        task: "export_data",
        outcome: "no",
        message: "The export did not include the selected libraries.",
        atlas: { features: ["exports", "exports"] },
        context: { page: "/atlas", locale: "en" },
      })
    )
    expect(response.status).toBe(400)
    expect(send).not.toHaveBeenCalled()
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
    expect(queue).not.toHaveBeenCalled()
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

it("persists feedback before sending its email copy and accepts it if SMTP fails", async () => {
  queue.mockResolvedValue(true)
  send.mockRejectedValue(new Error("SMTP unavailable"))
  const response = await POST(
    request({
      mode: "feedback",
      topic: "problem",
      task: "find_library",
      outcome: "no",
      message: "The map filter did not include the expected Library.",
      context: { page: "/map", locale: "en" },
    })
  )
  expect(response.status).toBe(200)
  const { reference } = await response.json()
  expect(queue).toHaveBeenCalledWith(
    expect.objectContaining({ mode: "feedback" }),
    reference
  )
  expect(queue.mock.invocationCallOrder[0]).toBeLessThan(
    send.mock.invocationCallOrder[0]!
  )
})
it("does not acknowledge feedback when the enabled durable queue cannot persist it", async () => {
  queue.mockRejectedValue(new Error("Database unavailable"))
  const response = await POST(
    request({
      mode: "feedback",
      topic: "idea",
      task: "explore",
      outcome: "partly",
      message: "Please make it easier to compare the map layers.",
      context: { page: "/map", locale: "en" },
    })
  )
  expect(response.status).toBe(503)
  expect(send).not.toHaveBeenCalled()
})
