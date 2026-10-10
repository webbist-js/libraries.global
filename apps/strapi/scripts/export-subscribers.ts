import { writeFile } from "node:fs/promises"

// Run from apps/strapi. Node 22 loads environment values without printing secrets.
try {
  process.loadEnvFile(".env")
} catch {
  /* Deployed jobs may supply the environment directly. */
}

async function main() {
  const [type, output] = process.argv.slice(2)
  if (!["beta_waitlist", "newsletter"].includes(type ?? "") || !output)
    throw new Error(
      "Usage: tsx scripts/export-subscribers.ts beta_waitlist|newsletter output.csv"
    )
  const secret = process.env.STRAPI_BRIDGE_SECRET
  if (!secret) throw new Error("STRAPI_BRIDGE_SECRET is required")
  const csv = (value: unknown) => {
    const text = String(value ?? "")

    return `"${(/^[=+@-]/.test(text) ? `'${text}` : text).replaceAll('"', '""')}"`
  }
  const columns = [
    "email",
    "type",
    "locale",
    "consentedAt",
    "consentVersion",
    "documentId",
  ]
  const lines = [columns.join(",")]
  for (let page = 1; page <= 10000; page++) {
    const res = await fetch(
      `${process.env.STRAPI_URL ?? "http://127.0.0.1:1337"}/api/subscribers/export?type=${type}&page=${page}`,
      {
        headers: { "X-Service-Secret": secret },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!res.ok) throw new Error(`Export failed (${res.status})`)
    const { data } = (await res.json()) as { data: Record<string, unknown>[] }
    lines.push(
      ...data.map((row) => columns.map((column) => csv(row[column])).join(","))
    )
    if (data.length < 500) break
  }
  await writeFile(output, `${lines.join("\n")}\n`, { flag: "wx", mode: 0o600 })
  console.info(
    `Exported ${lines.length - 1} subscriptions to ${output}. No invitations were sent.`
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Export failed")
  process.exitCode = 1
})
