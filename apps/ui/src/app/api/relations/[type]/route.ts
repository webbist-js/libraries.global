import { NextResponse } from "next/server"

import { cacheTagsFor } from "@/lib/strapi-api/cache-tags"

const STRAPI = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const SECRET = process.env.STRAPI_BRIDGE_SECRET

// Map wizard keys → Strapi plural API names
const TYPE_MAP: Record<string, string> = {
  services: "services",
  amenities: "amenities",
  accessibility: "accessibility-features",
  continents: "continents",
  countries: "countries",
  regions: "regions",
  areas: "areas",
  "blog-sections": "blog-sections",
}

/** Curated, approved topics from the topics plugin (its own route shape). */
async function approvedTopics() {
  const res = await fetch(`${STRAPI}/api/topics/approved`, {
    next: { revalidate: 300 },
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

/** Strapi's configured locales, for the article editor's language picker. */
async function locales() {
  const res = await fetch(`${STRAPI}/api/content-moderation/locales`, {
    next: { revalidate: 3600 },
  })
  if (!res.ok) return NextResponse.json({ data: [] })
  const json = (await res.json()) as {
    data?: { code: string; name: string; isDefault: boolean }[]
  }

  return NextResponse.json({ data: json.data ?? [] })
}

const ISO_CODE = /^[A-Z]{2}(?:-[A-Z0-9]{1,3})?$/

type CountryRow = {
  documentId: string
  name: string
  iso2?: string | null
  continent?: { documentId?: string } | null
}

/**
 * Atlas countries by ISO code (`?iso2=GB-ENG,GB`), in the order asked, for
 * the location lookup. The UK's countries are filed by ISO 3166-2 code.
 */
async function countriesByCode(raw: string) {
  const codes = raw
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter((code) => ISO_CODE.test(code))
    .slice(0, 3)
  if (codes.length === 0) return NextResponse.json({ data: [] })

  const filters = codes
    .map((code, i) => `filters[iso2][$in][${i}]=${encodeURIComponent(code)}`)
    .join("&")
  const res = await fetch(
    `${STRAPI}/api/countries?${filters}&status=published&pagination[limit]=${codes.length}&fields[0]=name&fields[1]=iso2&populate[continent][fields][0]=name`,
    {
      headers: { ...(SECRET ? { "X-Service-Secret": SECRET } : {}) },
      next: { revalidate: 3600 },
    }
  )
  if (!res.ok) return NextResponse.json({ data: [] })
  const rows = ((await res.json()) as { data?: CountryRow[] }).data ?? []

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
  if (type === "topics") return approvedTopics()
  if (type === "locales") return locales()
  const searchParams = new URL(req.url).searchParams
  const iso2 = searchParams.get("iso2")
  if (type === "countries" && iso2) return countriesByCode(iso2)
  const strapiPlural = TYPE_MAP[type]
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
  const status = type === "blog-sections" ? "" : "&status=published"
  const extraFields = type === "blog-sections" ? "&fields[2]=slug" : ""
  const url = `${STRAPI}/api/${strapiPlural}?sort=name:asc&pagination[limit]=${limit}${status}&fields[0]=name&fields[1]=documentId${extraFields}${filterParam}`

  // The world place import adds Regions and Areas and sets each Country's
  // Place Labels (the wizard's select labels), so those lists refresh within
  // a minute; the other lists change rarely.
  const revalidate = ["countries", "regions", "areas"].includes(type)
    ? 60
    : 3600
  const res = await fetch(url, {
    headers: {
      ...(SECRET ? { "X-Service-Secret": SECRET } : {}),
    },
    // Tagged like every Strapi fetch, so the publish webhook purges it.
    next: { revalidate, tags: cacheTagsFor(`/${strapiPlural}`, {}) },
  })

  if (!res.ok) return NextResponse.json({ data: [] }, { status: 200 })
  const json = await res.json()

  return NextResponse.json({ data: json.data ?? [] })
}
