/** Targeted local CMS publication. Preview by default; --apply writes via MCP. */
import { randomUUID } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { parseEnv } from "node:util"

import { betaLegalContent } from "./beta-legal-content.mjs"
import { StrapiMcpClient } from "./mcp-client.ts"

const source = parseEnv(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
)
const url = process.env.STRAPI_URL || "http://127.0.0.1:1337"
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))
  throw new Error("Local CMS migration only")
const apply = process.argv.includes("--apply")
// These are the public operator details already approved for membership policies.
const operator =
  process.env.BILLING_LEGAL_OPERATOR || source.BILLING_LEGAL_OPERATOR
const postal =
  process.env.BILLING_LEGAL_POSTAL_ADDRESS ||
  source.BILLING_LEGAL_POSTAL_ADDRESS
const email = process.env.BILLING_LEGAL_EMAIL || source.BILLING_LEGAL_EMAIL
if (!operator?.trim() || !postal?.trim() || !email?.trim())
  throw new Error(
    "Supply the approved public legal operator, postal address and email"
  )
const client = new StrapiMcpClient(source.STRAPI_MCP_TOKEN, `${url}/mcp`)
await client.initialize()
const docs = await client.listAll("legal-document", {
  locale: "en",
  status: "draft",
})
const existing = docs.find((doc) => doc.slug === "beta")
const revision = {
  version: "2026-10-12",
  date: "2026-10-12",
  summary:
    "Temporary beta-entrance, access-request privacy and essential-cookie notice; standard site and membership policies continue to apply after entry.",
}
const data = {
  ...betaLegalContent(operator.trim(), postal.trim(), email.trim()),
  revisions: [
    ...(existing?.revisions ?? [])
      .filter((r) => r.version !== revision.version)
      .map(({ id, ...r }) => r),
    revision,
  ],
}
if (apply) {
  writeFileSync(
    `/tmp/libraries-beta-legal-before-${randomUUID()}.json`,
    JSON.stringify({ existing: existing ?? null }),
    { mode: 0o600 }
  )
  const result = await client.call(
    existing ? "update_legal-document" : "create_legal-document",
    {
      ...(existing ? { documentId: existing.documentId } : {}),
      locale: "en",
      data,
    }
  )
  const documentId = existing?.documentId ?? result.data?.documentId
  if (!documentId) throw new Error("Legal document reference missing")
  await client.call("publish_legal-document", { documentId, locale: "en" })
}
console.log(
  `${apply ? "Published" : "Preview"}: /legal/beta (${data.sections.length} sections)`
)
