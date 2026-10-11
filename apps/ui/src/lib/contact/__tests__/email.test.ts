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
