/** Correct revision identifiers only; never rewrite document copy or consent records. */
import { randomUUID } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { parseEnv } from "node:util"

import { StrapiMcpClient } from "./mcp-client.ts"

const source = parseEnv(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
)
const url = process.env.STRAPI_URL || "http://127.0.0.1:1337"
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))
  throw new Error("Local CMS migration only")
const apply = process.argv.includes("--apply")
// The first public release was accidentally labelled with its publication date.
const aliases = { "2026-10-12": "1.0" }
const client = new StrapiMcpClient(source.STRAPI_MCP_TOKEN, `${url}/mcp`)
await client.initialize()
const changes = []
for (const locale of ["en", "cs", "fr"]) {
  const docs = await client.listAll("legal-document", {
    locale,
    status: "draft",
  })
  for (const doc of docs) {
    if (!(doc.revisions ?? []).some((r) => aliases[r.version])) continue
    // Do not accidentally publish other pending copy while correcting metadata.
    if (doc.status === "modified")
      throw new Error(
        `Resolve pending legal edits before correcting ${locale}/${doc.slug}`
      )
    const revisions = doc.revisions.map(({ id, ...revision }) =>
      Object.fromEntries(
        Object.entries({
          ...revision,
          version: aliases[revision.version] ?? revision.version,
        }).filter(([, value]) => value !== null)
      )
    )
    if (new Set(revisions.map((r) => r.version)).size !== revisions.length)
      throw new Error(`Duplicate revision number in ${locale}/${doc.slug}`)
    changes.push({ doc, locale, revisions })
  }
}
if (apply && changes.length)
  writeFileSync(
    `/tmp/libraries-legal-versions-before-${randomUUID()}.json`,
    JSON.stringify(changes),
    { mode: 0o600 }
  )
for (const { doc, locale, revisions } of changes) {
  if (apply) {
    await client.call("update_legal-document", {
      documentId: doc.documentId,
      locale,
      // MCP requires title and slug even for a revision-only edit; echo them unchanged.
      data: { title: doc.title, slug: doc.slug, revisions },
    })
    if (doc.status === "published")
      await client.call("publish_legal-document", {
        documentId: doc.documentId,
        locale,
      })
  }
  console.log(
    `${apply ? "Corrected" : "Preview"} ${locale}/${doc.slug}: v1.0; publication dates preserved`
  )
}
console.log(`${changes.length} ${apply ? "corrected" : "planned"} documents`)
