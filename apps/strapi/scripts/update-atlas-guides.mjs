/** Production editorial workflow. Never enables a transport or changes permissions. */
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { parseEnv, isDeepStrictEqual } from "node:util"

import {
  atlasLocalizedCorrections,
  atlasKnowledgeArticles,
  atlasJournal,
  atlasExploringBody,
  atlasExportBody,
  atlasRich,
  reachAllowanceCopy,
} from "./atlas-knowledge-content.mjs"

const KNOWLEDGE_MODEL = "wiki-article"
function replaceText(value, before, after) {
  if (Array.isArray(value))
    return value.map((child) => replaceText(child, before, after))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        replaceText(child, before, after),
      ])
    )

  return typeof value === "string" ? value.replace(before, after) : value
}

const args = new Set(process.argv.slice(2))
const stage = args.has("--stage")
const publish = args.has("--publish-staged")
const current = args.has("--publish-current")
assert.ok([stage, publish, current].filter(Boolean).length <= 1)
const env = parseEnv(
  readFileSync(
    process.env.CMS_ENV_FILE || new URL("../.env", import.meta.url),
    "utf8"
  )
)
const local = args.has("--local")
const origin = local
  ? "http://127.0.0.1:1337"
  : process.env.STRAPI_PRODUCTION_URL ||
    env.STRAPI_PRODUCTION_URL ||
    "http://127.0.0.1:18013"
assert.ok(
  local || new URL(origin).port !== "1337",
  "Explicit production connection required"
)
const token = local
  ? env.STRAPI_MCP_TOKEN
  : process.env.STRAPI_PRODUCTION_MCP_TOKEN ||
    env.STRAPI_PRODUCTION_MCP_TOKEN ||
    env.STRAPI_MCP_TOKEN
assert.ok(token, "Selected editorial credential required")
const folder = new URL("../../../.scratch/atlas-guides/", import.meta.url)
mkdirSync(folder, { recursive: true, mode: 0o700 })
const save = (name, value) =>
  writeFileSync(new URL(name, folder), JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  })
const normalize = (value) =>
  Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .filter(([k, v]) => k !== "id" && v !== null)
            .map(([k, v]) => [
              k,
              ["image", "heroImage"].includes(k) && v && typeof v === "object"
                ? v.id
                : normalize(v),
            ])
        )
      : value
const checkpointName = `${local ? "local" : "production"}-staged.json`
const clean = normalize
async function api(path, method = "GET", data, locale = "en") {
  const url = new URL("/content-manager/" + path, origin)
  url.searchParams.set("locale", locale)
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    },
    ...(data ? { body: JSON.stringify({ ...data, locale }) } : {}),
    signal: AbortSignal.timeout(30000),
  })
  assert.ok(r.ok, `CMS ${method}: HTTP ${r.status}`)

  return r.json()
}
const base = (model) => `collection-types/api::${model}.${model}`
const doc = (v) => v.data ?? v
const get = async (model, id, status = "draft", locale = "en") =>
  doc(
    await api(`${base(model)}/${id}?status=${status}`, "GET", undefined, locale)
  )
const fields = [
  "title",
  "slug",
  "summary",
  "body",
  "author",
  "authorTitle",
  "authorBio",
  "seo",
  "heroImage",
]
const digest = (value) =>
  createHash("sha256")
    .update(JSON.stringify(clean(value)))
    .digest("hex")
