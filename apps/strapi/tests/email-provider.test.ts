import provider from "@strapi/provider-email-nodemailer"
import { afterEach, describe, expect, it } from "vitest"

const settings = {
  defaultFrom: "noreply@example.test",
  defaultReplyTo: "info@example.test",
}
const message = {
  to: "reader@example.test",
  subject: "Membership receipt",
  text: "Your membership is active.",
  html: "<p>Your membership is active.</p>",
}
const mailer = () =>
  provider.init({ streamTransport: true, buffer: true }, settings)

let transport: ReturnType<typeof mailer> | undefined

afterEach(() => {
  transport?.close()
  transport = undefined
})

describe("production email provider", () => {
  it("composes both body formats with the configured sender and reply address", async () => {
    transport = mailer()
    const sent = await transport.send(message)
    const mime = sent.message.toString()
    expect(mime).toContain("From: noreply@example.test")
    expect(mime).toContain("Reply-To: info@example.test")
    expect(mime).toContain("Subject: Membership receipt")
    expect(mime).toContain("Content-Type: multipart/alternative;")
    expect(mime).toContain(message.text)
    expect(mime).toContain(message.html)
    expect(sent.envelope).toEqual({
      from: settings.defaultFrom,
      to: [message.to],
    })
  })

  it("refuses file attachments before reading their paths", async () => {
    transport = mailer()
    await expect(
      transport.send({
        ...message,
        attachments: [{ filename: "receipt.txt", path: "forbidden.txt" }],
      })
    ).rejects.toThrow("File access rejected")
  })

  it("refuses URL attachments before making a request", async () => {
    transport = mailer()
    await expect(
      transport.send({
        ...message,
        attachments: [{ href: "https://example.invalid/receipt.txt" }],
      })
    ).rejects.toThrow("Url access rejected")
  })

  it("applies the file-access restriction to raw messages too", async () => {
    transport = mailer()
    await expect(
      transport.send({ ...message, raw: { path: "forbidden.eml" } })
    ).rejects.toThrow("File access rejected")
  })
})
