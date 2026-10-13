/** Translate local editorial documents through MCP; preview unless --apply. */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { StrapiMcpClient } from "./mcp-client"

const TYPES = [
  "wiki-section",
  "blog-section",
  "topic",
  "category",
  "wiki-article",
  "blog-article",
  "wiki-landing",
  "blog-landing",
]
const TEXT_KEYS = new Set(
  "name label description tagLabel heroTitle heroText heroEyebrow title summary text body caption quote attribution source alternativeText authorBio authorTitle metaTitle metaDescription ogTitle ogDescription keywords".split(
    " "
  )
)
type Dictionary = Record<string, Record<string, string>>
const limits: Record<string, number> = {
  metaTitle: 60,
  metaDescription: 160,
  ogTitle: 70,
  ogDescription: 200,
}

function shorten(text: string, length: number) {
  if (text.length <= length) return text
  const cut = text.slice(0, length - 1)
  const lastSpace = cut.lastIndexOf(" ")

  return `${cut.slice(0, lastSpace > length / 2 ? lastSpace : cut.length).replace(/[ ,;:]+$/, "")}…`
}

function translate(
  value: any,
  key: string,
  locale: string,
  dictionary: Dictionary,
  missing: Set<string>
): any {
  if (typeof value === "string") {
    if (
      !TEXT_KEYS.has(key) ||
      !value.trim() ||
      !/[A-Za-z]/.test(value) ||
      /^(https?:\/\/|\/|@repo\/)/.test(value.trim())
    )
      return value
    const translated = dictionary[value]?.[locale]
    if (translated === undefined) {
      missing.add(value)

      return value
    }

    return limits[key] ? shorten(translated, limits[key]) : translated
  }
  if (Array.isArray(value))
    return value.map((item) =>
      translate(item, key, locale, dictionary, missing)
    )
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([field, item]) => field !== "id" && item !== null)
        .map(([field, item]) => [
          field,
          field === "text" && value.code
            ? item
            : translate(item, field, locale, dictionary, missing),
        ])
    )
  }

  return value
}

function matches(expected: any, actual: any): boolean {
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((value, i) => matches(value, actual[i]))
    )
  if (expected && typeof expected === "object")
    return (
      !!actual &&
      Object.entries(expected).every(([key, value]) =>
        matches(value, actual[key])
      )
    )

  return expected === actual
}

function relation(value: any, attribute: any, locale: string) {
  const targetLocale = attribute.target?.endsWith(".library") ? "en" : locale
  const ref = (row: any) => ({
    documentId: row.documentId,
    ...(row.locale ? { locale: targetLocale } : {}),
  })
  if (attribute.relation === "oneToMany" || attribute.relation === "manyToMany")
    return { set: (value ?? []).map(ref) }

  return value?.documentId ? ref(value) : null
}