const owned = (value, key) => clean({ [key]: value })[key]
function verify(value, data) {
  for (const key of fields)
    if (key in data)
      assert.deepEqual(
        owned(value[key], key),
        owned(data[key], key),
        `Read-back differs: ${data.slug}/${key}`
      )
}
if (publish) {
  assert.ok(
    process.env.ATLAS_CAPACITY_RELEASE_ACCEPTED === "true",
    "Complete matching release acceptance before publishing capacity claims"
  )
  const entries = JSON.parse(
    readFileSync(new URL(checkpointName, folder), "utf8")
  )
  for (const entry of entries) {
    const value = await get(entry.model, entry.id)
    assert.equal(
      value.updatedAt,
      entry.updatedAt,
      "Draft changed after staging"
    )
    verify(value, entry.data)
    await api(`${base(entry.model)}/${entry.id}/actions/publish`, "POST", {})
    const live = await get(entry.model, entry.id, "published")
    verify(live, entry.data)
    console.log(JSON.stringify({ published: entry.data.slug, verified: true }))
  }
  process.exit(0)
}
async function catalogue(model, locale = "en") {
  const rows = []
  for (let page = 1; page <= 10; page++) {
    const v = await api(
      `${base(model)}?status=draft&pageSize=100&page=${page}`,
      "GET",
      undefined,
      locale
    )
    rows.push(...v.results)
    if (page >= v.pagination.pageCount) return rows
  }
  throw new Error("Article catalogue exceeds budget")
}
const priorPreviewPath = new URL("./current-preview.json", folder)
if (current && existsSync(priorPreviewPath)) {
  const previous = JSON.parse(readFileSync(priorPreviewPath, "utf8"))
  for (const entry of previous.filter((p) => !p.existing)) {
    const found = await api(
      `${base(entry.model)}?status=draft&pageSize=2&filters[slug][$eq]=${encodeURIComponent(entry.data.slug)}`
    )
    assert.ok(found.results.length <= 1)
    if (!found.results.length || found.results[0].status === "published")
      continue
    const draft = await get(entry.model, found.results[0].documentId)
    assert.ok(!draft.publishedAt, "Unrelated publication requires review")
    verify(draft, entry.data)
    await api(
      `${base(entry.model)}/${draft.documentId}/actions/publish`,
      "POST",
      {}
    )
    verify(await get(entry.model, draft.documentId, "published"), entry.data)
    console.log(JSON.stringify({ resumed: entry.data.slug, verified: true }))
  }
  for (const entry of previous.filter((p) => p.existing)) {
    const draft = await get(entry.model, entry.existing.documentId)
    if (draft.status === "published") continue
    verify(draft, entry.data)
    const live = await get(entry.model, entry.existing.documentId, "published")
    verify(
      live,
      Object.fromEntries(
        fields
          .filter((k) => k in entry.existing)
          .map((k) => [k, entry.existing[k]])
      )
    )
    await api(
      `${base(entry.model)}/${draft.documentId}/actions/publish`,
      "POST",
      {}
    )
    verify(await get(entry.model, draft.documentId, "published"), entry.data)
    console.log(JSON.stringify({ resumed: entry.data.slug, verified: true }))
  }
}
const guides = await catalogue(KNOWLEDGE_MODEL)
const stories = await catalogue("blog-article")
const section = guides.find(
  (d) => d.slug === "exporting-from-the-atlas"
)?.section
assert.ok(section?.documentId)
const specs = atlasKnowledgeArticles(section.documentId, stage).map((data) => ({
  model: KNOWLEDGE_MODEL,
  data,
}))
if (!stage) {
  for (const slug of ["plans-and-pro", "teams-for-library-services"]) {
    const existing = guides.find((d) => d.slug === slug)
    assert.ok(existing)
    const body = replaceText(
      clean(existing.body),
      "once Reach ships; it is not offered before those tools are available.",
      "when that separate offer is introduced; it is not currently offered. Shipping Reach does not change an existing subscription price."
    ).filter((c) => !JSON.stringify(c).includes("Delivered Atlas tools"))
    body.push(
      atlasRich(
        "## Delivered Atlas tools\n\nPro includes UK walking and cycling Reach, Library access and two-area population comparisons, deprivation and households without a car where the required datasets are installed. Population density is available with a free account. Transit, service benchmarking, shared analysis workspaces and traffic reports remain planned. Country library imports do not install local routing or population packs."
      )
    )
    specs.push({ model: KNOWLEDGE_MODEL, data: { slug, body } })
  }
  specs.push(
    {
      model: KNOWLEDGE_MODEL,
      data: { slug: "exploring-the-atlas", body: atlasExploringBody },
    },
    {
      model: KNOWLEDGE_MODEL,
      data: { slug: "exporting-from-the-atlas", body: atlasExportBody },
    }
  )
}
const reference = stories.find(
  (d) => d.slug === "uk-public-libraries-from-libraryon"
)
assert.ok(
  reference?.status === "published" && reference.authorProfile?.documentId
)
const journalCopy = atlasJournal(stage)
const journal = {
  ...journalCopy,
  seo: {
    metaTitle: journalCopy.title,
    metaDescription:
      "Population detail, walking and cycling Reach, clearer library records and map controls, with an Aberdeen example and guidance on service boundaries.",
  },
  section: { connect: [{ documentId: reference.section.documentId }] },
  author: reference.author,
  authorTitle: reference.authorTitle,
  authorBio: reference.authorBio,
  authorProfile: {
    connect: [{ documentId: reference.authorProfile.documentId }],
  },
  publicationOrigin: "index",
}
// Optional files are the user's two Reddit screenshots, already inspected. Reuse
// the recorded media IDs across previews/staging; never upload duplicates blindly.
const mediaPath = new URL("./media.json", folder)
let media = existsSync(mediaPath)
  ? JSON.parse(readFileSync(mediaPath, "utf8"))
  : []
