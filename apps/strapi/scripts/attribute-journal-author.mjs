/** Preserve every article's content while assigning a verified public author. */
import { createHash } from "node:crypto"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { parseEnv } from "node:util"

const args = process.argv.slice(2)
const { resolve } = path
const arg = (key, fallback) => {
  const index = args.indexOf(key)

  return index === -1 ? fallback : args[index + 1]
}
const env = parseEnv(
  readFileSync(arg("--env-file", new URL("../.env", import.meta.url)), "utf8")
)
const bridge = args.includes("--bridge-env")
  ? parseEnv(readFileSync(arg("--bridge-env"), "utf8"))
  : env
const local = args.includes("--local")
const apply = args.includes("--apply")
const username = arg("--username")
if (!username || !/^[A-Za-z0-9_-]{1,80}$/.test(username))
  throw new Error("Pass a public --username")
const origin = arg(
  "--url",
  local ? env.STRAPI_URL || "http://127.0.0.1:1337" : env.STRAPI_PRODUCTION_URL
)
if (!origin)
  throw new Error("Pass an explicit --url or configure STRAPI_PRODUCTION_URL")
const cmsUrl = new URL(origin)
if (
  cmsUrl.username ||
  cmsUrl.password ||
  !["https:", "http:"].includes(cmsUrl.protocol) ||
  (cmsUrl.protocol === "http:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(cmsUrl.hostname))
)
  throw new Error(
    "Use HTTPS or a loopback CMS connection without URL credentials"
  )
if (!local && cmsUrl.port === "1337")
  throw new Error("Production must not use the local CMS port")
const token = local
  ? env.STRAPI_MCP_TOKEN
  : env.STRAPI_PRODUCTION_MCP_TOKEN || env.STRAPI_MCP_TOKEN
if (!token) throw new Error("Missing scoped content token")
async function request(path, method = "GET", data, publicProfile = false) {
  const response = await fetch(new URL(path, origin), {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(publicProfile
        ? { "X-Service-Secret": bridge.STRAPI_BRIDGE_SECRET || "" }
        : { Authorization: `Bearer ${token}` }),
    },
    ...(data ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  if (!response.ok)
    throw new Error(`CMS ${method} failed with HTTP ${response.status}`)

  return response.json()
}
const profileResponse = await request(
  `/api/user-profiles/by-username/${encodeURIComponent(username)}`,
  "GET",
  undefined,
  true
)
const profile = profileResponse.data
if (
  profile?.username !== username ||
  !/^[a-z0-9]{20,32}$/.test(profile.documentId)
)
  throw new Error("Requested public author was not resolved")
const authorName =
  [profile.firstName, profile.lastName].filter(Boolean).join(" ") || username
const localesResponse = await request(
  "/api/content-moderation/locales",
  "GET",
  undefined,
  true
)
const locales = localesResponse.data?.map((locale) => locale.code)
if (!Array.isArray(locales) || !locales.length)
  throw new Error("CMS locales unavailable")
const base = "/content-manager/collection-types/api::blog-article.blog-article"
const canonical = (value, root = false) => {
  if (Array.isArray(value)) return value.map((entry) => canonical(entry))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .filter(
          (key) =>
            ![
              "id",
              "createdAt",
              "updatedAt",
              "publishedAt",
              "firstPublishedAt",
              "createdBy",
              "updatedBy",
              "status",
              "authorProfile",
              "author",
              "localizations",
            ].includes(key) && !(root && key === "documentId")
        )
        .sort()
        .map((key) => [key, canonical(value[key])])
    )

  return value ?? null
}
const fingerprint = (doc) =>
  createHash("sha256")
    .update(JSON.stringify(canonical(doc, true)))
    .digest("hex")
const plans = []
for (const locale of locales) {
  for (let page = 1; page <= 50; page++) {
    const list = await request(
      `${base}?locale=${encodeURIComponent(locale)}&page=${page}&pageSize=100&status=draft`
    )
    for (const row of list.results ?? []) {
      const detail = await request(
        `${base}/${row.documentId}?locale=${encodeURIComponent(locale)}`
      )
      const doc = detail.data ?? detail
      if (doc.status === "modified" || row.status === "modified")
        throw new Error(
          `Unpublished edits require a separate preservation plan: ${locale}/${doc.slug}`
        )
      plans.push({
        locale,
        documentId: row.documentId,
        slug: doc.slug,
        status: doc.status ?? row.status,
        before: doc,
        fingerprint: fingerprint(doc),
        data: {
          author: authorName,
          authorProfile: { connect: [{ documentId: profile.documentId }] },
        },
      })
    }
    if (page >= (list.pagination?.pageCount ?? 1)) break
    if (page === 50) throw new Error("Bounded article inventory exceeded")
  }
}
const directory = resolve(
  arg("--output", ".scratch/community-publishing-attribution")
)
mkdirSync(directory, { recursive: true })
const run = new Date().toISOString().replaceAll(/[:.]/g, "-")
writeFileSync(
  resolve(directory, `before-${run}.json`),
  JSON.stringify(
    {
      environment: local ? "local" : "production",
      username,
      profileId: profile.documentId,
      plans,
    },
    null,
    2
  ),
  { mode: 0o600 }
)
writeFileSync(
  resolve(directory, `preview-${run}.json`),
  JSON.stringify(
    {
      username,
      authorName,
      profileId: profile.documentId,
      articles: plans.map(({ locale, documentId, slug, status }) => ({
        locale,
        documentId,
        slug,
        status,
      })),
    },
    null,
    2
  ),
  { mode: 0o600 }
)
console.log(
  JSON.stringify({
    environment: local ? "local" : "production",
    author: username,
    variants: plans.length,
    documents: new Set(plans.map((plan) => plan.documentId)).size,
    mode: apply ? "apply" : "preview",
  })
)
if (apply) {
  for (const plan of plans) {
    const path = `${base}/${plan.documentId}?locale=${encodeURIComponent(plan.locale)}`
    const fresh = await request(path)
    if (fingerprint(fresh.data ?? fresh) !== plan.fingerprint)
      throw new Error(
        `Article changed after preview: ${plan.locale}/${plan.slug}`
      )
    await request(path, "PUT", plan.data)
    if (plan.status === "published")
      await request(
        `${base}/${plan.documentId}/actions/publish?locale=${encodeURIComponent(plan.locale)}`,
        "POST",
        {}
      )
    const afterResponse = await request(path)
    const after = afterResponse.data ?? afterResponse
    if (fingerprint(after) !== plan.fingerprint)
      throw new Error(`Preservation check failed: ${plan.locale}/${plan.slug}`)
    const publicResponse =
      plan.status === "published"
        ? await request(
            `/api/blog-articles/detail/${encodeURIComponent(plan.slug)}?locale=${encodeURIComponent(plan.locale)}`,
            "GET",
            undefined,
            true
          )
        : null
    if (
      publicResponse &&
      publicResponse.data?.authorProfile?.username !== username
    )
      throw new Error(
        `Published byline verification failed: ${plan.locale}/${plan.slug}`
      )
  }
  writeFileSync(
    resolve(directory, `accepted-${run}.json`),
    JSON.stringify(
      {
        author: username,
        variants: plans.length,
        preserved: true,
        readBack: true,
      },
      null,
      2
    ),
    { mode: 0o600 }
  )
  console.log(
    JSON.stringify({
      attributed: plans.length,
      preserved: true,
      readBack: true,
    })
  )
}
