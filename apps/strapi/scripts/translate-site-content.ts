/** Local CMS translations via MCP. Preview by default; --apply writes permitted locales. */
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { StrapiMcpClient } from "./mcp-client"

const TYPES = [
  "homepage",
  "footer",
  "wiki-landing",
  "blog-landing",
  "service",
  "amenity",
  "accessibility",
]
const SINGLES = new Set(TYPES.slice(0, 4))
const TEXT_KEY =
  /^(name|summary|description|text|title|label|heroEyebrow|heroTitle|heroText|contentEyebrow|contentTitle|contentText|contentCtaLabel|copyRight|eyebrow|ctaLabel|primaryLabel|secondaryLabel|metaTitle|metaDescription)$/
type TranslationMap = Record<string, Record<string, string>>

/** CMS components add IDs and metadata; compare the fields we wrote. */
function matches(expected: unknown, actual: unknown): boolean {
  if (Array.isArray(expected))
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((value, index) => matches(value, actual[index]))
    )
  if (expected && typeof expected === "object")
    return (
      !!actual &&
      typeof actual === "object" &&
      Object.entries(expected).every(([key, value]) =>
        matches(value, (actual as Record<string, unknown>)[key])
      )
    )

  return expected === actual
}

function translate(
  value: unknown,
  locale: string,
  dictionary: TranslationMap,
  missing: Set<string>,
  key = ""
): unknown {
  if (typeof value === "string") {
    if (!value.trim() || !TEXT_KEY.test(key)) return value
    if (dictionary[value]?.[locale] !== undefined)
      return dictionary[value]![locale]
    missing.add(value)

    return value
  }
  if (Array.isArray(value))
    return value.map((v) => translate(v, locale, dictionary, missing, key))
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => k !== "id" && v !== null)
        .map(([k, v]) => [k, translate(v, locale, dictionary, missing, k)])
    )

  return value
}

async function main() {
  try {
    process.loadEnvFile(".env")
  } catch {
    /* The operator may supply env. */
  }
  const url = process.env.STRAPI_URL || "http://127.0.0.1:1337"
  if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url))
    throw new Error("This script only writes to the local CMS")
  const apply = process.argv.includes("--apply")
  const client = new StrapiMcpClient(process.env.STRAPI_MCP_TOKEN, `${url}/mcp`)
  await client.initialize()
  const tools = await client.listTools()
  const dictionary = JSON.parse(
    await readFile(path.join(__dirname, "i18n/site-translations.json"), "utf8")
  ) as TranslationMap
  const output = path.resolve(__dirname, "../../../.scratch/i18n-audit")
  await mkdir(output, { recursive: true })
  const plan: any[] = [],
    blocked: any[] = [],
    before: any[] = []
  for (const type of TYPES) {
    const schema = JSON.parse(
      await readFile(
        path.join(
          __dirname,
          `../src/api/${type}/content-types/${type}/schema.json`
        ),
        "utf8"
      )
    )
    const fields = Object.entries(schema.attributes)
      .filter(
        ([key, attribute]: [string, any]) =>
          attribute.pluginOptions?.i18n?.localized === true && key !== "seo"
      )
      .map(([key]) => key)
    const source = SINGLES.has(type)
      ? [
          (
            await client.call<any>(`get_${type}`, {
              locale: "en",
              status: "published",
            })
          ).data,
        ].filter(Boolean)
      : await client.listAll<any>(type, { locale: "en", status: "published" })
    before.push({ type, locale: "en", data: source })
    for (const locale of ["cs", "fr"]) {
      const writeTool = `${SINGLES.has(type) ? "write" : "update"}_${type}`
      const allowed = tools.find((t) => t.name === writeTool)?.inputSchema
        .properties?.locale?.enum
      const permitted = !!allowed?.includes(locale)
      let existing: any[] = []
      if (permitted) {
        existing = SINGLES.has(type)
          ? [(await client.call<any>(`get_${type}`, { locale })).data].filter(
              Boolean
            )
          : await client.listAll<any>(type, { locale })
        before.push({ type, locale, data: existing })
      }
      for (const record of source) {
        const missing = new Set<string>()
        const data = Object.fromEntries(
          fields
            .filter((key) => record[key] != null)
            .map((key) => [
              key,
              translate(record[key], locale, dictionary, missing, key),
            ])
        )
        const item = {
          type,
          locale,
          documentId: record.documentId,
          tool: writeTool,
          data,
          missing: [...missing],
          exists: existing.some((d) => d.documentId === record.documentId),
        }
        plan.push(item)
        if (!permitted)
          blocked.push({ type, locale, reason: "MCP locale permission" })
      }
    }
  }
  // Keep a reviewable plan and a private backup before any write.
  await writeFile(
    path.join(output, "cms-translation-plan.json"),
    JSON.stringify({ plan, blocked }, null, 2),
    { mode: 0o600 }
  )
  await writeFile(
    path.join(output, `cms-before-${Date.now()}.json`),
    JSON.stringify(before),
    { mode: 0o600 }
  )
  const incomplete = plan.filter((item) => item.missing.length)
  if (incomplete.length) {
    console.log(
      JSON.stringify(
        incomplete.map(({ type, locale, missing }) => ({
          type,
          locale,
          missing,
        })),
        null,
        2
      )
    )
    throw new Error("Translations are incomplete; nothing written")
  }
  const outcomes: any[] = []
  const saveResults = () =>
    writeFile(
      path.join(output, "cms-translation-results.json"),
      JSON.stringify(
        {
          apply,
          planned: plan.length,
          blocked: [
            ...new Map(
              blocked.map((b) => [`${b.type}:${b.locale}`, b])
            ).values(),
          ],
          outcomes,
        },
        null,
        2
      ),
      { mode: 0o600 }
    )
  for (const item of plan) {
    if (blocked.some((b) => b.type === item.type && b.locale === item.locale))
      continue
    if (item.exists) {
      outcomes.push({ ...item, status: "existing translation preserved" })
      continue
    }
    if (!apply) continue
    await client.call(item.tool, {
      locale: item.locale,
      data: item.data,
      ...(SINGLES.has(item.type) ? {} : { documentId: item.documentId }),
    })
    const publish = tools.find((t) => t.name === `publish_${item.type}`)
    const identity = SINGLES.has(item.type)
      ? {}
      : { documentId: item.documentId }
    if (publish)
      await client.call(publish.name, { ...identity, locale: item.locale })
    const result = await client.call<any>(`get_${item.type}`, {
      ...identity,
      locale: item.locale,
      ...(publish ? { status: "published" } : {}),
    })
    if (
      !matches(item.data, result.data) ||
      (publish && result.data?.status !== "published")
    )
      throw new Error(
        `Could not verify ${item.type}/${item.documentId}/${item.locale}`
      )
    outcomes.push({
      type: item.type,
      locale: item.locale,
      documentId: item.documentId,
      status: "verified",
    })
    await saveResults()
    console.log(`Verified ${item.type}/${item.documentId}/${item.locale}`)
  }
  await saveResults()
  console.log(
    JSON.stringify({
      apply,
      planned: plan.length,
      permitted: plan.filter(
        (p) => !blocked.some((b) => b.type === p.type && b.locale === p.locale)
      ).length,
      verified: outcomes.filter((o) => o.status === "verified").length,
      blocked: [...new Set(blocked.map((b) => `${b.type}:${b.locale}`))],
    })
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Translation failed")
  process.exitCode = 1
})