if (current && process.env.ATLAS_IMAGE_FILES_JSON && media.length < 2) {
  const paths = JSON.parse(process.env.ATLAS_IMAGE_FILES_JSON)
  assert.ok(paths.length === 2)
  for (const [i, path] of paths.entries()) {
    if (i < media.length) continue
    const form = new FormData()
    form.set(
      "files",
      new Blob([readFileSync(path)], { type: "image/webp" }),
      `atlas-aberdeen-${i ? "population" : "reach"}.webp`
    )
    form.set(
      "fileInfo",
      JSON.stringify({
        name: `Aberdeen ${i ? "population density" : "15-minute walking Reach"} example`,
        alternativeText: i
          ? "Population grid beneath Aberdeen library catchments"
          : "Aberdeen City service Reach showing 48.7% modelled 15-minute walking coverage",
        caption:
          "Libraries Global / Alex Bennett. Example shared on Reddit; GHSL 2020 population, OpenStreetMap routing and LibraryOn records. Modelled proximity, not observed use.",
      })
    )
    const r = await fetch(new URL("/upload", origin), {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: form,
      signal: AbortSignal.timeout(60000),
    })
    assert.ok(r.ok, `Media upload: HTTP ${r.status}`)
    const value = await r.json()
    assert.ok(value.length === 1 && Number.isInteger(value[0].id))
    media.push(value[0])
    save("media.json", media)
  }
}
if (media.length === 2) {
  journal.heroImage = media[0].id
  journal.body.splice(1, 0, {
    __component: "content.image-block",
    image: media[0].id,
    caption:
      "Aberdeen City service: 48.7% within a modelled 15-minute walk, using the 2020 population grid. Screenshot: Libraries Global / Alex Bennett; LibraryOn, GHSL and OpenStreetMap sources.",
    alternativeText:
      "Aberdeen map with library catchments and 48.7% service coverage",
    fullWidth: true,
  })
  journal.body.splice(4, 0, {
    __component: "content.image-block",
    image: media[1].id,
    caption:
      "Population grid beneath the same library catchments. Density and Reach describe different quantities. Screenshot: Libraries Global / Alex Bennett; GHSL 2020, OpenStreetMap and LibraryOn.",
    alternativeText:
      "Population density around the selected Aberdeen libraries",
    fullWidth: true,
  })
}
specs.push({ model: "blog-article", data: journal })
if (stage) {
  for (const slug of ["plans-and-pro", "teams-for-library-services"]) {
    const existing = guides.find((d) => d.slug === slug)
    assert.ok(existing)
    const body = clean(existing.body).filter(
      (c) => !JSON.stringify(c).includes("Atlas calculation capacity")
    )
    body.push(
      atlasRich("## Atlas calculation capacity\n\n" + reachAllowanceCopy(true))
    )
    specs.push({ model: KNOWLEDGE_MODEL, data: { slug, body } })
  }
}
const planned = []
for (const spec of specs) {
  const rows = spec.model === KNOWLEDGE_MODEL ? guides : stories
  const matches = rows.filter((d) => d.slug === spec.data.slug)
  assert.ok(matches.length <= 1)
  const existing = matches[0]
  if (existing) {
    assert.equal(
      existing.status,
      "published",
      `Unrelated unpublished edits: ${existing.slug}`
    )
    spec.data = { ...spec.data, title: spec.data.title ?? existing.title }
    const detailed = await get(spec.model, existing.documentId)
    if (
      fields
        .filter((k) => k in spec.data)
        .every((k) =>
          isDeepStrictEqual(owned(detailed[k], k), owned(spec.data[k], k))
        )
    )
      continue
    spec.existing = existing
  }
  planned.push(spec)
}
save(stage ? "expanded-preview.json" : "current-preview.json", planned)
console.log(
  JSON.stringify({
    target: local ? "local" : "production",
    mode: stage ? "stage" : current ? "publish-current" : "preview",
    changes: planned.map((s) => s.data.slug),
    images: media.length,
  })
)
if (!stage && !current) process.exit(0)
save(
  `before-${Date.now()}.json`,
  planned.filter((p) => p.existing).map((p) => p.existing)
)
const staged = []
for (const spec of planned) {
  const { model, data, existing } = spec
  if (existing) {
    const latest = await get(model, existing.documentId)
    assert.equal(
      latest.updatedAt,
      existing.updatedAt,
      "Concurrent editorial change"
    )
    assert.equal(latest.status, "published", "Unrelated draft requires review")
  }
  let value = doc(
    await api(
      `${base(model)}${existing ? "/" + existing.documentId : ""}`,
      existing ? "PUT" : "POST",
      data
    )
  )
  const id = existing?.documentId ?? value.documentId
  assert.ok(id)
  value = await get(model, id)
  verify(value, data)
  if (existing)
    for (const field of ["section", "relatedArticles"])
      if (!(field in data) && existing[field]?.documentId) {
        const relation = await api(
          `relations/api::${model}.${model}/${id}/${field}?pageSize=100`
        )
        assert.deepEqual(
          relation.results.map((r) => r.documentId),
          [existing[field].documentId],
          `Editorial relation changed: ${data.slug}/${field}`
        )
      }
  if (existing)
    for (const key of [
      "summary",
      "author",
      "authorTitle",
      "authorBio",
      "heroImage",
      "featured",
      "priority",
      "articleStatus",
    ])
      if (!(key in data) && key in existing)
        assert.deepEqual(
          owned(value[key], key),
          owned(existing[key], key),
          `Editorial metadata changed: ${data.slug}/${key}`
        )
  if (stage) {
    staged.push({
      model,
      id,
      updatedAt: value.updatedAt,
      data,
      digest: digest(data),
    })
    save(checkpointName, staged)
    console.log(JSON.stringify({ staged: data.slug, verified: true }))
    continue
  }
  await api(`${base(model)}/${id}/actions/publish`, "POST", {})
  verify(await get(model, id, "published"), data)
  console.log(JSON.stringify({ published: data.slug, verified: true }))
}

