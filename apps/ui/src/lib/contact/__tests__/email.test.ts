import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { sendMail, transport } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  transport: vi.fn(),
}))
vi.mock("@/lib/email-transport", () => ({ createEmailTransport: transport }))
import { contactEmail, sendContactNotification } from "../email"
import type { ContactSubmission } from "../schema"

const contact: ContactSubmission = {
  mode: "contact",
  type: "plans",
  name: "Reader",
  email: "reader@example.org",
  message: "We’re interested in a Team plan.",
  sourceSubject: "Pro grant",
  context: { page: "/contribute", locale: "en" },
}
beforeEach(() => {
  vi.clearAllMocks()
  transport.mockReturnValue({ sendMail })
  sendMail.mockResolvedValue({ rejected: [] })
})
afterEach(() => vi.unstubAllEnvs())

it("uses a programmatic title and the contact system email variant", () => {
  const email = contactEmail(
    contact,
    "Chrome test",
    "reference",
    new Date("2026-10-11T12:00:00Z")
  )
  expect(email.subject).toBe("[Contact] Plans and membership · /contribute")
  expect(email.text).toContain("System notification · Contact request")
  expect(email.text).toContain("Pro grant")
  expect(email.text).toContain("Browser / OS: Chrome test")
  expect(email.text).toContain("Reference: reference")
  expect(email.html).not.toContain("Unsubscribe")
})
it("adds structured product metrics to beta feedback and escapes visitor HTML", () => {
  const email = contactEmail(
    {
      mode: "feedback",
      topic: "problem",
      task: "find_library",
      outcome: "no",
      ease: 2,
      message: '<script>alert("test")</script>',
      steps: "1. Open the map",
      context: {
        page: "/map",
        locale: "en",
        viewport: { width: 390, height: 844 },
      },
    },
    "Safari test",
    "ref",
    new Date()
  )
  expect(email.subject).toBe("[Beta feedback] Problem · /map")
  expect(email.text).toContain("Completed their task: No")
  expect(email.text).toContain("2/5")
  expect(email.text).toContain("390 × 844")
  expect(email.text).toContain("Steps to reproduce")
  expect(email.html).toContain("&lt;script&gt;")
  expect(email.html).not.toContain("<script>")
})
it("delivers Atlas feature answers, clarity and feature requests in its own email category", async () => {
  await sendContactNotification(
    {
      mode: "feedback",
      topic: "experience",
      task: "compare_areas",
      outcome: "partly",
      ease: 3,
      atlas: {
        features: ["map_layers", "area_comparison", "exports"],
        clarity: 4,
        wishlist: '<script>alert("wishlist")</script> More export formats.',
      },
      message: "It would help to compare library access between areas.",
      context: { page: "/atlas", locale: "en" },
    },
    "Atlas test browser",
    "atlas-reference"
  )
  const email = sendMail.mock.calls[0]![0]
  expect(email.subject).toBe("[Atlas feedback] Experience · /atlas")
  expect(email.to).toBe("info@libraries.global")
  expect(email.replyTo).toBeUndefined()
  expect(email.text).toContain("System notification · Atlas feedback")
  expect(email.text).toContain("Task: Compare areas")
  expect(email.text).toContain(
    "Features used: Map layers, Area comparison, Exports"
  )
  expect(email.text).toContain(
    "Map and data clarity (1 = unclear, 5 = clear): 4/5"
  )
  expect(email.text).toContain("Things they’d like to see")
  expect(email.text).toContain("More export formats.")
  expect(email.html).toContain("&lt;script&gt;")
  expect(email.html).not.toContain("<script>")
})
it("labels an Atlas idea message as the wishlist without requiring a separate wishlist field", () => {
  const wishes = "Please let me save an area comparison for future visits."
  const email = contactEmail(
    {
      mode: "feedback",
      topic: "idea",
      task: "compare_areas",
      outcome: "partly",
      atlas: { features: ["area_comparison"] },
      message: wishes,
      context: { page: "/atlas", locale: "en" },
    },
    "Atlas test browser",
    "reference",
    new Date()
  )
  expect(email.subject).toBe("[Atlas feedback] Suggestion · /atlas")
  expect(email.text).toContain("Things they’d like to see")
  expect(email.text).toContain(wishes)
})
it("always sends to the admin mailbox and uses the visitor only as Reply-To", async () => {
  vi.stubEnv("EMAIL_FROM", "Libraries Global <info@libraries.global>")
  await sendContactNotification(contact, "Browser", "reference")
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "info@libraries.global",
      from: "Libraries Global <info@libraries.global>",
      replyTo: { address: "reader@example.org", name: "Reader" },
      disableUrlAccess: true,
      disableFileAccess: true,
    })
  )
})
it("does not simulate success without an email transport", async () => {
  transport.mockReturnValue(null)
  await expect(
    sendContactNotification(contact, "Browser", "reference")
  ).rejects.toThrow("not configured")
  expect(sendMail).not.toHaveBeenCalled()
})
it("treats an SMTP recipient rejection as a delivery failure", async () => {
  sendMail.mockResolvedValue({ rejected: ["info@libraries.global"] })
  await expect(
    sendContactNotification(contact, "Browser", "reference")
  ).rejects.toThrow("rejected")
})
