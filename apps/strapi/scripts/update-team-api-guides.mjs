/** Production editorial update: preview, then publish with --apply. */
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { articleReadingMinutes } from "@repo/shared-data"

import {
  apiOnboardingArticles,
  updateApiGuide,
} from "./team-api-knowledge-content.mjs"
import {
  apiKnowledgeSummary,
  stripComponentIds,
} from "./team-pricing-content.mjs"

const args = new Set(process.argv.slice(2))
const apply = args.has("--apply")
const target = args.has("--local") ? "local" : "production"
const env = parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8"))
const origin =
  target === "local"
    ? "http://127.0.0.1:1337"
    : process.env.STRAPI_PRODUCTION_URL ||
      env.STRAPI_PRODUCTION_URL ||
      "http://127.0.0.1:18013"
const token =
  target === "local"
    ? env.STRAPI_MCP_TOKEN
    : process.env.STRAPI_PRODUCTION_MCP_TOKEN ||
      env.STRAPI_PRODUCTION_MCP_TOKEN ||
      env.STRAPI_MCP_TOKEN
if (!token) throw new Error("The selected CMS Admin Token is unavailable")
if (target === "production" && new URL(origin).port === "1337")
  throw new Error("Production must not use the development CMS")
const base = "collection-types/api::wiki-article.wiki-article"
const folder = new URL("../../../.scratch/team-api-guides/", import.meta.url)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, data) =>
  writeFileSync(new URL(name, folder), JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  })
async function api(path, method = "GET", data) {
  const url = new URL(`/content-manager/${path}`, origin)
  url.searchParams.set("locale", "en")
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify({ ...data, locale: "en" }) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new Error(`CMS ${method} failed with HTTP ${response.status}`)

  return response.json()
}
const document = (result) => result.data ?? result
const get = async (id, status = "draft") =>
  document(await api(`${base}/${id}?status=${status}`))
const docs = []
for (let page = 1; page <= 10; page++) {
  const result = await api(`${base}?page=${page}&pageSize=100&status=draft`)
  docs.push(...result.results)
  if (page >= result.pagination.pageCount) break
  if (page === 10) throw new Error("Guide catalogue exceeded inspection limit")
}
const sectionId = docs.find((d) => d.slug === "team-api-access")?.section
  ?.documentId
if (!sectionId)
  throw new Error("Existing Team API guide and Data & API section are required")
const plans = []
for (const doc of docs) {
  const body = updateApiGuide(doc)
  if (!body || isDeepStrictEqual(body, stripComponentIds(doc.body))) continue
  plans.push({
    doc,
    data: {
      title: doc.title,
      slug: doc.slug,
      body,
      ...(doc.slug === "the-public-api"
        ? {
            summary:
              "The Team API for published Library search and records: current beta availability, access requirements and source licences.",
          }
        : {}),
      ...(doc.slug === "team-api-access"
        ? {
            summary: apiKnowledgeSummary,
          }
        : {}),
    },
  })
}
for (const data of apiOnboardingArticles(sectionId)) {
  const doc = docs.find((d) => d.slug === data.slug)
  if (doc) {
    const update = {
      title: data.title,
      slug: data.slug,
      summary: data.summary,
      body: data.body,
    }
    if (
      Object.entries(update).every(([key, value]) =>
        isDeepStrictEqual(stripComponentIds(doc[key]), value)
      )
    )
      continue
    plans.push({ doc, data: update })
  } else plans.push({ data })
}
for (const { doc, data } of plans) {
  if (doc && doc.status !== "published")
    throw new Error(`Unpublished edits need review: ${data.slug}`)
}
save(`${target}-preview.json`, plans)
console.log(
  JSON.stringify({
    target,
    apply,
    changes: plans.map((p) => ({ slug: p.data.slug, create: !p.doc })),
  })
)
if (!apply) process.exit(0)
save(
  `${target}-before-${randomUUID()}.json`,
  plans.filter((p) => p.doc).map((p) => p.doc)
)
const metadataFields = [
  "summary",
  "author",
  "featured",
  "priority",
  "articleStatus",
  "heroImage",
  "section",
  "category",
  "relatedArticles",
  "seo",
  "contributors",
  "docsSections",
  "topics",
  "libraries",
  "continents",
  "countries",
]
const relationFields = new Set([
  "section",
  "category",
  "relatedArticles",
  "contributors",
  "topics",
  "libraries",
  "continents",
  "countries",
])
async function relationIds(id, field) {
  const response = await api(
    `relations/api::wiki-article.wiki-article/${id}/${field}?pageSize=100`
  )
  if (response.pagination?.pageCount > 1)
    throw new Error(`Relation exceeds verification limit: ${field}`)

  return response.results.map((row) => row.documentId).sort()
}
for (const { doc, data } of plans) {
  let current
  const beforeRelations = new Map()
  if (doc) {
    current = await get(doc.documentId)
    if (current.updatedAt !== doc.updatedAt || current.status !== "published")
      throw new Error(`Content changed after preview: ${data.slug}`)
    for (const field of relationFields) {
      if (field in current)
        beforeRelations.set(field, await relationIds(doc.documentId, field))
    }
  } else {
    const latest = await api(
      `${base}?filters[slug][$eq]=${encodeURIComponent(data.slug)}&pageSize=1&status=draft`
    )
    if (latest.results.length)
      throw new Error(`Guide now exists; run preview again: ${data.slug}`)
  }
  const result = document(
    await api(
      `${base}${doc ? `/${doc.documentId}` : ""}/actions/publish`,
      "POST",
      data
    )
  )
  const id = doc?.documentId ?? result.documentId
  if (!id)
    throw new Error(`CMS did not return a document identifier: ${data.slug}`)
  const published = await get(id, "published")
  // Article discovery recalculates this derived value whenever body changes.
  if (published.readingTimeMinutes !== articleReadingMinutes(data.body))
    throw new Error(`Reading time verification failed: ${data.slug}`)
  for (const [key, value] of Object.entries(data)) {
    if (key === "section") {
      const relation = await api(
        `relations/api::wiki-article.wiki-article/${id}/section`
      )
      if (relation.results?.[0]?.documentId !== sectionId)
        throw new Error("Guide section verification failed")
    } else if (!isDeepStrictEqual(stripComponentIds(published[key]), value))
      throw new Error(`Publication verification failed: ${data.slug}/${key}`)
  }
  if (doc) {
    for (const key of metadataFields) {
      if (key in data) continue
      if (relationFields.has(key)) {
        if (
          beforeRelations.has(key) &&
          !isDeepStrictEqual(
            await relationIds(id, key),
            beforeRelations.get(key)
          )
        )
          throw new Error(`Editorial relation changed: ${data.slug}/${key}`)
        continue
      }
      if (
        !isDeepStrictEqual(
          stripComponentIds(published[key]),
          stripComponentIds(current[key])
        )
      )
        throw new Error(`Editorial metadata changed: ${data.slug}/${key}`)
    }
  }
  console.log(
    JSON.stringify({ published: data.slug, documentId: id, verified: true })
  )
}