if (current)
  for (const [locale, copy] of Object.entries(atlasLocalizedCorrections)) {
    const rows = await catalogue(KNOWLEDGE_MODEL, locale)
    for (const slug of [
      "plans-and-pro",
      "teams-for-library-services",
      "exploring-the-atlas",
      "exporting-from-the-atlas",
    ]) {
      const listed = rows.find((d) => d.slug === slug)
      assert.ok(listed, `Missing translated guide: ${locale}/${slug}`)
      assert.equal(
        listed.status,
        "published",
        `Unrelated translated draft: ${locale}/${slug}`
      )
      const before = await get(
        KNOWLEDGE_MODEL,
        listed.documentId,
        "draft",
        locale
      )
      const body =
        slug === "exploring-the-atlas"
          ? [atlasRich(copy.exploring)]
          : slug === "exporting-from-the-atlas"
            ? [atlasRich(copy.exporting)]
            : [
                ...replaceText(
                  clean(before.body),
                  copy.priceOld,
                  copy.priceNew
                ).filter(
                  (c) => !JSON.stringify(c).includes(copy.deliveredHeading)
                ),
                atlasRich(
                  "## " + copy.deliveredHeading + "\n\n" + copy.delivered
                ),
              ]
      if (isDeepStrictEqual(clean(before.body), clean(body))) continue
      const data = { slug, title: before.title, body }
      save(`${locale}-${slug}-before.json`, before)
      assert.equal(
        (await get(KNOWLEDGE_MODEL, listed.documentId, "draft", locale))
          .updatedAt,
        before.updatedAt,
        "Concurrent translated edit"
      )
      await api(
        `${base(KNOWLEDGE_MODEL)}/${listed.documentId}`,
        "PUT",
        data,
        locale
      )
      verify(
        await get(KNOWLEDGE_MODEL, listed.documentId, "draft", locale),
        data
      )
      await api(
        `${base(KNOWLEDGE_MODEL)}/${listed.documentId}/actions/publish`,
        "POST",
        {},
        locale
      )
      verify(
        await get(KNOWLEDGE_MODEL, listed.documentId, "published", locale),
        data
      )
      console.log(JSON.stringify({ published: slug, locale, verified: true }))
    }
  }
