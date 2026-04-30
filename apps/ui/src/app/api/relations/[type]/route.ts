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
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params
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
  const url = `${STRAPI}/api/${strapiPlural}?sort=name:asc&pagination[limit]=${limit}&status=published&fields[0]=name&fields[1]=documentId${filterParam}`

  const res = await fetch(url, {
    headers: {
      ...(SECRET ? { "X-Service-Secret": SECRET } : {}),
    },
    next: { revalidate: 3600 },
  })

  if (!res.ok) return NextResponse.json({ data: [] }, { status: 200 })
  const json = await res.json()

  return NextResponse.json({ data: json.data ?? [] })
}
