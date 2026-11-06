/**
 * Sponsored-access Knowledge and legal rollout. Preview by default; never
 * publishes. Production is the default target, as for other editorial helpers;
 * use --local explicitly for feature development.
 *
 *   --offline-preview        Render every payload without contacting a CMS.
 *   --write-legal-markdown   Regenerate apps/docs/docs/proposals/legal-drafts/.
 *   --inventory              Read-only inventory of Knowledge and legal documents.
 *   (no mode)                Inventory plus the planned drafts and their digest.
 *   --stage --digest=HEX     Write the previewed plan as drafts. Production also
 *                            requires --confirm-production.
 *   --knowledge-only / --legal-only   Limit the plan.
 *   --date=YYYY-MM-DD        Date for new legal revisions (default today).
 *
 * Publication is a separate operator action after legal review and release
 * acceptance; this helper has no code path that publishes.
 */
import { createHash, randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { stripComponentIds } from "./cms-component-ids.mjs"
import {
  AUTHOR,
  KNOWLEDGE_ARTICLES,
  LOCALES,
  OWNED_FIELDS,
  SCRUB_SLUGS,
  articleCopy,
  cleanBody,
  plannedArticle,
  retiredCopy,
  scrubbedBody,
} from "./sponsored-access-content.mjs"
import {
  REVIEW_HEADING,
  legalDraftData,
  legalDraftMarkdown,
  legalDrafts,
} from "./sponsored-access-legal-content.mjs"

const argv = process.argv.slice(2)
const args = new Set(argv.filter((arg) => !arg.includes("=")))
const option = (name) =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1]
const known = new Set([
  "--local",
  "--offline-preview",
  "--write-legal-markdown",
  "--inventory",
  "--stage",
  "--confirm-production",
  "--knowledge-only",
  "--legal-only",
])
for (const arg of args)
  if (!known.has(arg)) throw new Error(`Unknown option: ${arg}`)
const local = args.has("--local")
const target = local ? "local" : "production"
const stage = args.has("--stage")
const inventoryOnly = args.has("--inventory")
const knowledge = !args.has("--legal-only")
const legal = !args.has("--knowledge-only")
const date = option("date") ?? new Date().toISOString().slice(0, 10)
if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
  throw new Error("--date needs YYYY-MM-DD")
if (stage && inventoryOnly) throw new Error("Inventory is read-only")
if (stage && !option("digest"))
  throw new Error("Staging needs --digest from a reviewed preview")
if (stage && target === "production" && !args.has("--confirm-production"))
  throw new Error(
    "Production staging needs --confirm-production; run the preview first"
  )

const folder = new URL("../../../.scratch/sponsored-access/", import.meta.url)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, data) =>
  writeFileSync(new URL(name, folder), JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  })
const legalContacts = (env = {}) => ({
  ...(process.env.BILLING_LEGAL_OPERATOR || env.BILLING_LEGAL_OPERATOR
    ? {
        operator: (
          process.env.BILLING_LEGAL_OPERATOR || env.BILLING_LEGAL_OPERATOR
        ).trim(),
      }
    : {}),
  ...(process.env.BILLING_LEGAL_POSTAL_ADDRESS ||
  env.BILLING_LEGAL_POSTAL_ADDRESS
    ? {
        postalAddress: (
          process.env.BILLING_LEGAL_POSTAL_ADDRESS ||
          env.BILLING_LEGAL_POSTAL_ADDRESS
        ).trim(),
      }
    : {}),
})

// ---------------------------------------------------------------------------
// Offline modes: no CMS connection.

