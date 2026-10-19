import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"
import { NextResponse } from "next/server"

import { strapiServiceHeaders } from "@/lib/bridge-user-headers"
import { fetchContentLocales as configuredLocales } from "@/lib/content-locales-server"
import { cacheTagsFor } from "@/lib/strapi-api/cache-tags"
import { createStrapiAuthHeader } from "@/lib/strapi-api/request-auth"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const relationHeaders = async () => ({
  ...strapiServiceHeaders(),
  ...(await createStrapiAuthHeader({ isReadOnly: true, isPrivate: false })),
})

// Map wizard keys → Strapi plural API names
const TYPE_MAP: Record<string, string> = {
  services: "services",
  "library-types": "library-types",
  amenities: "amenities",
  accessibility: "accessibility-features",
  continents: "continents",
  countries: "countries",
  regions: "regions",
  areas: "areas",
  "blog-sections": "blog-sections",
  "wiki-sections": "wiki-sections",
}

/** Section lists: no draft state, carry a slug, and Wiki Sections keep their own order. */
const SECTION_TYPES = new Set(["blog-sections", "wiki-sections"])
const COUNTRY_LABELS = [
  "regionTypeLabel",
  "regionsSectionLabel",
  "areaTypeLabel",
  "areasSectionLabel",
]
const REGION_LABELS = ["areaTypeLabel", "areasSectionLabel"]
const FALLBACK_TYPES = new Set([
  "continents",
  "countries",
  "regions",
  "areas",
  ...SECTION_TYPES,
])
const PAGE_SIZE = 100 // Strapi REST maxLimit; larger requests are silently clamped.
const MAX_VARIANTS = 10_000
type Choice = {
  documentId: string
  name: string
  locale?: string
  slug?: string
  order?: number | null
  [key: string]: unknown
}

/** Complete, bounded public aggregation, including when the CMS clamps its page size. */
async function choiceRows(
  url: string,
  maximumDocuments: number,
  revalidate: number,
  tags: string[]
): Promise<Choice[] | null> {
  const headers = await relationHeaders()
  const rows: Choice[] = []
  const documents = new Set<string>()
  let start = 0
  for (;;) {
    const pageUrl = new URL(url)
    pageUrl.searchParams.set("pagination[limit]", String(PAGE_SIZE))
    pageUrl.searchParams.set("pagination[start]", String(start))
    let json: { data?: Choice[]; meta?: { pagination?: { total?: number } } }
    try {
      const response = await fetch(pageUrl.toString(), {
        headers,
        next: { revalidate, tags },
      })
      if (!response.ok) return null
      json = await response.json()
    } catch {
      return null
    }
    if (!Array.isArray(json.data)) return null
    const total = json.meta?.pagination?.total
    if (
      total !== undefined &&
      (!Number.isSafeInteger(total) ||
        total < start + json.data.length ||
        total > MAX_VARIANTS)
    )
      return null
    if (rows.length + json.data.length > MAX_VARIANTS) return null
    for (const row of json.data) {
      if (
        !row ||
        typeof row.documentId !== "string" ||
        typeof row.name !== "string"
      )
        return null
      documents.add(row.documentId)
      if (documents.size > maximumDocuments) return null
      rows.push(row)
    }
    start += json.data.length
    if (total !== undefined ? start >= total : json.data.length < PAGE_SIZE)
      return rows
    if (!json.data.length || start >= MAX_VARIANTS) return null
  }
}

/** One row per document; a partial translation cannot remove another public document. */
function localizedChoices(
  rows: Choice[],
  locale: string,
  defaultLocale: string,
  fields: string[],
  preserveOrder = false
): Choice[] {
  const variants = new Map<string, Choice[]>()
  for (const row of rows)
    variants.set(row.documentId, [...(variants.get(row.documentId) ?? []), row])
  const rank = (row: Choice) =>
    (row.locale ?? DEFAULT_LOCALE) === locale
      ? 0
      : (row.locale ?? DEFAULT_LOCALE) === defaultLocale
        ? 1
        : 2
  const selected = [...variants.values()].map((values) => {
    values.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        String(a.locale ?? DEFAULT_LOCALE).localeCompare(
          String(b.locale ?? DEFAULT_LOCALE)
        ) ||
        a.name.localeCompare(b.name)
    )
    const preferred = values[0]!
    // Regional terminology and ISO ancestry must remain useful if a translation omits them.
    const selected = Object.fromEntries(
      fields.flatMap((field) => {
        const value = [preferred, ...values].find(
          (row) =>
            row[field] !== undefined && row[field] !== null && row[field] !== ""
        )?.[field]

        return value !== undefined
          ? [[field, value]]
          : field in preferred
            ? [[field, preferred[field]]]
            : []
      })
    ) as Choice

    return selected
  })
  const order = (row: Choice) =>
    typeof row.order === "number" && Number.isFinite(row.order)
      ? row.order
      : Infinity

  return selected.sort(
    (a, b) =>
      (preserveOrder ? order(a) - order(b) : 0) ||
      a.name.localeCompare(b.name, locale) ||
      a.documentId.localeCompare(b.documentId)
  )
}

