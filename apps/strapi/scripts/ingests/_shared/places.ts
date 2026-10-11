import { nameKey, type SourcePlace } from "./geography"
import type { StrapiClient, StrapiEntity } from "../../strapi-client"

export interface PlaceOptions {
  attribution: string
  countries: Record<string, { iso3: string; regionType?: string }>
  exclude?: (place: StrapiEntity, source: SourcePlace) => boolean
}

const COLLECTION = { country: "countries", region: "regions", area: "areas" }

export interface PlaceAction {
  source: SourcePlace
  existing?: StrapiEntity
  slug: string
}

export interface PlacePlan {
  actions: PlaceAction[]
  continent?: StrapiEntity
  legacy: { collection: string; documentId: string; name: string }[]
}

/** A country is planned in full before writes, including global slug conflicts. */
export async function planPlaces(
  client: StrapiClient,
  sources: SourcePlace[],
  reportingCodes: Map<string, string>,
  options: PlaceOptions
): Promise<PlacePlan> {
  const continents = await client.findAll("continents", {
    filters: { slug: { $eq: "europe" } },
    status: "draft",
  })
  if (continents.length > 1)
    throw new Error("Europe matches multiple continents")
  const countries = Object.keys(options.countries)
  const existing: Record<string, StrapiEntity[]> = {}
  for (const level of ["country", "region", "area"] as const) {
    existing[level] = await client.findAll(COLLECTION[level], {
      filters:
        level === "country"
          ? { iso2: { $in: countries } }
          : { country: { iso2: { $in: countries } } },
      populate:
        level === "country"
          ? ["continent"]
          : level === "region"
            ? ["country"]
            : ["country", "region"],
      status: "draft",
    })
    for (const place of existing[level])
      place.populationReportingCode =
        reportingCodes.get(place.documentId) ?? place.populationReportingCode
  }
  const actions: PlaceAction[] = []
  const used = new Set<string>()
  for (const source of sources) {
    const parent = actions.find((action) => action.source.key === source.parent)
    const country = actions.find(
      (action) => action.source.key === source.country
    )
    const candidates = existing[source.level].filter((place) => {
      if (used.has(place.documentId)) return false
      if (source.level === "country") return place.iso2 === source.country
      if (
        !country?.existing ||
        (place.country as any)?.documentId !== country.existing.documentId
      )
        return false
      if (
        source.level === "area" &&
        (!parent?.existing ||
          (place.region as any)?.documentId !== parent.existing.documentId)
      )
        return false
      if (options.exclude?.(place, source)) return false

      return true
    })
    const coded = candidates.filter(
      (place) => place.populationReportingCode === source.code
    )
    const named = candidates.filter((place) =>
      source.names.some((name) => nameKey(name) === nameKey(String(place.name)))
    )
    const hits =
      source.level === "country" ? candidates : coded.length ? coded : named
    if (hits.length > 1)
      throw new Error(`Ambiguous ${source.key}: ${hits.length} existing places`)
    const match = hits[0]
    if (
      match &&
      source.level === "country" &&
      continents[0] &&
      (match.continent as any)?.documentId !== continents[0].documentId
    )
      throw new Error(`${source.country} is not under Europe`)
    if (match) used.add(match.documentId)
    actions.push({
      source,
      existing: match,
      slug: match ? String(match.slug) : source.slug,
    })
  }
  for (const level of ["country", "region", "area"] as const) {
    const creates = actions.filter(
      (action) => action.source.level === level && !action.existing
    )
    for (let offset = 0; offset < creates.length; offset += 100) {
      const batch = creates.slice(offset, offset + 100)
      const clashes = await client.findAll(COLLECTION[level], {
        filters: { slug: { $in: batch.map((action) => action.slug) } },
        fields: ["slug"],
        status: "draft",
      })
      if (clashes.length)
        throw new Error(
          `Place slug already in use: ${clashes.map((place) => place.slug).join(", ")}`
        )
    }
  }
  const legacy = ["region", "area"].flatMap((level) =>
    existing[level]
      .filter((place) => !used.has(place.documentId))
      .map((place) => ({
        collection: COLLECTION[level],
        documentId: place.documentId,
        name: String(place.name),
      }))
  )

  return { actions, continent: continents[0], legacy }
}

export async function applyPlaces(
  client: StrapiClient,
  plan: PlacePlan,
  checkpoint: (action: PlaceAction, documentId: string) => void,
  options: PlaceOptions
) {
  const ids = new Map<string, string>()
  const continentId =
    plan.continent?.documentId ??
    (await client.findOrCreateContinent("Europe", "europe", "eu"))
  const connect = (documentId: string) => ({ connect: [{ documentId }] })
  for (const action of plan.actions) {
    const source = action.source
    let documentId = action.existing?.documentId
    if (!documentId) {
      const data: Record<string, unknown> = {
        name: source.name,
        slug: action.slug,
        sourceAttribution: options.attribution,
        populationReportingCode: source.code,
      }
      if (source.level === "country")
        Object.assign(data, {
          iso2: source.country,
          iso3: options.countries[source.country].iso3,
          regionTypeLabel:
            options.countries[source.country].regionType ?? "Region",
          regionsSectionLabel:
            (options.countries[source.country].regionType ?? "Region") ===
            "County"
              ? "Counties"
              : "Regions",
          areaTypeLabel: "Municipality",
          areasSectionLabel: "Municipalities",
          continent: connect(continentId),
        })
      else
        Object.assign(data, {
          country: connect(ids.get(source.country)!),
          typeLabel:
            source.typeLabel ??
            (source.level === "region"
              ? (options.countries[source.country].regionType ?? "Region")
              : "Municipality"),
          ...(source.level === "region"
            ? { continent: connect(continentId) }
            : { region: connect(ids.get(source.parent!)!) }),
        })
      // Do not retry a create blindly: a lost response may have committed. A re-run reconciles by reporting code.
      const response = await client.post<{ data: StrapiEntity }>(
        `/${COLLECTION[source.level]}?status=draft`,
        { data }
      )
      documentId = response.data.documentId
    }
    ids.set(source.key, documentId)
    checkpoint(action, documentId)
  }

  return { ids, continentId }
}
