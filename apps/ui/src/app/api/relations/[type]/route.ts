import { NextResponse } from "next/server"

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
  if (type === "topics") return approvedTopics()
  if (type === "locales") return locales()
  const strapiPlural = TYPE_MAP[type]
  if (!strapiPlural)
    return NextResponse.json({ error: "Not found" }, { status: 404 })

  const searchParams = new URL(req.url).searchParams
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

  const limit = type === "countries" ? 300 : 500
  const status = type === "blog-sections" ? "" : "&status=published"
  const extraFields = type === "blog-sections" ? "&fields[2]=slug" : ""
  const url = `${STRAPI}/api/${strapiPlural}?sort=name:asc&pagination[limit]=${limit}${status}&fields[0]=name&fields[1]=documentId${extraFields}${filterParam}`

  // Regions and areas gain entries when a Location Request is approved, so
  // they refresh within a minute; the other lists change rarely.
  const revalidate = type === "regions" || type === "areas" ? 60 : 3600
  const res = await fetch(url, {
    headers: {
      ...(SECRET ? { "X-Service-Secret": SECRET } : {}),
    },
    next: { revalidate },
  })

  if (!res.ok) return NextResponse.json({ data: [] }, { status: 200 })
  const json = await res.json()

  return NextResponse.json({ data: json.data ?? [] })
}
