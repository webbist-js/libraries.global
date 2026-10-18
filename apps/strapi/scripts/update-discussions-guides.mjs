/** Production editorial rollout. Preview, stage private drafts, then publish after release acceptance. */
import { createHash, randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import {
  newGuideData,
  updatedGuideBody,
  updatedGuideSlugs,
} from "./discussions-guide-content.mjs"
import { stripComponentIds } from "./team-pricing-content.mjs"

const args = new Set(process.argv.slice(2))
const target = args.has("--local") ? "local" : "production"
const resume = args.has("--resume-stage")
const stage = args.has("--stage") || resume
const publish = args.has("--publish")
if (stage && publish)
  throw new Error("Stage and publication are separate operations")
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
const folder = new URL(
  "../../../.scratch/discussions-guide-rollout/",
  import.meta.url
)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const statePath = new URL(`${target}-staged.json`, folder)
const save = (url, data) =>
  writeFileSync(url, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 })
async function api(path, locale, method = "GET", data) {
  const url = new URL(`/content-manager/${path}`, origin)
  url.searchParams.set("locale", locale)
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify({ ...data, locale }) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new Error(
      `CMS ${method} ${locale} failed with HTTP ${response.status}`
    )

  return response.json()
}
const document = (response) => response.data ?? response
const get = async (id, locale, status = "draft") =>
  document(await api(`${base}/${id}?status=${status}`, locale))
async function list(locale) {
  const rows = []
  for (let page = 1; page <= 10; page++) {
    const response = await api(
      `${base}?page=${page}&pageSize=100&status=draft`,
      locale
    )
    rows.push(...response.results)
    if (page >= response.pagination.pageCount) return rows
  }
  throw new Error("Guide catalogue exceeded the inspection limit")
}
async function verify(doc, data) {
  for (const [key, expected] of Object.entries(data)) {
    if (key === "section") {
      const relations = await api(
        `relations/api::wiki-article.wiki-article/${doc.documentId}/section`,
        doc.locale
      )
      if (
        relations.results?.length !== 1 ||
        relations.results[0].documentId !== expected.connect[0].documentId
      )
        throw new Error("Guide section was not preserved")
    } else if (!isDeepStrictEqual(stripComponentIds(doc[key]), expected))
      throw new Error(
        `Guide verification failed for ${doc.locale}/${doc.slug}: ${key}`
      )
  }
}
const metadata = (doc) =>
  Object.fromEntries(
    [
      "title",
      "slug",
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
      "regions",
      "areas",
    ]
      .filter((key) => doc[key] !== undefined)
      .map((key) => [key, stripComponentIds(doc[key])])
  )

async function stagePlan(state) {
  if (state.target !== target || state.entries.some((entry) => entry.published))
    throw new Error("The saved rollout does not match this staging operation")
  // Recover a created locale after an interrupted verification, without creating a second document.
  for (const entry of state.entries) {
    if (entry.isNew && !entry.documentId) {
      const row = (await list(entry.locale)).find(
        (doc) => doc.slug === entry.data.slug
      )
      if (row) {
        const doc = await get(row.documentId, entry.locale)
        if (row.status !== "draft" || doc.createdAt < state.preparedAt)
          throw new Error("An unrelated guide already uses the new slug")
        await verify(doc, entry.data)
        entry.documentId = doc.documentId
        entry.staged = true
        entry.stagedAt = doc.updatedAt
        entry.stagedMetadata = metadata(doc)
      }
    }
    if (entry.documentId) {
      const current = await get(entry.documentId, entry.locale)
      if (
        current.updatedAt !==
          (entry.staged ? entry.stagedAt : entry.updatedAt) ||
        !isDeepStrictEqual(
          metadata(current),
          entry.staged ? entry.stagedMetadata : entry.beforeMetadata
        )
      )
        throw new Error(
          `Guide changed after the reviewed checkpoint: ${entry.locale}/${entry.slug ?? entry.data.slug}`
        )
      if (entry.staged) await verify(current, entry.data)
    }
  }
  save(statePath, state)
  let newGuideId = state.entries.find(
    (entry) => entry.isNew && entry.documentId
  )?.documentId
  for (const entry of state.entries) {
    if (entry.staged) continue
    let result
    if (!entry.isNew) {
      const current = await get(entry.documentId, entry.locale)
      if (
        current.updatedAt !== entry.updatedAt ||
        !isDeepStrictEqual(metadata(current), entry.beforeMetadata)
      )
        throw new Error("Guide changed during staging")
      result = await api(
        `${base}/${entry.documentId}`,
        entry.locale,
        "PUT",
        entry.data
      )
    } else if (!newGuideId)
      result = await api(base, entry.locale, "POST", entry.data)
    else
      result = await api(
        `${base}/${newGuideId}`,
        entry.locale,
        "PUT",
        entry.data
      )
    entry.documentId ??= document(result).documentId
    if (!entry.documentId)
      throw new Error("CMS did not return a document identity")
    if (entry.isNew) newGuideId = entry.documentId
    save(statePath, state)
    const checked = await get(entry.documentId, entry.locale)
    await verify(checked, entry.data)
    if (
      entry.beforeMetadata &&
      !isDeepStrictEqual(metadata(checked), entry.beforeMetadata)
    )
      throw new Error("Unrelated guide metadata changed")
    entry.staged = true
    entry.stagedAt = checked.updatedAt
    entry.stagedMetadata = metadata(checked)
    save(statePath, state)
    console.log(
      JSON.stringify({
        staged: checked.slug,
        locale: entry.locale,
        published: false,
        documentId: entry.documentId,
      })
    )
  }
  console.log(
    JSON.stringify({ target, staged: state.entries.length, published: 0 })
  )
}

