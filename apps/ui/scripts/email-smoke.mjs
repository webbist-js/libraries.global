import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { setTimeout } from "node:timers/promises"
import { parseEnv } from "node:util"

import { emailTemplate, escapeEmailHtml } from "@repo/shared-data"

import { emailSamples } from "./email-samples.mjs"
import { createEmailTransport } from "../src/lib/email-transport.ts"

// Explicit environment variables override local file values. Never log secrets.
try {
  for (const [key, value] of Object.entries(
    parseEnv(readFileSync(new URL("../.env.local", import.meta.url), "utf8"))
  ))
    process.env[key] ??= value
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
const args = process.argv.slice(2)
function argument(flag) {
  if (!args.includes(flag)) return
  const value = args[args.indexOf(flag) + 1]
  if (!value || value.startsWith("--"))
    throw new Error(`Supply a value after ${flag}`)

  return value
}
const to = argument("--to")
if (to && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to))
  throw new Error("Invalid --to address")
const previewDir = argument("--preview-dir")
const only = argument("--only")
let samples =
  args.includes("--suite") || args.includes("--billing")
    ? emailSamples()
    : [
        {
          id: "delivery-check",
          ...emailTemplate({
            title: "Libraries Global email delivery check",
            eyebrow: "Delivery sample",
            body: "This is a delivery check from Libraries Global. It does not change an account or subscription.",
            url: "https://libraries.global",
            action: "Visit Libraries Global",
            postalAddress: process.env.EMAIL_POSTAL_ADDRESS,
          }),
        },
      ]
if (args.includes("--billing"))
  samples = samples.filter((sample) => sample.id.startsWith("billing-"))
if (only) {
  samples = samples.filter((sample) => sample.id === only)
  if (!samples.length)
    throw new Error(
      "Unknown --only sample; generate the suite preview to see available IDs"
    )
}
if (previewDir) {
  const dir = path.resolve(previewDir)
  mkdirSync(dir, { recursive: true })
  for (const sample of samples) {
    writeFileSync(path.resolve(dir, sample.id + ".html"), sample.html)
    writeFileSync(path.resolve(dir, sample.id + ".txt"), sample.text)
  }
  writeFileSync(
    path.resolve(dir, "manifest.json"),
    JSON.stringify(
      samples.map(({ id, subject }) => ({ id, subject })),
      null,
      2
    )
  )
  writeFileSync(
    path.resolve(dir, "index.html"),
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Libraries Global email samples</title><body style="margin:0;padding:32px;background:#f1eee6;color:#19172b;font:16px/1.6 Arial,sans-serif"><main style="max-width:800px;margin:auto"><h1 style="font:40px Georgia,serif">Email sample gallery</h1><p>Fictional content, inactive credentials and subscription actions. No accounts are changed. These previews use the application templates; the monthly campaign remains an operator task in Brevo.</p><ol>${samples.map(({ id, subject }) => `<li style="margin-bottom:12px"><a href="${id}.html">${escapeEmailHtml(subject.replace(/^\[.*?\] /, ""))}</a> · <a href="${id}.txt">Plain text</a></li>`).join("")}</ol></main></body></html>`
  )
  console.log(`Rendered ${samples.length} HTML/text previews and index.`)
}
// Preview generation never connects to SMTP. Without arguments, verify only.
if (to || !previewDir) {
  const transport = createEmailTransport()
  if (!transport) throw new Error("No SMTP provider configured")
  try {
    await transport.verify()
    console.log("SMTP connection, TLS and credentials verified.")
    if (to) {
      for (const [index, sample] of samples.entries()) {
        if (index)
          await setTimeout(
            process.env.SMTP_HOST?.includes("brevo") ? 1000 : 15000
          )
        const { id, ...message } = sample
        const result = await transport.sendMail({
          from:
            process.env.EMAIL_FROM ??
            '"Libraries Global" <noreply@libraries.global>',
          replyTo: process.env.EMAIL_REPLY_TO,
          to,
          ...message,
          headers: {
            "X-Mailgun-Track": "no",
            "X-Mailgun-Track-Clicks": "no",
            "X-Mailgun-Track-Opens": "no",
          },
        })
        if (!result.accepted?.includes(to) || result.rejected?.length)
          throw new Error(`SMTP did not accept sample ${id}`)
        console.log(`Accepted ${index + 1}/${samples.length}: ${id}`)
      }
    }
  } finally {
    transport.close()
  }
}