if (args.has("--write-legal-markdown")) {
  // Public review copies: never include private postal details from env.
  const out = new URL(
    "../../docs/docs/proposals/legal-drafts/",
    import.meta.url
  )
  mkdirSync(out, { recursive: true })
  for (const draft of legalDrafts())
    writeFileSync(
      new URL(`${draft.slug}.md`, out),
      legalDraftMarkdown(draft, date) + "\n"
    )
  console.log(JSON.stringify({ wrote: legalDrafts().map((d) => d.slug) }))
  process.exit(0)
}
if (args.has("--offline-preview")) {
  const articles = []
  for (const { slug } of KNOWLEDGE_ARTICLES)
    for (const locale of LOCALES) {
      const { data } = plannedArticle(slug, locale, null)
      articles.push({ slug, locale, data, retired: retiredCopy(data, locale) })
    }
  const drafts = legalDrafts().map((draft) => ({
    slug: draft.slug,
    mode: draft.mode,
    ...(draft.mode === "replace"
      ? legalDraftData(null, draft, date)
      : { draft }),
  }))
  save("offline-preview.json", { date, articles, legal: drafts })
  console.log(
    JSON.stringify({
      offline: true,
      articles: articles.length,
      retired: articles.filter((a) => a.retired.length).length,
      legal: drafts.length,
    })
  )
  process.exit(0)
}

// ---------------------------------------------------------------------------
// CMS connection. Production never falls back to the development CMS or token.

const envPath = process.env.CMS_ENV_FILE || new URL("../.env", import.meta.url)
const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : {}
const origin = local
  ? "http://127.0.0.1:1337"
  : process.env.STRAPI_PRODUCTION_URL ||
    env.STRAPI_PRODUCTION_URL ||
    "http://127.0.0.1:18013"
const token = local
  ? env.STRAPI_MCP_TOKEN
  : process.env.STRAPI_PRODUCTION_MCP_TOKEN || env.STRAPI_PRODUCTION_MCP_TOKEN
if (!token)
  throw new Error("The selected CMS editorial credential is unavailable")
if (!local && new URL(origin).port === "1337")
  throw new Error("Production must not use the development CMS")

const MODELS = {
  article: "api::wiki-article.wiki-article",
  legal: "api::legal-document.legal-document",
}
const base = (model) => `collection-types/${MODELS[model]}`
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
  if (!response.ok) {
    // Strapi validation messages name fields, never credentials.
    const detail = await response
      .json()
      .then((body) => body?.error?.message ?? "")
      .catch(() => "")
    throw new Error(
      `CMS ${method} ${path.split("?")[0]} (${locale}) failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`
    )
  }

  return response.json()
}
const unwrap = (response) => response.data ?? response
const get = async (model, id, locale, status = "draft") =>
  unwrap(await api(`${base(model)}/${id}?status=${status}`, locale))
async function list(model, locale) {
  const rows = []
  for (let page = 1; page <= 10; page++) {
    const response = await api(
      `${base(model)}?page=${page}&pageSize=100&status=draft`,
      locale
    )
    rows.push(...response.results)
    if (page >= response.pagination.pageCount) return rows
  }
  throw new Error("Catalogue exceeded the inspection limit; inventory in parts")
}
const ARTICLE_METADATA = [
  "slug",
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
  "publicationDate",
]
const LEGAL_METADATA = ["slug", "order", "seo"]
const metadata = (doc, fields) =>
  Object.fromEntries(
    fields
      .filter((key) => doc?.[key] !== undefined)
      .map((key) => [key, stripComponentIds(doc[key])])
  )
const comparable = (key, value) =>
  key === "body" ? cleanBody(value) : stripComponentIds(value ?? null)
/**
 * Drafts this script staged in its last run on this target, by key. A draft
 * that still equals what we wrote is ours to replace; anything else is
 * someone's unrelated edit and blocks.
 */
const previousStage = (() => {
  try {
    const saved = JSON.parse(
      readFileSync(new URL(`${target}-staged.json`, folder), "utf8")
    )

    return new Map((saved.entries ?? []).map((e) => [e.key, e.data]))
  } catch {
    return new Map()
  }
})()
const ownDraft = (key, draft) =>
  previousStage.has(key) && matches(draft, previousStage.get(key))

function matches(doc, data) {
  return Object.entries(data).every(
    ([key, value]) =>
      key === "section" ||
      key === "articleStatus" ||
      key === "author" ||
      key === "slug" ||
      isDeepStrictEqual(comparable(key, doc?.[key]), comparable(key, value))
  )
}

// ---------------------------------------------------------------------------
// Inventory.

