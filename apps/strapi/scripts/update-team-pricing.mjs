/** Content-only update. Production is the default; preview before --apply. */
import { randomUUID } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isDeepStrictEqual, parseEnv } from "node:util"

import {
  apiKnowledgeArticle,
  apiKnowledgeBody,
  apiKnowledgeSummary,
  pricingGuideBody,
  pricingLegalSections,
  stripComponentIds,
} from "./team-pricing-content.mjs"
import { teamServiceLegalMetadata } from "./team-service-content.mjs"

const args = new Set(process.argv.slice(2))
const target = args.has("--local") ? "local" : "production"
const apply = args.has("--apply")
const apiGuideOnly = args.has("--api-guide-only")
const source = parseEnv(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
)
const origin =
  target === "local"
    ? "http://127.0.0.1:1337"
    : process.env.STRAPI_PRODUCTION_URL ||
      source.STRAPI_PRODUCTION_URL ||
      "http://127.0.0.1:18013"
const token =
  target === "local"
    ? source.STRAPI_MCP_TOKEN
    : source.STRAPI_PRODUCTION_MCP_TOKEN || source.STRAPI_MCP_TOKEN
if (!token) throw new Error("The selected CMS Admin Token is missing")
if (target === "production" && new URL(origin).port === "1337")
  throw new Error("Production must not use the local-development port")
const api = async (path, locale, method = "GET", data) => {
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
    throw new Error(`CMS ${method} failed with HTTP ${response.status}`)

  return response.json()
}
const list = async (type, locale) => {
  const results = []
  for (let page = 1; page <= 20; page++) {
    const data = await api(
      `collection-types/api::${type}.${type}?page=${page}&pageSize=100&status=draft`,
      locale
    )
    results.push(...data.results)
    if (page >= data.pagination.pageCount) return results
  }
  throw new Error("Content exceeds the bounded inspection limit")
}
const before = []
const plans = []
for (const locale of apiGuideOnly ? [] : ["en", "fr", "cs"]) {
  for (const doc of await list("wiki-article", locale)) {
    const body = pricingGuideBody(doc, locale)
    if (!body || isDeepStrictEqual(body, stripComponentIds(doc.body))) continue
    if (doc.status === "modified")
      throw new Error(`Unpublished edits need review: ${locale}/${doc.slug}`)
    before.push({ type: "wiki-article", locale, doc })
    plans.push({
      type: "wiki-article",
      locale,
      doc,
      data: { title: doc.title, slug: doc.slug, body },
    })
  }
}
const legal = apiGuideOnly ? [] : await list("legal-document", "en")
for (const doc of legal) {
  const sections = pricingLegalSections(doc)
  if (!sections || isDeepStrictEqual(sections, stripComponentIds(doc.sections)))
    continue
  if (doc.status === "modified")
    throw new Error(`Unpublished edits need review: ${doc.slug}`)
  before.push({ type: "legal-document", locale: "en", doc })
  const version = doc.slug === "terms" ? "1.1" : "1.3"
  plans.push({
    type: "legal-document",
    locale: "en",
    doc,
    data: {
      title: doc.title,
      slug: doc.slug,
      ...teamServiceLegalMetadata({
        ...doc,
        summaryPoints: stripComponentIds(doc.summaryPoints),
      }),
      sections,
      revisions: [
        ...stripComponentIds(doc.revisions ?? []).filter(
          (r) => r.version !== version
        ),
        {
          version,
          date: "2026-10-22",
          changesUrl: null,
          summary:
            doc.slug === "terms"
              ? "Clarified organisation-owned Team billing, Organiser handover and individual beta invitations."
              : doc.slug === "privacy"
                ? "Documented organisation-owned Team subscriptions, seat and consent records and financial retention."
                : doc.slug === "cancellation-refunds"
                  ? "Updated the Team billing workspace link. Cancellation rights and pricing remain unchanged."
                  : "Clarified one Team per account, unlimited API keys and the shared Team API allowance. Annual pricing, verification and historical purchase consent remain unchanged.",
        },
      ],
    },
  })
}
const english = await list("wiki-article", "en")
const existingApi = english.find((doc) => doc.slug === "team-api-access")
const dataSection = english.find((doc) => doc.slug === "reusing-the-data")
  ?.section?.documentId
if (!existingApi && !dataSection)
  throw new Error("The Data & API section could not be identified")
if (!existingApi)
  plans.push({
    type: "wiki-article",
    locale: "en",
    data: apiKnowledgeArticle(dataSection),
  })
else {
  const body = apiKnowledgeBody(existingApi)
  if (
    !isDeepStrictEqual(body, stripComponentIds(existingApi.body)) ||
    existingApi.summary !== apiKnowledgeSummary
  ) {
    if (existingApi.status === "modified")
      throw new Error("Unpublished edits need review: en/team-api-access")
    before.push({ type: "wiki-article", locale: "en", doc: existingApi })
    plans.push({
      type: "wiki-article",
      locale: "en",
      doc: existingApi,
      data: {
        title: existingApi.title,
        slug: existingApi.slug,
        summary: apiKnowledgeSummary,
        body,
      },
    })
  }
}
const directory = new URL("../../../.scratch/pricing-rollout/", import.meta.url)
mkdirSync(directory, { recursive: true, mode: 0o700 })
writeFileSync(
  new URL(`cms-${target}-pricing-preview.json`, directory),
  JSON.stringify(plans, null, 2),
  { mode: 0o600 }
)
console.log(
  JSON.stringify({
    target,
    apply,
    changes: plans.map((p) => ({
      type: p.type,
      locale: p.locale,
      slug: p.data.slug,
      publish: !p.doc || p.doc.status === "published",
    })),
  })
)
if (apply) {
  writeFileSync(
    new URL(`cms-${target}-pricing-before-${randomUUID()}.json`, directory),
    JSON.stringify(before, null, 2),
    { mode: 0o600 }
  )
  for (const plan of plans) {
    const base = `collection-types/api::${plan.type}.${plan.type}`
    if (plan.doc) {
      const current = await api(`${base}/${plan.doc.documentId}`, plan.locale)
      const doc = current.data ?? current
      if (doc.updatedAt !== plan.doc.updatedAt)
        throw new Error(`Content changed during review: ${plan.data.slug}`)
    }
    const publish = !plan.doc || plan.doc.status === "published"
    const path = publish
      ? `${base}${plan.doc ? `/${plan.doc.documentId}` : ""}/actions/publish`
      : `${base}/${plan.doc.documentId}`
    const result = await api(
      path,
      plan.locale,
      publish ? "POST" : "PUT",
      plan.data
    )
    const id =
      plan.doc?.documentId ?? result.data?.documentId ?? result.documentId
    if (!id) throw new Error("CMS did not return a stable document ID")
    const checked = await api(
      `${base}/${id}?status=${publish ? "published" : "draft"}`,
      plan.locale
    )
    const doc = checked.data ?? checked
    const field = plan.data.body ? "body" : "sections"
    if (!isDeepStrictEqual(stripComponentIds(doc[field]), plan.data[field]))
      throw new Error(
        `Published content verification failed: ${plan.data.slug}`
      )
    console.log(
      JSON.stringify({
        updated: plan.data.slug,
        locale: plan.locale,
        published: publish,
        documentId: id,
      })
    )
  }
}