async function main() {
  try {
    process.loadEnvFile(".env")
  } catch {
    /* Environment may be supplied. */
  }
  const base = process.env.STRAPI_URL || "http://127.0.0.1:1337"
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base))
    throw new Error("Only the local CMS is supported")
  const apply = process.argv.includes("--apply")
  const taxonomyOnly = process.argv.includes("--taxonomy-only")
  let client = new StrapiMcpClient(process.env.STRAPI_MCP_TOKEN, `${base}/mcp`)
  await client.initialize()
  const tools = await client.listTools()
  // A dev-server reload can close an MCP response after applying a write.
  // Document IDs make retries idempotent; every write is followed by a read.
  async function call<T = unknown>(
    tool: string,
    args: Record<string, unknown>
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await client.call<T>(tool, args)
      } catch (error: any) {
        if (
          attempt >= 2 ||
          !/terminated|fetch failed|MCP HTTP 5\d\d|timed? ?out/i.test(
            error.message
          )
        )
          throw error
        console.log(`Retrying ${tool} after a closed local MCP response`)
        await new Promise((resolve) => setTimeout(resolve, 1500))
        client = new StrapiMcpClient(
          process.env.STRAPI_MCP_TOKEN,
          `${base}/mcp`
        )
        await client.initialize()
      }
    }
  }
  async function listAll(type: string, args: Record<string, unknown>) {
    const rows: any[] = []
    for (let page = 1; ; page++) {
      const result = await call<{
        results: any[]
        pagination?: { pageCount: number }
      }>(`list_${type}`, { ...args, page, pageSize: 100 })
      rows.push(...result.results)
      if (!result.pagination || page >= result.pagination.pageCount) return rows
    }
  }
  const output = path.resolve(__dirname, "../../../.scratch/i18n-editorial")
  await mkdir(output, { recursive: true })
  const dictionary: Dictionary = {}
  for (const file of [
    "editorial-translations.json",
    "editorial-overrides.json",
  ]) {
    try {
      const values: Dictionary = JSON.parse(
        await readFile(path.join(__dirname, "i18n", file), "utf8")
      )
      for (const [source, translations] of Object.entries(values))
        dictionary[source] = { ...dictionary[source], ...translations }
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error
    }
  }
  const reviewedSeo: Record<
    string,
    Record<string, Record<string, Record<string, string>>>
  > = JSON.parse(
    await readFile(path.join(__dirname, "i18n/editorial-seo.json"), "utf8")
  )
  let previous: any[] = []
  try {
    previous = JSON.parse(
      await readFile(path.join(output, "editorial-results.json"), "utf8")
    )
  } catch (error: any) {
    if (error.code !== "ENOENT") throw error
  }
  const managed = new Set(
    previous
      .filter((item) => item.status === "verified")
      .map((item) => `${item.type}:${item.documentId}:${item.locale}`)
  )
  const before: any[] = [],
    plan: any[] = []
  for (const type of taxonomyOnly ? TYPES.slice(0, 4) : TYPES) {
    const schema = JSON.parse(
      await readFile(
        path.join(
          __dirname,
          `../src/api/${type}/content-types/${type}/schema.json`
        ),
        "utf8"
      )
    )
    const single = schema.kind === "singleType"
    const source = single
      ? [
          (
            await call<any>(`get_${type}`, {
              locale: "en",
              status: "published",
            })
          ).data,
        ].filter(Boolean)
      : await listAll(type, {
          locale: "en",
          ...(schema.options.draftAndPublish ? { status: "published" } : {}),
        })
    before.push({ type, locale: "en", data: source })
    for (const locale of ["cs", "fr"]) {
      const tool = `${single ? "write" : "update"}_${type}`
      const permitted = tools
        .find((t) => t.name === tool)
        ?.inputSchema.properties?.locale?.enum?.includes(locale)
      if (!permitted) throw new Error(`${tool} does not permit ${locale}`)
      const existing = single
        ? [(await call<any>(`get_${type}`, { locale })).data].filter(Boolean)
        : await listAll(type, { locale })
      before.push({ type, locale, data: existing })
      for (const record of source) {
        const missing = new Set<string>(),
          data: Record<string, any> = {},
          deferred: Record<string, any> = {}
        for (const [field, attribute] of Object.entries<any>(
          schema.attributes
        )) {
          if (
            record[field] === undefined ||
            (record[field] === null && attribute.type !== "relation")
          )
            continue
          if (attribute.type === "relation") {
            if (attribute.mappedBy) continue
            const translated = relation(record[field], attribute, locale)
            if (
              [
                "relatedArticles",
                "quickStartCards",
                "featuredArticle",
              ].includes(field)
            )
              deferred[field] = translated
            else data[field] = translated
          } else if (
            attribute.pluginOptions?.i18n?.localized === true ||
            field === "slug"
          ) {
            data[field] = translate(
              record[field],
              field,
              locale,
              dictionary,
              missing
            )
          }
        }
        const seo = reviewedSeo[type]?.[record.slug]?.[locale]
        if (seo && data.seo) data.seo = { ...data.seo, ...seo }
        plan.push({
          type,
          locale,
          documentId: record.documentId,
          single,
          tool,
          publish: schema.options.draftAndPublish,
          data,
          deferred,
          missing: [...missing],
          exists: existing.some((row) => row.documentId === record.documentId),
        })
      }
    }
  }
  await writeFile(
    path.join(output, `editorial-before-${Date.now()}.json`),
    JSON.stringify(before),
    { mode: 0o600 }
  )
  await writeFile(
    path.join(output, "editorial-plan.json"),
    JSON.stringify(plan, null, 2),
    { mode: 0o600 }
  )
  const incomplete = plan.filter((item) => item.missing.length)
  console.log(
    JSON.stringify({
      apply,
      planned: plan.length,
      incomplete: incomplete.length,
      missingSegments: new Set(incomplete.flatMap((item) => item.missing)).size,
    })
  )
  if (incomplete.length)
    throw new Error("Incomplete translations; nothing written")
  if (!apply) return
  const outcomes: any[] = [...previous]
  for (const item of plan) {
    if (item.exists) {
      outcomes.push({
        type: item.type,
        locale: item.locale,
        documentId: item.documentId,
        status: "existing translation preserved",
      })
      continue
    }
    const identity = item.single ? {} : { documentId: item.documentId }
    await call(item.tool, { ...identity, locale: item.locale, data: item.data })
    if (item.publish)
      await call(`publish_${item.type}`, { ...identity, locale: item.locale })
    const written = (
      await call<any>(`get_${item.type}`, {
        ...identity,
        locale: item.locale,
        ...(item.publish ? { status: "published" } : {}),
      })
    ).data
    const verify = Object.fromEntries(
      Object.entries(item.data).filter(
        ([field]) =>
          typeof item.data[field] !== "object" || !schemaRelation(field)
      )
    )
    if (!matches(verify, written))
      throw new Error(
        `Readback mismatch: ${item.type}/${item.documentId}/${item.locale}`
      )
    outcomes.push({
      type: item.type,
      locale: item.locale,
      documentId: item.documentId,
      status: "verified",
    })
    await writeFile(
      path.join(output, "editorial-results.json"),
      JSON.stringify(outcomes, null, 2),
      { mode: 0o600 }
    )
    console.log(`Verified ${item.type}/${item.documentId}/${item.locale}`)
  }
  // Same-language variants must exist before connecting related stories and landing picks.
  for (const item of plan.filter(
    (item) =>
      (!item.exists ||
        managed.has(`${item.type}:${item.documentId}:${item.locale}`)) &&
      Object.keys(item.deferred).length
  )) {
    const identity = item.single ? {} : { documentId: item.documentId }
    const current = (
      await call<any>(`get_${item.type}`, {
        ...identity,
        locale: item.locale,
        ...(item.publish ? { status: "published" } : {}),
      })
    ).data
    const alreadyConnected = Object.entries<any>(item.deferred).every(
      ([field, value]) => {
        const expected = value?.set ?? (value ? [value] : [])
        const actual = Array.isArray(current[field])
          ? current[field]
          : current[field]
            ? [current[field]]
            : []

        return (
          expected.length === actual.length &&
          expected.every((ref: any) =>
            actual.some(
              (row: any) =>
                row.documentId === ref.documentId && row.locale === item.locale
            )
          )
        )
      }
    )
    if (alreadyConnected) continue
    const required = Object.fromEntries(
      ["title", "name", "slug"]
        .filter((field) => item.data[field] !== undefined)
        .map((field) => [field, item.data[field]])
    )
    await call(item.tool, {
      ...identity,
      locale: item.locale,
      data: { ...required, ...item.deferred },
    })
    if (item.publish)
      await call(`publish_${item.type}`, { ...identity, locale: item.locale })
    const written = (
      await call<any>(`get_${item.type}`, {
        ...identity,
        locale: item.locale,
        ...(item.publish ? { status: "published" } : {}),
      })
    ).data
    for (const [field, value] of Object.entries<any>(item.deferred)) {
      const expected = value?.set ?? (value ? [value] : [])
      const actual = Array.isArray(written[field])
        ? written[field]
        : written[field]
          ? [written[field]]
          : []
      if (
        expected.length !== actual.length ||
        expected.some(
          (ref: any) =>
            !actual.some(
              (row: any) =>
                row.documentId === ref.documentId && row.locale === item.locale
            )
        )
      )
        throw new Error(
          `Relation mismatch: ${item.type}.${field}/${item.locale}`
        )
    }
  }
  console.log(
    JSON.stringify({
      verified: outcomes.filter((item) => item.status === "verified").length,
      preserved: outcomes.filter((item) => item.status !== "verified").length,
    })
  )
}
const schemaRelation = (field: string) =>
  [
    "section",
    "category",
    "authorProfile",
    "topics",
    "libraries",
    "contributors",
    "sections",
  ].includes(field)
main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
