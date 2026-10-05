/**
 * Finds each outlet's place in the atlas: its Continent, Country, Region and
 * Area. A Region or Area is found by its slug, then by name (place-match.ts),
 * then by the county the Census geocoder puts the outlet in. Only when
 * writing are missing places created: a US state's Region, or an Area for a
 * county the survey and the geocoder agree on. A territory's Region never is.
 * A point the geocoder puts in another state gets no Area.
 */

import type { StrapiClient } from "../../../strapi-client"
import { matchPlace, placeKey } from "../../_shared/place-match"
import type { CensusCounties } from "../census-county"
import type { MappedOutlet } from "./map"

interface Place {
  documentId: string
  name: string
  slug: string
}

export interface ResolvedPlace {
  continentId: string
  countryId: string
  /** Unset in a dry run when the state's Region would be created. */
  regionId?: string
  areaId?: string
  /** How a Region or Area was found when not by slug, or what would be created. */
  notes: string[]
}

export class PlaceResolver {
  private readonly countries = new Map<
    string,
    { id: string; continentId: string }
  >()

  private readonly lists = new Map<string, Place[]>()

  constructor(
    private readonly strapi: StrapiClient,
    private readonly counties: CensusCounties,
    private readonly write: boolean
  ) {}

  async resolve(o: MappedOutlet): Promise<ResolvedPlace> {
    const notes: string[] = []
    const country = await this.country(o.geo.countrySlug ?? "united-states")
    const regions = await this.list("regions", "country", country.id)

    let region = regions.find((r) => r.slug === o.geo.regionSlug) ?? null
    if (!region && o.geo.countrySlug) {
      region = await this.match(o, o.geo.regionName, regions, "Region", notes)
      if (!region) {
        throw new Error(
          `No Region in ${o.geo.countrySlug} for "${o.geo.regionName}"`
        )
      }
    }
    if (!region) {
      if (!this.write) {
        notes.push(`New Region: ${o.geo.regionName}`)

        return {
          continentId: country.continentId,
          countryId: country.id,
          notes,
        }
      }
      region = this.created(regions, {
        name: o.geo.regionName,
        slug: o.geo.regionSlug,
        documentId: await this.strapi.findOrCreateRegion(
          o.geo.regionName,
          o.geo.regionSlug,
          country.id,
          country.continentId,
          { typeLabel: o.state === "DC" ? "Federal District" : "State" }
        ),
      })
    }

    const place: ResolvedPlace = {
      continentId: country.continentId,
      countryId: country.id,
      regionId: region.documentId,
      notes,
    }
    const { county, areaName, areaSlug, areaTypeLabel } = o.geo
    if (!county || !areaName || !areaSlug) return place

    const areas = await this.list("areas", "region", region.documentId)
    let area =
      areas.find((a) => a.slug === areaSlug) ??
      (await this.match(o, county, areas, "Area", notes))
    if (!area) {
      const { lat, lng } = o.data.location
      const atPoint = await this.counties.at(lat, lng)
      const atlasLacksIt =
        areas.length === 0 ||
        (atPoint.state === o.state &&
          atPoint.county !== null &&
          placeKey(atPoint.county) === placeKey(county))
      if (!atlasLacksIt) {
        const where = [atPoint.county, atPoint.state].filter(Boolean).join(", ")
        notes.push(
          `No Area for "${county}" in ${region.name}: the point is in ${where || "no county"}`
        )

        return place
      }

      notes.push(`New Area: ${areaName} (${region.name})`)
      if (!this.write) return place

      area = this.created(areas, {
        name: areaName,
        slug: areaSlug,
        documentId: await this.strapi.findOrCreateArea(
          areaName,
          areaSlug,
          region.documentId,
          country.id,
          { typeLabel: areaTypeLabel }
        ),
      })
    }

    return { ...place, areaId: area.documentId }
  }

  private async match(
    o: MappedOutlet,
    name: string,
    places: Place[],
    label: string,
    notes: string[]
  ): Promise<Place | null> {
    const byName = matchPlace(name, places)
    if (byName) {
      notes.push(`${label} "${name}" → ${byName.name}`)

      return byName
    }

    const { lat, lng } = o.data.location
    const { county } = await this.counties.at(lat, lng)
    const byPoint = county ? matchPlace(county, places) : null
    if (byPoint) {
      notes.push(`${label} "${name}" → ${byPoint.name} (Census geocoder)`)
    }

    return byPoint
  }

  private created(list: Place[], place: Place): Place {
    list.push(place)

    return place
  }

  private async country(slug: string) {
    const known = this.countries.get(slug)
    if (known) return known

    const res = await this.strapi.get<{
      data: { documentId: string; continent?: { documentId: string } }[]
    }>("/countries", {
      "filters[slug][$eq]": slug,
      "fields[0]": "documentId",
      "populate[continent][fields][0]": "documentId",
      status: "draft",
    })
    const row = res.data[0]
    if (!row?.continent) throw new Error(`No Country ${slug} with a Continent`)

    const country = {
      id: row.documentId,
      continentId: row.continent.documentId,
    }
    this.countries.set(slug, country)

    return country
  }

  private async list(
    type: "regions" | "areas",
    parent: "country" | "region",
    parentId: string
  ): Promise<Place[]> {
    const key = `${type}:${parentId}`
    const known = this.lists.get(key)
    if (known) return known

    const rows = await this.strapi.findAll(type, {
      filters: { [parent]: { documentId: { $eq: parentId } } },
      fields: ["name", "slug"],
      status: "draft",
    })
    const places = rows.map((r) => ({
      documentId: r.documentId,
      name: String(r.name),
      slug: String(r.slug),
    }))
    this.lists.set(key, places)

    return places
  }
}