const rows = { article: {}, legal: {} }
for (const locale of LOCALES) {
  rows.article[locale] =
    knowledge || inventoryOnly ? await list("article", locale) : []
  rows.legal[locale] = legal || inventoryOnly ? await list("legal", locale) : []
}
const inventory = {
  target,
  readAt: new Date().toISOString(),
  knowledge: LOCALES.flatMap((locale) =>
    rows.article[locale].map((row) => ({
      locale,
      documentId: row.documentId,
      slug: row.slug,
      title: row.title,
      section: row.section?.documentId ?? null,
      status: row.status,
      updatedAt: row.updatedAt,
    }))
  ),
  legal: LOCALES.flatMap((locale) =>
    rows.legal[locale].map((row) => ({
      locale,
      documentId: row.documentId,
      slug: row.slug,
      status: row.status,
      updatedAt: row.updatedAt,
    }))
  ),
  targets: [],
  retiredCopy: [],
}
const owned = new Set([
  ...KNOWLEDGE_ARTICLES.map((a) => a.slug),
  ...SCRUB_SLUGS,
])
// Report retired claims anywhere in the catalogue, including unlisted guides.
for (const locale of LOCALES)
  for (const row of rows.article[locale]) {
    const doc = await get("article", row.documentId, locale)
    const found = retiredCopy(
      { title: doc.title, summary: doc.summary, body: doc.body, seo: doc.seo },
      locale
    )
    if (found.length)
      inventory.retiredCopy.push({
        locale,
        slug: row.slug,
        documentId: row.documentId,
        handledByThisRollout: owned.has(row.slug),
        matches: found.slice(0, 20),
      })
  }
for (const { slug } of KNOWLEDGE_ARTICLES)
  inventory.targets.push({
    slug,
    locales: Object.fromEntries(
      LOCALES.map((locale) => {
        const row = rows.article[locale].find((r) => r.slug === slug)

        return [locale, row ? `${row.status} ${row.documentId}` : "missing"]
      })
    ),
  })
for (const draft of legalDrafts())
  inventory.targets.push({
    slug: `legal/${draft.slug}`,
    locales: Object.fromEntries(
      LOCALES.map((locale) => {
        const row = rows.legal[locale].find((r) => r.slug === draft.slug)

        return [locale, row ? `${row.status} ${row.documentId}` : "missing"]
      })
    ),
  })