/** Parent membership is identified from any public variant, then translated display rows are expanded. */
async function expandPlaceVariants(
  url: string,
  rows: Choice[],
  maximumDocuments: number,
  revalidate: number,
  tags: string[]
): Promise<Choice[] | null> {
  const ids = [...new Set(rows.map((row) => row.documentId))]
  if (!ids.length) return rows
  const expanded: Choice[] = []
  for (let offset = 0; offset < ids.length; offset += PAGE_SIZE) {
    const query = new URL(url)
    for (const key of query.searchParams.keys())
      if (key.startsWith("filters[")) query.searchParams.delete(key)
    const pageIds = ids.slice(offset, offset + PAGE_SIZE)
    const selectedIds = new Set(pageIds)
    pageIds.forEach((id, index) =>
      query.searchParams.set(`filters[documentId][$in][${index}]`, id)
    )
    const values = await choiceRows(
      query.toString(),
      maximumDocuments,
      revalidate,
      tags
    )
    if (
      !values ||
      values.some((row) => !selectedIds.has(row.documentId)) ||
      expanded.length + values.length > MAX_VARIANTS
    )
      return null
    expanded.push(...values)
  }

  return expanded
}

/** Curated, approved topics from the topics plugin (its own route shape). */
async function approvedTopics(locale: string) {
  const res = await fetch(`${STRAPI}/api/topics/approved?locale=${locale}`, {
    headers: strapiServiceHeaders(),
    next: { revalidate: 300, tags: cacheTagsFor("/topics", {}) },
  })
  if (!res.ok) return NextResponse.json({ data: [] })
  const json = (await res.json()) as {
    data?: { documentId?: string; name?: string; slug?: string }[]
  }

  return NextResponse.json({
    data: (json.data ?? [])
      .filter((t) => t.name && t.slug)
      .map((t) => ({ documentId: t.documentId, name: t.name, slug: t.slug })),
  })
}

async function locales() {
  return NextResponse.json({ data: (await configuredLocales()) ?? [] })
}

const ISO_CODE = /^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/

type CountryRow = {
  documentId: string
  name: string
  iso2?: string | null
  continent?: { documentId?: string } | null
  regionTypeLabel?: string | null
  regionsSectionLabel?: string | null
  areaTypeLabel?: string | null
  areasSectionLabel?: string | null
}

/**
 * Atlas countries by ISO code (`?iso2=GB-ENG,GB`), in the order asked, for
 * the location lookup. The UK's countries are filed by ISO 3166-2 code.
 */
