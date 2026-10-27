/** Link-only rollout for the membership/pricing split. Preview is the default. */
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import { updateMembershipLinks } from "./membership-page-links.mjs"

const args = new Set(process.argv.slice(2))
if (args.has("--local") === args.has("--production"))
  throw new Error("Choose exactly one CMS target: --local or --production")
const local = args.has("--local")
const apply = args.has("--apply")
if (!local && apply && !args.has("--release-accepted"))
  throw new Error(
    "Publish production links only after the matching routes are deployed and accepted (--release-accepted)"
  )
const env = parseEnv(
  readFileSync(
    process.env.CMS_ENV_FILE || new URL("../.env", import.meta.url),
    "utf8"
  )
)
const origin = local
  ? "http://127.0.0.1:1337"
  : process.env.STRAPI_PRODUCTION_URL || env.STRAPI_PRODUCTION_URL
const token = local
  ? env.STRAPI_MCP_TOKEN
  : process.env.STRAPI_PRODUCTION_MCP_TOKEN || env.STRAPI_PRODUCTION_MCP_TOKEN
if (!origin || !token)
  throw new Error("The selected CMS URL and scoped Admin Token are required")
if (!local && new URL(origin).port === "1337")
  throw new Error("Production must not target the local CMS")
const target = local ? "local" : "production"
const folder = new URL(
  "../../../.scratch/membership-page-links/",
  import.meta.url
)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, data) =>
  writeFileSync(new URL(name, folder), JSON.stringify(data, null, 2) + "\n", {
    mode: 0o600,
  })
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
      `CMS ${method} ${path.split("?")[0]} failed with HTTP ${response.status}`
    )

  return response.json()
}
const document = (data) => data.data ?? data
// Publication can assign new component row IDs. Compare their content and
// document identities while keeping the draft component IDs in the update.
const comparable = (value) =>
  Array.isArray(value)
    ? value.map(comparable)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([key]) => key !== "id")
            .map(([key, item]) => [key, comparable(item)])
        )
      : value
// Public editorial surfaces only: no account, customer, claim or billing records.
const models = [
  "footer",
  "homepage",
  "wiki-article",
  "blog-article",
  "legal-document",
]
const plans = []
for (const model of models) {
  const schema = JSON.parse(
    readFileSync(
      new URL(
        `../src/api/${model}/content-types/${model}/schema.json`,
        import.meta.url
      ),
      "utf8"
    )
  )
  const single = schema.kind === "singleType"
  const base = `${single ? "single-types" : "collection-types"}/api::${model}.${model}`
  const locales = schema.pluginOptions?.i18n?.localized
    ? ["en", "fr", "cs"]
    : ["en"]
  const attributes = Object.entries(schema.attributes)
    .filter(([, field]) =>
      [
        "string",
        "text",
        "richtext",
        "blocks",
        "json",
        "component",
        "dynamiczone",
        "customField",
      ].includes(field.type)
    )
    .map(([name]) => name)
  for (const locale of locales) {
    const docs = []
    if (single) docs.push(document(await api(`${base}?status=draft`, locale)))
    else
      for (let page = 1; page <= 20; page++) {
        const result = await api(
          `${base}?status=draft&page=${page}&pageSize=100`,
          locale
        )
        docs.push(...result.results)
        if (page >= result.pagination.pageCount) break
        if (page === 20)
          throw new Error("Editorial content exceeded the inspection limit")
      }
    for (const doc of docs) {
      if (!doc.documentId) continue
      const data = {}
      for (const key of attributes) {
        if (["slug", "source"].includes(key) || doc[key] === undefined) continue
        const updated = updateMembershipLinks(doc[key], locale)
        if (!isDeepStrictEqual(updated, doc[key])) data[key] = updated
      }
      if (Object.keys(data).length)
        plans.push({
          base,
          locale,
          doc,
          data,
          draftAndPublish: schema.options?.draftAndPublish === true,
          path: single ? base : `${base}/${doc.documentId}`,
        })
    }
  }
}
save(`${target}-preview.json`, plans)
console.log(
  JSON.stringify({
    target,
    apply,
    changes: plans.map(({ base, locale, doc, data }) => ({
      type: base.split("/")[1],
      locale,
      documentId: doc.documentId,
      fields: Object.keys(data),
    })),
  })
)
if (!apply) process.exit(0)
if (plans.some((p) => p.draftAndPublish && p.doc.status !== "published"))
  throw new Error(
    "Unpublished editorial edits need review; preview is saved and nothing was changed"
  )
save(`${target}-before-${randomUUID()}.json`, plans)
for (const plan of plans) {
  const current = document(await api(`${plan.path}?status=draft`, plan.locale))
  if (
    current.updatedAt !== plan.doc.updatedAt ||
    (plan.draftAndPublish && current.status !== plan.doc.status) ||
    Object.keys(plan.data).some(
      (key) =>
        !isDeepStrictEqual(comparable(current[key]), comparable(plan.doc[key]))
    )
  )
    throw new Error("Content changed after preview; nothing was overwritten")
  await api(plan.path, plan.locale, "PUT", plan.data)
  if (plan.draftAndPublish)
    await api(`${plan.path}/actions/publish`, plan.locale, "POST", {})
  const after = document(
    await api(
      `${plan.path}?status=${plan.draftAndPublish ? "published" : "draft"}`,
      plan.locale
    )
  )
  for (const [key, value] of Object.entries(plan.data)) {
    if (!isDeepStrictEqual(comparable(after[key]), comparable(value)))
      throw new Error(`Read-back mismatch in ${key}; inspect the saved backup`)
  }
  const metadata = [
    "title",
    "slug",
    "summary",
    "version",
    "effectiveAt",
    "seo",
    "featured",
    "priority",
    "articleStatus",
    "docsSections",
    "continents",
    "author",
    "heroImage",
    "section",
    "category",
    "relatedArticles",
    "contributors",
    "topics",
    "libraries",
    "countries",
  ]
  for (const key of metadata)
    if (!(key in plan.data) && !isDeepStrictEqual(after[key], current[key]))
      throw new Error(`Preserved metadata changed: ${key}`)
}
console.log(JSON.stringify({ target, verified: plans.length }))
