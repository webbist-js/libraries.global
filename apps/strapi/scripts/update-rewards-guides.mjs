/** Preview, publish and verify the pre-launch rewards/content corrections. */
import assert from "node:assert/strict"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { articleReadingMinutes } from "@repo/shared-data"

import {
  rewardsGuideBody,
  rewardsGuideSlugs,
  rewardsLegalUpdate,
} from "./rewards-guide-content.mjs"
import { stripComponentIds as clean } from "./team-pricing-content.mjs"

const apply = process.argv.includes("--apply")
const env = parseEnv(
  readFileSync(
    process.env.CMS_ENV_FILE || new URL("../.env", import.meta.url),
    "utf8"
  )
)
const origin = process.env.STRAPI_PRODUCTION_URL || env.STRAPI_PRODUCTION_URL
const token =
  process.env.STRAPI_PRODUCTION_MCP_TOKEN || env.STRAPI_PRODUCTION_MCP_TOKEN
assert.ok(
  origin && token,
  "Explicit production connection and editorial credential required"
)
assert.notEqual(
  new URL(origin).port,
  "1337",
  "This helper does not target local development"
)
const folder = new URL(
  "../../../.scratch/rewards-guide-rollout/",
  import.meta.url
)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, data) =>
  writeFileSync(new URL(name, folder), JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  })
const load = (name) => JSON.parse(readFileSync(new URL(name, folder), "utf8"))
const fields = Object.fromEntries(
  ["wiki-article", "legal-document"].map((type) => [
    type,
    Object.keys(
      JSON.parse(
        readFileSync(
          new URL(
            `../src/api/${type}/content-types/${type}/schema.json`,
            import.meta.url
          )
        )
      ).attributes
    ),
  ])
)
const evidence = (type, doc) =>
  Object.fromEntries(
    fields[type]
      .filter((key) => key in doc)
      .map((key) => [key, clean(doc[key])])
  )

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
    signal: AbortSignal.timeout(20000),
  })
  assert.ok(response.ok, `CMS ${method}: HTTP ${response.status}`)

  return response.json()
}
const base = (type) => `collection-types/api::${type}.${type}`
const get = async (entry, status) => {
  const result = await api(
    `${base(entry.type)}/${entry.documentId}?status=${status}`,
    entry.locale
  )

  return result.data ?? result
}

if (!apply) {
  const entries = []
  for (const type of ["wiki-article", "legal-document"])
    for (const locale of type === "wiki-article"
      ? ["en", "fr", "cs"]
      : ["en"]) {
      const rows = []
      for (let page = 1; page <= 20; page++) {
        const result = await api(
          `${base(type)}?status=published&page=${page}&pageSize=100`,
          locale
        )
        assert.ok(Array.isArray(result.results), "Unexpected catalogue")
        rows.push(...result.results)
        if (page >= result.pagination.pageCount) break
        assert.ok(page < 20, "Catalogue exceeded inspection limit")
      }
      const slugs =
        type === "wiki-article"
          ? rewardsGuideSlugs
          : ["terms", "membership", "privacy", "cookies"]
      for (const slug of slugs) {
        const row = rows.find((doc) => doc.slug === slug)
        assert.ok(row, `Published article missing: ${locale}/${slug}`)
        const entry = { type, locale, slug, documentId: row.documentId }
        const before = await get(entry, "draft")
        const published = await get(entry, "published")
        assert.ok(published.publishedAt, `Not published: ${slug}`)
        assert.ok(
          isDeepStrictEqual(evidence(type, before), evidence(type, published)),
          `Unrelated draft: ${locale}/${slug}`
        )
        // Refuse to prepare a second copy of an already applied rollout.
        assert.ok(
          !JSON.stringify(published).includes(
            "Each qualifying acceptance resets the expiry"
          ) &&
            !(published.revisions ?? []).some(
              (r) =>
                r.date === "2026-11-01" &&
                ["1.2", "1.4", "2.1"].includes(r.version)
            ),
          `Rollout already present: ${locale}/${slug}`
        )
        const body =
          type === "wiki-article" ? rewardsGuideBody(before, locale) : null
        const data = clean(
          body
            ? { body, readingTimeMinutes: articleReadingMinutes(body) }
            : rewardsLegalUpdate(before)
        )
        entries.push({
          ...entry,
          updatedAt: before.updatedAt,
          before,
          published,
          data,
        })
      }
    }
  save("production-preview.json", {
    preparedAt: new Date().toISOString(),
    entries,
  })
  console.log(
    JSON.stringify({
      preview: entries.map(({ locale, slug }) => ({ locale, slug })),
      writes: 0,
    })
  )
} else {
  // Read the exact reviewed payload, never re-generate against changed content.
  const plan = load("production-preview.json")
  let progress
  try {
    progress = load("production-progress.json")
  } catch (error) {
    if (error.code !== "ENOENT") throw error
    progress = { preparedAt: plan.preparedAt, published: [] }
  }
  assert.equal(
    progress.preparedAt,
    plan.preparedAt,
    "Checkpoint belongs to a different preview"
  )
  const key = (entry) => `${entry.locale}/${entry.slug}`
  for (const entry of plan.entries) {
    const current = await get(entry, "draft")
    if (!progress.published.includes(key(entry))) {
      assert.equal(
        current.updatedAt,
        entry.updatedAt,
        `Changed after preview: ${key(entry)}`
      )
      assert.ok(
        isDeepStrictEqual(
          evidence(entry.type, current),
          evidence(entry.type, entry.before)
        ),
        `Changed content: ${key(entry)}`
      )
    }
  }
  save("production-before.json", plan)
  for (const entry of plan.entries) {
    if (!progress.published.includes(key(entry))) {
      const current = await get(entry, "draft")
      assert.equal(
        current.updatedAt,
        entry.updatedAt,
        `Changed during publication: ${key(entry)}`
      )
      await api(
        `${base(entry.type)}/${entry.documentId}/actions/publish`,
        entry.locale,
        "POST",
        entry.data
      )
    }
    const checked = await get(entry, "published")
    const expected = { ...evidence(entry.type, entry.before), ...entry.data }
    assert.ok(
      isDeepStrictEqual(evidence(entry.type, checked), expected),
      `Published content/metadata mismatch: ${key(entry)}`
    )
    if (!progress.published.includes(key(entry)))
      progress.published.push(key(entry))
    progress.verifiedAt = new Date().toISOString()
    save("production-progress.json", progress)
    console.log(JSON.stringify({ verified: key(entry), published: true }))
  }
}
