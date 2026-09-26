/**
 * Authenticated Strapi REST API client for libraries.global data operations.
 *
 * Usage:
 *   const strapi = new StrapiClient()
 *   const europeId = await strapi.findOrCreateContinent("Europe", "europe", "EU")
 *   const englandId = await strapi.findOrCreateCountry("England", "england", europeId)
 *   const lib = await strapi.createLibrary({ name: "...", ... })
 *
 * Env: STRAPI_URL, STRAPI_API_TOKEN
 */

const STRAPI_URL = process.env.STRAPI_URL ?? "http://127.0.0.1:1337"
const STRAPI_API_TOKEN = process.env.STRAPI_API_TOKEN ?? ""

if (!STRAPI_API_TOKEN) {
  console.error(
    "STRAPI_API_TOKEN is not set. Export it before running scripts."
  )
  process.exit(1)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StrapiEntity {
  id: number
  documentId: string
  [key: string]: unknown
}

export interface StrapiListResponse<T> {
  data: T[]
  meta: {
    pagination: {
      page: number
      pageSize: number
      pageCount: number
      total: number
    }
  }
}

export interface ContinentCreateData {
  name: string
  slug?: string
  code?: string
}

export interface CountryCreateData {
  name: string
  slug?: string
  iso2?: string
  iso3?: string
  shortName?: string
  regionTypeLabel?: string
  continent?: { connect: { documentId: string }[] }
}

export interface RegionCreateData {
  name: string
  slug?: string
  typeLabel?: string
  boundaryUrl?: string
  continent?: { connect: { documentId: string }[] }
  country?: { connect: { documentId: string }[] }
}

export interface AreaCreateData {
  name: string
  slug?: string
  typeLabel?: string
  region?: { connect: { documentId: string }[] }
  country?: { connect: { documentId: string }[] }
}

export interface IconHubData {
  width: number
  height: number
  iconData: string
  iconName: string
  isSvgEditable: boolean
  isIconNameEditable: boolean
}

export interface ServiceCreateData {
  name: string
  summary?: string
  category?:
    | "Access"
    | "Learning"
    | "Research"
    | "Digital"
    | "Community"
    | "Family"
    | "Business"
    | "Culture"
    | "Archives"
    | "Other"
  icon?: IconHubData
  featured?: boolean
}

export interface AmenityCreateData {
  name: string
  summary?: string
  category?:
    | "Building"
    | "Workspace"
    | "Technology"
    | "Family"
    | "Food and Drink"
    | "Travel"
    | "Comfort"
    | "Access"
    | "Other"
  icon?: IconHubData
  featured?: boolean
}

export interface LibraryCreateData {
  name: string
  libraryType: string
  operationalStatus?: string
  operatorType?: string
  slug?: string
  timezone?: string
  shortName?: string
  summary?: string
  phone?: string
  email?: string
  website?: string
  streetAddress?: string
  city?: string
  district?: string
  postalCode?: string
  location?: { lat: number; lng: number }
  openingTimes?: Record<string, unknown>
  openedYear?: string
  closedYear?: string
  foundedYear?: string
  catalogueUrl?: string
  membershipUrl?: string
  bookingUrl?: string
  planVisitUrl?: string
  virtualTourUrl?: string
  virtualTourEmbed?: string
  architect?: string
  buildingInfo?: string
  languagesServed?: string
  classificationSystem?: string
  iiifEndpoint?: string
  source?: string
  sourceUrl?: string
  featured?: boolean
  contentUpdatedAt?: string
  socialLinks?: { platform: string; label?: string; url: string }[]
  country?: { connect: { documentId: string }[] }
  region?: { connect: { documentId: string }[] }
  area?: { connect: { documentId: string }[] }
  continent?: { connect: { documentId: string }[] }
  accessibility?: { connect: { documentId: string }[] }
  services?: { connect: { documentId: string }[] }
  amenities?: { connect: { documentId: string }[] }
}

// ── Client ────────────────────────────────────────────────────────────────────

export class StrapiClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>

  // Geography caches (slug-keyed for findOrCreate)
  private continentCache = new Map<string, string>() // slug → documentId
  private countryBySlugCache = new Map<string, string>() // slug → documentId
  private regionBySlugCache = new Map<string, string>() // countryDocId:slug → documentId
  private areaBySlugCache = new Map<string, string>() // regionDocId:slug → documentId

  // Legacy ISO2-keyed caches (kept for non-LibraryOn use cases)
  private countryCache = new Map<string, string>()
  private regionCache = new Map<string, string>()

  // Relation caches
  private serviceCache = new Map<string, string>()
  private amenityCache = new Map<string, string>()
  private accessibilityCache = new Map<string, string>()

  constructor() {
    this.baseUrl = `${STRAPI_URL}/api`
    this.headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_API_TOKEN}`,
    }
  }

  // ── Generic REST ────────────────────────────────────────────────────────────

  async get<T = unknown>(
    path: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), { headers: this.headers })
    if (!res.ok)
      throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)

    return res.json() as Promise<T>
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok)
      throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`)

    return res.json() as Promise<T>
  }

  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "PUT",
      headers: this.headers,
      body: JSON.stringify(body),
    })
    if (!res.ok)
      throw new Error(`PUT ${path} → ${res.status}: ${await res.text()}`)

    return res.json() as Promise<T>
  }

  // ── Pagination helper ───────────────────────────────────────────────────────

  async findAll<T extends StrapiEntity>(
    contentType: string,
    options: {
      filters?: Record<string, unknown>
      fields?: string[]
      populate?: string[]
      status?: "published" | "draft"
    } = {}
  ): Promise<T[]> {
    const results: T[] = []
    let page = 1
    const pageSize = 100

    while (true) {
      const params: Record<string, string> = {
        "pagination[page]": String(page),
        "pagination[pageSize]": String(pageSize),
        status: options.status ?? "published",
      }
      if (options.fields)
        options.fields.forEach((f, i) => {
          params[`fields[${i}]`] = f
        })
      if (options.populate)
        options.populate.forEach((p, i) => {
          params[`populate[${i}]`] = p
        })
      if (options.filters) {
        const flat = flattenFilters(options.filters)
        Object.assign(params, flat)
      }

      const res = await this.get<StrapiListResponse<T>>(
        `/${contentType}`,
        params
      )
      results.push(...res.data)
      if (page >= res.meta.pagination.pageCount) break
      page++
    }

    return results
  }

  // ── Geography: findOrCreate ─────────────────────────────────────────────────

  async findOrCreateContinent(
    name: string,
    slug: string,
    code?: string
  ): Promise<string> {
    if (this.continentCache.has(slug)) return this.continentCache.get(slug)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>(
      "/continents",
      {
        "filters[slug][$eq]": slug,
        "fields[0]": "documentId",
        "pagination[limit]": "1",
        status: "draft",
      }
    )

    if (res.data[0]?.documentId) {
      const docId = res.data[0].documentId
      this.continentCache.set(slug, docId)

      return docId
    }

    const created = await this.post<{ data: StrapiEntity }>(
      "/continents?status=draft",
      {
        data: { name, slug, ...(code ? { code } : {}) },
      }
    )
    const docId = created.data.documentId
    this.continentCache.set(slug, docId)
    console.log(`[GEO]  Created continent: ${name} → ${docId}`)

    return docId
  }

  async findOrCreateCountry(
    name: string,
    slug: string,
    continentDocId: string,
    extra: Partial<Omit<CountryCreateData, "name" | "slug" | "continent">> = {}
  ): Promise<string> {
    if (this.countryBySlugCache.has(slug))
      return this.countryBySlugCache.get(slug)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>("/countries", {
      "filters[slug][$eq]": slug,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
      status: "draft",
    })

    if (res.data[0]?.documentId) {
      const docId = res.data[0].documentId
      this.countryBySlugCache.set(slug, docId)

      return docId
    }

    const created = await this.post<{ data: StrapiEntity }>(
      "/countries?status=draft",
      {
        data: {
          name,
          slug,
          continent: { connect: [{ documentId: continentDocId }] },
          ...extra,
        },
      }
    )
    const docId = created.data.documentId
    this.countryBySlugCache.set(slug, docId)
    console.log(`[GEO]  Created country: ${name} → ${docId}`)

    return docId
  }

  async findOrCreateRegion(
    name: string,
    slug: string,
    countryDocId: string,
    continentDocId: string,
    extra: Partial<
      Omit<RegionCreateData, "name" | "slug" | "country" | "continent">
    > = {}
  ): Promise<string> {
    const cacheKey = `${countryDocId}:${slug}`
    if (this.regionBySlugCache.has(cacheKey))
      return this.regionBySlugCache.get(cacheKey)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>("/regions", {
      "filters[slug][$eq]": slug,
      "filters[country][documentId][$eq]": countryDocId,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
      status: "draft",
    })

    if (res.data[0]?.documentId) {
      const docId = res.data[0].documentId
      this.regionBySlugCache.set(cacheKey, docId)

      return docId
    }

    const created = await this.post<{ data: StrapiEntity }>(
      "/regions?status=draft",
      {
        data: {
          name,
          slug,
          country: { connect: [{ documentId: countryDocId }] },
          continent: { connect: [{ documentId: continentDocId }] },
          ...extra,
        },
      }
    )
    const docId = created.data.documentId
    this.regionBySlugCache.set(cacheKey, docId)
    console.log(`[GEO]  Created region: ${name} → ${docId}`)

    return docId
  }

  async findOrCreateArea(
    name: string,
    slug: string,
    regionDocId: string,
    countryDocId: string,
    extra: Partial<
      Omit<AreaCreateData, "name" | "slug" | "region" | "country">
    > = {}
  ): Promise<string> {
    const cacheKey = `${regionDocId}:${slug}`
    if (this.areaBySlugCache.has(cacheKey))
      return this.areaBySlugCache.get(cacheKey)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>("/areas", {
      "filters[slug][$eq]": slug,
      "filters[region][documentId][$eq]": regionDocId,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
      status: "draft",
    })

    if (res.data[0]?.documentId) {
      const docId = res.data[0].documentId
      this.areaBySlugCache.set(cacheKey, docId)

      return docId
    }

    const created = await this.post<{ data: StrapiEntity }>(
      "/areas?status=draft",
      {
        data: {
          name,
          slug,
          region: { connect: [{ documentId: regionDocId }] },
          country: { connect: [{ documentId: countryDocId }] },
          ...extra,
        },
      }
    )
    const docId = created.data.documentId
    this.areaBySlugCache.set(cacheKey, docId)
    console.log(`[GEO]  Created area: ${name} → ${docId}`)

    return docId
  }

  // ── Services & amenities: findOrCreate ─────────────────────────────────────

  async findOrCreateService(
    name: string,
    extra: Partial<ServiceCreateData> = {}
  ): Promise<string> {
    const key = name.toLowerCase()
    if (this.serviceCache.has(key)) return this.serviceCache.get(key)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>("/services", {
      "filters[name][$eqi]": name,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
      status: "draft",
    })
    if (res.data[0]?.documentId) {
      const docId = res.data[0].documentId
      this.serviceCache.set(key, docId)

      return docId
    }

    const created = await this.post<{ data: StrapiEntity }>(
      "/services?status=draft",
      {
        data: { name, ...extra },
      }
    )
    const docId = created.data.documentId
    this.serviceCache.set(key, docId)
    console.log(`[REL]  Created service: ${name} → ${docId}`)

    return docId
  }

  async findOrCreateAmenity(
    name: string,
    extra: Partial<AmenityCreateData> = {}
  ): Promise<string> {
    const key = name.toLowerCase()
    if (this.amenityCache.has(key)) return this.amenityCache.get(key)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>("/amenities", {
      "filters[name][$eqi]": name,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
      status: "draft",
    })
    if (res.data[0]?.documentId) {
      const docId = res.data[0].documentId
      this.amenityCache.set(key, docId)

      return docId
    }

    const created = await this.post<{ data: StrapiEntity }>(
      "/amenities?status=draft",
      {
        data: { name, ...extra },
      }
    )
    const docId = created.data.documentId
    this.amenityCache.set(key, docId)
    console.log(`[REL]  Created amenity: ${name} → ${docId}`)

    return docId
  }

  // ── Library operations ──────────────────────────────────────────────────────

  async createLibrary(data: LibraryCreateData): Promise<StrapiEntity> {
    const res = await this.post<{ data: StrapiEntity }>(
      "/libraries?status=draft",
      { data }
    )

    return res.data
  }

  async updateLibrary(
    documentId: string,
    data: Partial<LibraryCreateData>
  ): Promise<StrapiEntity> {
    const res = await this.put<{ data: StrapiEntity }>(
      `/libraries/${documentId}`,
      { data }
    )

    return res.data
  }

  async libraryExistsBySlug(slug: string): Promise<string | null> {
    const res = await this.get<StrapiListResponse<StrapiEntity>>("/libraries", {
      "filters[slug][$eq]": slug,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
      status: "draft",
    })

    return res.data[0]?.documentId ?? null
  }

  async libraryExistsByEntityRef(entityRef: string): Promise<string | null> {
    const res = await this.get<StrapiListResponse<StrapiEntity>>("/libraries", {
      "filters[entityRef][$eq]": entityRef,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
      status: "draft",
    })

    return res.data[0]?.documentId ?? null
  }

  // ── Legacy geography lookups ────────────────────────────────────────────────

  async findCountryByISO2(iso2: string): Promise<string | null> {
    const key = iso2.toUpperCase()
    if (this.countryCache.has(key)) return this.countryCache.get(key)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>("/countries", {
      "filters[iso2][$eqi]": key,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
    })
    const docId = res.data[0]?.documentId ?? null
    if (docId) this.countryCache.set(key, docId)

    return docId
  }

  async findCountryByName(name: string): Promise<string | null> {
    const key = name.toLowerCase()
    if (this.countryCache.has(key)) return this.countryCache.get(key)!

    const res = await this.get<StrapiListResponse<StrapiEntity>>("/countries", {
      "filters[name][$containsi]": name,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
    })
    const docId = res.data[0]?.documentId ?? null
    if (docId) this.countryCache.set(key, docId)

    return docId
  }

  async findRegionByName(
    name: string,
    countryDocumentId?: string
  ): Promise<string | null> {
    const key = `${countryDocumentId ?? ""}:${name.toLowerCase()}`
    if (this.regionCache.has(key)) return this.regionCache.get(key)!

    const params: Record<string, string> = {
      "filters[name][$containsi]": name,
      "fields[0]": "documentId",
      "pagination[limit]": "1",
    }
    if (countryDocumentId)
      params["filters[country][documentId][$eq]"] = countryDocumentId

    const res = await this.get<StrapiListResponse<StrapiEntity>>(
      "/regions",
      params
    )
    const docId = res.data[0]?.documentId ?? null
    if (docId) this.regionCache.set(key, docId)

    return docId
  }

  // ── Patch helpers ──────────────────────────────────────────────────────────

  async updateCountry(
    documentId: string,
    data: Partial<CountryCreateData> & { boundaryUrl?: string }
  ): Promise<void> {
    await this.put(`/countries/${documentId}`, { data })
  }

  async updateRegion(
    documentId: string,
    data: Partial<RegionCreateData>
  ): Promise<void> {
    await this.put(`/regions/${documentId}`, { data })
  }

  // Find a country documentId by slug (returns null if not found)
  async findCountryBySlug(
    slug: string
  ): Promise<{ documentId: string; name: string } | null> {
    if (this.countryBySlugCache.has(slug)) {
      return { documentId: this.countryBySlugCache.get(slug)!, name: slug }
    }
    const res = await this.get<
      StrapiListResponse<StrapiEntity & { name: string }>
    >("/countries", {
      "filters[slug][$eq]": slug,
      "fields[0]": "documentId",
      "fields[1]": "name",
      "pagination[limit]": "1",
      status: "draft",
    })
    if (!res.data[0]) return null
    this.countryBySlugCache.set(slug, res.data[0].documentId)

    return {
      documentId: res.data[0].documentId,
      name: String(res.data[0].name),
    }
  }

  // ── Preload relation caches ─────────────────────────────────────────────────

  async preloadRelations(): Promise<void> {
    console.log("Preloading relation caches...")

    // Sequential to avoid connection pool exhaustion on startup
    const services = await this.findAll("services", {
      fields: ["documentId", "name"],
    })
    const amenities = await this.findAll("amenities", {
      fields: ["documentId", "name"],
    })
    const accessibilities = await this.findAll("accessibility-features", {
      fields: ["documentId", "name"],
    })

    for (const s of services)
      this.serviceCache.set(String(s.name).toLowerCase(), s.documentId)
    for (const a of amenities)
      this.amenityCache.set(String(a.name).toLowerCase(), a.documentId)
    for (const a of accessibilities)
      this.accessibilityCache.set(String(a.name).toLowerCase(), a.documentId)

    console.log(
      `Cached: ${services.length} services, ${amenities.length} amenities, ${accessibilities.length} accessibility entries`
    )
  }

  lookupAccessibility(name: string): string | null {
    return this.accessibilityCache.get(name.toLowerCase()) ?? null
  }
}