async function countriesByCode(raw: string, locale: string) {
  const codes = raw
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => ISO_CODE.test(code))
    .slice(0, 3)
  if (codes.length === 0) return NextResponse.json({ data: [] })

  const filters = codes
    .map((code, i) => `filters[iso2][$in][${i}]=${encodeURIComponent(code)}`)
    .join("&")
  const values = await choiceRows(
    `${STRAPI}/api/countries?${filters}&status=published&locale=*&fields[0]=name&fields[1]=iso2&fields[2]=locale&${COUNTRY_LABELS.map((field, index) => `fields[${index + 3}]=${field}`).join("&")}&populate[continent][fields][0]=name&sort[0]=documentId:asc&sort[1]=locale:asc`,
    codes.length,
    3600,
    cacheTagsFor("/countries", {})
  )
  if (!values) return NextResponse.json({ data: [] }, { status: 503 })
  const configured = await configuredLocales()
  const base =
    configured?.find((entry) => entry.isDefault)?.code ?? DEFAULT_LOCALE
  const rows = localizedChoices(values, locale, base, [
    "documentId",
    "name",
    "iso2",
    "continent",
    ...COUNTRY_LABELS,
  ]) as CountryRow[]

  return NextResponse.json({
    data: codes.flatMap((code) => {
      const row = rows.find((r) => r.iso2?.toUpperCase() === code)
      const continentDocumentId = row?.continent?.documentId

      return row && continentDocumentId
        ? [
            {
              documentId: row.documentId,
              name: row.name,
              iso2: code,
              continentDocumentId,
              ...Object.fromEntries(
                COUNTRY_LABELS.filter(
                  (field) => row[field as keyof CountryRow] !== undefined
                ).map((field) => [field, row[field as keyof CountryRow]])
              ),
            },
          ]
        : []
    }),
  })
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  const searchParams = new URL(req.url).searchParams
  const requestedLocale = searchParams.get("locale")
  const locale: string = isSupportedLocale(requestedLocale)
    ? requestedLocale
    : DEFAULT_LOCALE
  if (requestedLocale && !isSupportedLocale(requestedLocale))
    return NextResponse.json(
      { data: [], error: "Unsupported language" },
      { status: 400 }
    )
  // The published suggestion catalogue also serves type choices, without broad CMS token permissions.
  if (type === "library-types") {
    try {
      const response = await fetch(
        `${STRAPI}/api/content-moderation/option-catalogue?locale=${encodeURIComponent(locale)}`,
        { headers: strapiServiceHeaders(), cache: "no-store" }
      )
      if (!response.ok) return NextResponse.json({ data: [] }, { status: 503 })
      const json = await response.json()

      return NextResponse.json({
        data: (json.data?.library_types ?? []).map((item: Choice) => ({
          documentId: item.documentId,
          name: item.name,
        })),
      })
    } catch {
      return NextResponse.json({ data: [] }, { status: 503 })
    }
  }
  if (type === "topics") return approvedTopics(locale)
  if (type === "locales") return locales()
  const iso2 = searchParams.get("iso2")
  if (type === "countries" && iso2) return countriesByCode(iso2, locale)
  const strapiPlural = Object.hasOwn(TYPE_MAP, type)
    ? TYPE_MAP[type]
    : undefined
  if (!strapiPlural)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const continentFilter = searchParams.get("continentDocumentId")
  const countryFilter = searchParams.get("countryDocumentId")
  const regionFilter = searchParams.get("regionDocumentId")

  let filterParam = ""
  if (type === "countries" && continentFilter) {
    filterParam = `&filters[continent][documentId][$eq]=${encodeURIComponent(continentFilter)}`
  } else if (type === "regions" && countryFilter) {
    filterParam = `&filters[country][documentId][$eq]=${encodeURIComponent(countryFilter)}`
  } else if (type === "areas" && regionFilter) {
    filterParam = `&filters[region][documentId][$eq]=${encodeURIComponent(regionFilter)}`
  }

  // The largest real parents hold about 850 places (Minas Gerais, Brazil).
  const limit = type === "countries" ? 300 : 1000
  const status = SECTION_TYPES.has(type) ? "" : "&status=published"
  const fields = [
    "name",
    "documentId",
    ...(FALLBACK_TYPES.has(type) ? ["locale"] : []),
    ...(SECTION_TYPES.has(type) ? ["slug"] : []),
    ...(type === "wiki-sections" ? ["order"] : []),
    ...(type === "countries"
      ? COUNTRY_LABELS
      : type === "regions"
        ? REGION_LABELS
        : []),
  ]
  const fieldParams = fields
    .map((field, index) => `fields[${index}]=${field}`)
    .join("&")
  const sort =
    type === "wiki-sections"
      ? "sort[0]=order:asc&sort[1]=name:asc&sort[2]=documentId:asc&sort[3]=locale:asc"
      : FALLBACK_TYPES.has(type)
        ? "sort[0]=name:asc&sort[1]=documentId:asc&sort[2]=locale:asc"
        : "sort=name:asc"
  const url = `${STRAPI}/api/${strapiPlural}?locale=${FALLBACK_TYPES.has(type) ? "*" : locale}&${sort}&pagination[limit]=${limit}${status}&${fieldParams}${filterParam}`

  // The world place import adds Regions and Areas and sets each Country's
  // Place Labels (the wizard's select labels), so those lists refresh within
  // a minute; the other lists change rarely.
  const revalidate = ["countries", "regions", "areas"].includes(type)
    ? 60
    : 3600
  if (FALLBACK_TYPES.has(type)) {
    const tags = cacheTagsFor(`/${strapiPlural}`, {})
    const values = await choiceRows(url, limit, revalidate, tags)
    const rows =
      values && filterParam
        ? await expandPlaceVariants(url, values, limit, revalidate, tags)
        : values
    if (!rows)
      return NextResponse.json(
        {
          data: [],
          error: "Place choices exceed the supported size or are unavailable",
        },
        { status: 503 }
      )
    const configured = await configuredLocales()
    const base =
      configured?.find((entry) => entry.isDefault)?.code ?? DEFAULT_LOCALE

    return NextResponse.json({
      data: localizedChoices(
        rows,
        locale,
        base,
        fields,
        type === "wiki-sections"
      ),
    })
  }
  const res = await fetch(url, {
    headers: await relationHeaders(),
    // Tagged like every Strapi fetch, so the publish webhook purges it.
    next: { revalidate, tags: cacheTagsFor(`/${strapiPlural}`, {}) },
  })

  if (!res.ok)
    return NextResponse.json(
      { data: [], error: "Place choices are unavailable" },
      { status: 503 }
    )
  const json = await res.json()

  return NextResponse.json({ data: json.data ?? [] })
}
