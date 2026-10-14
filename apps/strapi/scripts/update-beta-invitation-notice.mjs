/** Production content update; previews and backups contain no runtime credentials. */
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { betaInvitationNotice } from "./beta-invitation-notice.mjs"
import { stripComponentIds } from "./team-pricing-content.mjs"

const source = parseEnv(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
)
const origin =
  process.env.STRAPI_PRODUCTION_URL ||
  source.STRAPI_PRODUCTION_URL ||
  "http://127.0.0.1:18013"
if (new URL(origin).port === "1337")
  throw new Error("Use the production CMS connection")
const token = source.STRAPI_PRODUCTION_MCP_TOKEN || source.STRAPI_MCP_TOKEN
if (!token) throw new Error("The production content Admin Token is missing")
async function api(path, method = "GET", data) {
  const res = await fetch(new URL(`/content-manager/${path}`, origin), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`CMS ${method} failed: HTTP ${res.status}`)

  return res.json()
}
const base = "collection-types/api::legal-document.legal-document"
const listed = await api(`${base}?locale=en&pageSize=100&status=draft`)
const existing = listed.results.find((doc) => doc.slug === "beta")
if (!existing) throw new Error("Existing beta notice was not found")
if (existing.status === "modified")
  throw new Error(
    "The beta notice has unpublished edits; review them before applying"
  )
const sections = betaInvitationNotice(existing)
const folder = new URL("../../../.scratch/beta-invites/", import.meta.url)
mkdirSync(folder, { recursive: true })
const revisions = (existing.revisions ?? [])
  .map(({ id, ...revision }) => revision)
  .filter((revision) => revision.version !== "1.1-invitations")
const data = {
  sections,
  revisions: [
    ...revisions,
    {
      version: "1.1-invitations",
      date: "2026-10-14",
      summary:
        "Individual single-use beta invitations, delivery and redemption records, and revocable browser passes.",
    },
  ],
  locale: "en",
}
writeFileSync(
  new URL("./beta-notice-preview.json", folder),
  JSON.stringify(data, null, 2),
  { mode: 0o600 }
)
if (
  process.argv.includes("--apply") &&
  !isDeepStrictEqual(sections, stripComponentIds(existing.sections))
) {
  writeFileSync(
    new URL(`beta-notice-before-${randomUUID()}.json`, folder),
    JSON.stringify(existing, null, 2),
    { mode: 0o600 }
  )
  const current = await api(`${base}/${existing.documentId}?locale=en`)
  if ((current.data ?? current).updatedAt !== existing.updatedAt)
    throw new Error("The beta notice changed during preparation")
  await api(
    `${base}/${existing.documentId}/actions/publish?locale=en`,
    "POST",
    data
  )
  const checked = await api(
    `${base}/${existing.documentId}?locale=en&status=published`
  )
  if (
    !isDeepStrictEqual(
      stripComponentIds((checked.data ?? checked).sections),
      sections
    )
  )
    throw new Error("Published beta notice verification failed")
}
console.log(
  JSON.stringify({
    notice: "beta",
    documentId: existing.documentId,
    applied: process.argv.includes("--apply"),
    sections: sections.length,
  })
)