save(`${target}-inventory.json`, inventory)
if (inventoryOnly) {
  console.log(
    JSON.stringify({
      target,
      inventory: true,
      knowledge: inventory.knowledge.length,
      legal: inventory.legal.length,
      retiredCopy: inventory.retiredCopy.length,
      targets: inventory.targets,
    })
  )
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Plan.

const entries = []
const missing = []
const blockers = []
const unchanged = []
const sectionFor = (locale, anchor) =>
  rows.article[locale].find((r) => r.slug === anchor)?.section?.documentId

if (knowledge) {
  for (const spec of KNOWLEDGE_ARTICLES) {
    let documentId = LOCALES.map((locale) =>
      rows.article[locale].find((r) => r.slug === spec.slug)
    ).find(Boolean)?.documentId
    const authorRow = rows.article.en.find((r) => r.slug === spec.slug)
    for (const locale of LOCALES) {
      articleCopy(spec.slug, locale)
      const row = rows.article[locale].find((r) => r.slug === spec.slug)
      const key = `article/${spec.slug}/${locale}`
      if (row) {
        const published =
          row.status === "draft"
            ? null
            : await get("article", row.documentId, locale, "published")
        const draft = await get("article", row.documentId, locale)
        const { data, dropped } = plannedArticle(
          spec.slug,
          locale,
          published ?? draft
        )
        const done = matches(draft, data)
        if (row.status !== "published" && !done && !ownDraft(key, draft)) {
          blockers.push(`${key}: unrelated unpublished edits need review`)
          continue
        }
        if (done && row.status === "published") {
          unchanged.push(key)
          continue
        }
        entries.push({
          key,
          model: "article",
          action: done ? "already-staged" : "update",
          slug: spec.slug,
          locale,
          documentId: row.documentId,
          updatedAt: draft.updatedAt,
          beforeMetadata: metadata(draft, ARTICLE_METADATA),
          data,
          dropped,
        })
        continue
      }
      const section = sectionFor(locale, spec.anchor)
      if (!section) {
        missing.push({
          slug: spec.slug,
          locale,
          reason: `No ${locale} variant of the section guide “${spec.anchor}”; the section is not offered in this locale`,
        })
        continue
      }
      const { data } = plannedArticle(spec.slug, locale, null)
      entries.push({
        key,
        model: "article",
        action: documentId ? "add-locale" : "create",
        slug: spec.slug,
        locale,
        documentId: documentId ?? null,
        group: spec.slug,
        data: {
          ...data,
          slug: spec.slug,
          author: authorRow?.author ?? AUTHOR,
          section: { connect: [{ documentId: section }] },
          ...(documentId ? {} : { articleStatus: spec.status }),
        },
      })
      documentId ??= "(created by this rollout)"
    }
  }
  for (const slug of SCRUB_SLUGS)
    for (const locale of LOCALES) {
      const row = rows.article[locale].find((r) => r.slug === slug)
      if (!row) continue
      const key = `article/${slug}/${locale}`
      const draft = await get("article", row.documentId, locale)
      const published =
        row.status === "draft"
          ? null
          : await get("article", row.documentId, locale, "published")
      const result = scrubbedBody(published ?? draft, locale)
      if (!result) {
        if (row.status !== "published")
          blockers.push(`${key}: unrelated unpublished edits need review`)
        else unchanged.push(key)
        continue
      }
      const data = { body: result.body }
      const done = matches(draft, data)
      if (row.status !== "published" && !done && !ownDraft(key, draft)) {
        blockers.push(`${key}: unrelated unpublished edits need review`)
        continue
      }
      entries.push({
        key,
        model: "article",
        action: done ? "already-staged" : "update",
        slug,
        locale,
        documentId: row.documentId,
        updatedAt: draft.updatedAt,
        beforeMetadata: metadata(draft, ARTICLE_METADATA),
        data,
        removed: result.removed,
      })
    }
}

if (legal) {
  for (const draftSpec of legalDrafts(legalContacts(env))) {
    const key = `legal/${draftSpec.slug}/en`
    const row = rows.legal.en.find((r) => r.slug === draftSpec.slug)
    for (const locale of LOCALES.filter((l) => l !== "en"))
      if (rows.legal[locale].some((r) => r.slug === draftSpec.slug))
        missing.push({
          slug: `legal/${draftSpec.slug}`,
          locale,
          reason:
            "A translated legal variant exists; no translation drafted. Translate after legal review.",
        })
    if (!row) {
      if (draftSpec.mode !== "replace") {
        blockers.push(`${key}: the published document is missing`)
        continue
      }
      const { data, report } = legalDraftData(null, draftSpec, date)
      entries.push({
        key,
        model: "legal",
        action: "create",
        slug: draftSpec.slug,
        locale: "en",
        documentId: null,
        data: {
          ...data,
          slug: draftSpec.slug,
          order: { membership: 3, "cancellation-refunds": 4 }[draftSpec.slug],
        },
        report,
      })
      continue
    }
    const draft = await get("legal", row.documentId, "en")
    const published =
      row.status === "draft"
        ? null
        : await get("legal", row.documentId, "en", "published")
    const staged = stripComponentIds(draft.revisions ?? []).find(
      (r) => r.summary === draftSpec.summary
    )
    const { data, report } = legalDraftData(
      published ?? draft,
      draftSpec,
      staged?.date ?? date
    )
    const done = matches(draft, data)
    const ours = ownDraft(key, draft)
    if (row.status !== "published" && !done && !ours) {
      blockers.push(`${key}: unrelated unpublished edits need review`)
      continue
    }
    if (
      draft.sections?.some((s) => s.heading === REVIEW_HEADING) &&
      !done &&
      !ours
    ) {
      blockers.push(`${key}: an earlier review draft differs; inspect it first`)
      continue
    }
    entries.push({
      key,
      model: "legal",
      action: done ? "already-staged" : "update",
      slug: draftSpec.slug,
      locale: "en",
      documentId: row.documentId,
      updatedAt: draft.updatedAt,
      beforeMetadata: metadata(draft, LEGAL_METADATA),
      data,
      report,
    })
  }
}

const digest = createHash("sha256")
  .update(
    JSON.stringify(
      entries.map(({ key, action, data }) => ({
        key,
        action: action === "already-staged" ? "update" : action,
        data,
      }))
    )
  )
  .digest("hex")
const preview = { target, date, digest, entries, missing, blockers, unchanged }
save(`${target}-preview.json`, preview)
console.log(
  JSON.stringify({
    target,
    stage,
    digest,
    changes: entries.filter((e) => e.action !== "already-staged").length,
    alreadyStaged: entries.filter((e) => e.action === "already-staged").length,
    missing: missing.length,
    blockers,
    retiredCopy: inventory.retiredCopy.length,
    preview: `.scratch/sponsored-access/${target}-preview.json`,
  })
)
if (!stage) process.exit(0)

// ---------------------------------------------------------------------------
// Stage drafts. Every write follows a complete preflight and is read back.

if (option("digest") !== digest)
  throw new Error("The plan differs from the reviewed preview digest")
if (blockers.length) throw new Error("Resolve the preview blockers first")
save(`${target}-before-${randomUUID()}.json`, { entries })
const checkpoint = `${target}-staged.json`
const created = {}
async function sectionRelation(id, locale) {
  const relation = await api(
    `relations/${MODELS.article}/${id}/section`,
    locale
  )

  return relation.results?.map((r) => r.documentId) ?? []
}
for (const entry of entries) {
  if (entry.action === "already-staged") continue
  const model = entry.model
  let id = entry.documentId
  if (entry.action === "update") {
    const current = await get(model, id, entry.locale)
    const fields = model === "legal" ? LEGAL_METADATA : ARTICLE_METADATA
    if (
      current.updatedAt !== entry.updatedAt ||
      !isDeepStrictEqual(metadata(current, fields), entry.beforeMetadata)
    )
      throw new Error(`Changed after preview: ${entry.key}`)
    await api(`${base(model)}/${id}`, entry.locale, "PUT", entry.data)
  } else if (entry.action === "create") {
    const result = unwrap(
      await api(base(model), entry.locale, "POST", entry.data)
    )
    id = result.documentId
    if (!id)
      throw new Error(`CMS did not return a document identity: ${entry.key}`)
    if (entry.group) created[entry.group] = id
  } else {
    id = entry.documentId?.startsWith("(")
      ? created[entry.group]
      : entry.documentId
    if (!id) throw new Error(`Created document unavailable: ${entry.key}`)
    await api(`${base(model)}/${id}`, entry.locale, "PUT", entry.data)
  }
  entry.stagedDocumentId = id
  const checked = await get(model, id, entry.locale)
  if (!matches(checked, entry.data))
    throw new Error(`Read-back differs: ${entry.key}`)
  if (checked.publishedAt && entry.action !== "update")
    throw new Error(`Unexpected publication: ${entry.key}`)
  if (entry.beforeMetadata) {
    const fields = model === "legal" ? LEGAL_METADATA : ARTICLE_METADATA
    if (!isDeepStrictEqual(metadata(checked, fields), entry.beforeMetadata))
      throw new Error(`Unrelated metadata changed: ${entry.key}`)
  }
  if (entry.data.section) {
    const sections = await sectionRelation(id, entry.locale)
    if (
      sections.length !== 1 ||
      sections[0] !== entry.data.section.connect[0].documentId
    )
      throw new Error(`Section relation not set: ${entry.key}`)
  }
  if (model === "legal" && entry.action === "update") {
    // Published text and its accepted revision history must be untouched.
    const live = await get(model, id, entry.locale, "published")
    const history = stripComponentIds(live.revisions ?? [])
    if (
      !isDeepStrictEqual(
        stripComponentIds(checked.revisions).slice(0, history.length),
        history
      )
    )
      throw new Error(`Historical revisions changed: ${entry.key}`)
  }
  entry.staged = true
  save(checkpoint, { target, digest, entries })
  console.log(
    JSON.stringify({ staged: entry.key, documentId: id, published: false })
  )
}
console.log(
  JSON.stringify({
    target,
    staged: entries.filter((e) => e.staged).length,
    published: 0,
    owned: OWNED_FIELDS,
  })
)