// ── Icon helper ───────────────────────────────────────────────────────────────

/**
 * Fetch MDI icon data from the Iconify API for use with Strapi's iconhub field.
 * iconName: "mdi:wifi" or just "wifi"
 *
 * Example:
 *   const icon = await fetchMdiIcon("mdi:wifi")
 *   await strapi.findOrCreateAmenity("Wi-Fi", { category: "Technology", icon })
 */
export async function fetchMdiIcon(
  iconName: string
): Promise<IconHubData | null> {
  const name = iconName.replace(/^mdi:/, "")
  try {
    const res = await fetch(`https://api.iconify.design/mdi/${name}.json`)
    if (!res.ok) return null
    const data = (await res.json()) as {
      body?: string
      width?: number
      height?: number
    }
    if (!data.body) return null

    return {
      width: data.width ?? 24,
      height: data.height ?? 24,
      iconData: data.body,
      iconName: `mdi:${name}`,
      isSvgEditable: false,
      isIconNameEditable: false,
    }
  } catch {
    return null
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenFilters(
  filters: Record<string, unknown>,
  prefix = "filters"
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) {
    const key = `${prefix}[${k}]`
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      Object.assign(result, flattenFilters(v as Record<string, unknown>, key))
    } else {
      result[key] = String(v)
    }
  }

  return result
}
