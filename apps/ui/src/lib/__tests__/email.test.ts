import { afterEach, beforeEach, expect, it, vi } from "vitest"

const { createTransport, sendMail } = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}))
vi.mock("nodemailer", () => ({ default: { createTransport } }))
import { sendVerificationEmail } from "../email"

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASS",
    "SMTP_PORT",
    "SMTP_SECURE",
    "MAILTRAP_USER",
    "MAILTRAP_PASS",
    "MAILGUN_SMTP_USER",
    "MAILGUN_SMTP_PASS",
  ])
    vi.stubEnv(key, "")
  createTransport.mockReturnValue({ sendMail })
  sendMail.mockResolvedValue({})
})
afterEach(() => vi.unstubAllEnvs())

it("delivers existing account email through generic SMTP ahead of the sandbox", async () => {
  vi.stubEnv("SMTP_HOST", "smtp.example.org")
  vi.stubEnv("SMTP_USER", "smtp-login")
  vi.stubEnv("SMTP_PASS", "test-key")
  vi.stubEnv("SMTP_PORT", "587")
  vi.stubEnv("SMTP_SECURE", "false")
  vi.stubEnv("MAILTRAP_USER", "sandbox-login")
  vi.stubEnv("MAILTRAP_PASS", "sandbox-key")
  vi.stubEnv("EMAIL_FROM", "sender@example.org")
  vi.stubEnv("EMAIL_REPLY_TO", "hello@example.org")
  await sendVerificationEmail(
    "fixture@example.org",
    "https://app.example.org/verify?token=fixture"
  )
  expect(createTransport).toHaveBeenCalledWith(
    expect.objectContaining({
      host: "smtp.example.org",
      port: 587,
      secure: false,
      auth: { user: "smtp-login", pass: "test-key" },
    })
  )
  expect(sendMail).toHaveBeenCalledWith(
    expect.objectContaining({
      to: "fixture@example.org",
      from: "sender@example.org",
      replyTo: "hello@example.org",
    })
  )
})

it("refuses production delivery without a provider instead of logging a credential", async () => {
  vi.stubEnv("NODE_ENV", "production")
  await expect(
    sendVerificationEmail(
      "fixture@example.org",
      "https://app.example.org/verify?token=fixture"
    )
  ).rejects.toThrow("Email delivery is not configured")
  expect(sendMail).not.toHaveBeenCalled()
})