if (publish) {
  // Deliberately use the saved reviewed rollout, never publish a fresh arbitrary CMS draft.
  const state = JSON.parse(readFileSync(statePath, "utf8"))
  if (
    state.target !== target ||
    !state.entries.length ||
    state.entries.some((entry) => !entry.staged)
  )
    throw new Error("All reviewed guide drafts must be staged first")
  for (const entry of state.entries) {
    if (entry.published) continue
    const current = await get(entry.documentId, entry.locale)
    if (current.updatedAt !== entry.stagedAt)
      throw new Error(
        `Draft changed after staging: ${entry.locale}/${entry.slug ?? entry.data.slug}`
      )
    await verify(current, entry.data)
  }
  for (const entry of state.entries) {
    if (entry.published) continue
    // Recheck immediately before mutation, including all content and metadata retained at staging.
    const current = await get(entry.documentId, entry.locale)
    if (
      current.updatedAt !== entry.stagedAt ||
      !isDeepStrictEqual(metadata(current), entry.stagedMetadata)
    )
      throw new Error(
        `Guide changed before publication: ${entry.locale}/${entry.slug ?? entry.data.slug}`
      )
    await verify(current, entry.data)
    await api(
      `${base}/${entry.documentId}/actions/publish`,
      entry.locale,
      "POST",
      {}
    )
    const checked = await get(entry.documentId, entry.locale, "published")
    await verify(checked, entry.data)
    if (!isDeepStrictEqual(metadata(checked), entry.stagedMetadata))
      throw new Error("Published guide metadata changed")
    entry.published = true
    save(statePath, state)
    console.log(
      JSON.stringify({
        published: entry.slug ?? entry.data.slug,
        locale: entry.locale,
        documentId: entry.documentId,
      })
    )
  }
} else if (resume) {
  await stagePlan(JSON.parse(readFileSync(statePath, "utf8")))
} else {
  const state = {
    target,
    preparedAt: new Date().toISOString(),
    entries: [],
    before: [],
  }
  for (const locale of ["en", "fr", "cs"]) {
    const rows = await list(locale)
    for (const slug of updatedGuideSlugs) {
      const row = rows.find((doc) => doc.slug === slug)
      if (!row) throw new Error(`Missing published guide: ${locale}/${slug}`)
      if (row.status !== "published")
        throw new Error(
          `Unpublished edits need separate review: ${locale}/${slug}`
        )
      const doc = await get(row.documentId, locale)
      const live = await get(row.documentId, locale, "published")
      if (
        !isDeepStrictEqual(
          stripComponentIds(doc.body),
          stripComponentIds(live.body)
        ) ||
        !isDeepStrictEqual(metadata(doc), metadata(live))
      )
        throw new Error(
          `Guide has unrelated unpublished content: ${locale}/${slug}`
        )
      const body = updatedGuideBody(doc, locale)
      if (isDeepStrictEqual(body, stripComponentIds(doc.body))) continue
      state.before.push({ locale, doc, published: live })
      state.entries.push({
        locale,
        slug,
        documentId: doc.documentId,
        updatedAt: doc.updatedAt,
        data: { body },
        beforeMetadata: metadata(doc),
      })
    }
    const existing = rows.find((doc) => doc.slug === "library-conversations")
    if (existing)
      throw new Error(
        `The new guide already exists; inspect the saved rollout before continuing: ${locale}`
      )
    const section = rows.find((doc) => doc.slug === "how-to-contribute")
      ?.section?.documentId
    if (!section) throw new Error(`Contributing section missing: ${locale}`)
    state.entries.push({
      locale,
      isNew: true,
      data: newGuideData(locale, { connect: [{ documentId: section }] }),
    })
  }
  const digest = createHash("sha256")
    .update(JSON.stringify(state.entries))
    .digest("hex")
  save(new URL(`${target}-preview.json`, folder), { ...state, digest })
  console.log(
    JSON.stringify({
      target,
      stage,
      changes: state.entries.length,
      digest,
      locales: ["en", "fr", "cs"],
    })
  )
  if (stage) {
    // Complete preflight precedes all writes; retain a permanent before-image and checkpoint each draft.
    save(new URL(`${target}-before-${randomUUID()}.json`, folder), state)
    await stagePlan(state)
  }
}
