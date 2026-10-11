import type { SourcePlace } from "./geography"
import type { StrapiClient } from "../../../strapi-client"
import {
  planPlaces as plan,
  applyPlaces as apply,
  type PlaceOptions,
  type PlacePlan,
  type PlaceAction,
} from "../../_shared/places"

export type { PlacePlan, PlaceAction } from "../../_shared/places"

export const PLACE_ATTRIBUTION =
  "Statistics Finland, administrative classifications, CC BY 4.0. https://stat.fi/en/luokitukset/"
const LEGACY_LAPLAND_AREAS = new Set([
  "Kemi-Tornio",
  "Torniolaakso",
  "Rovaniemi",
  "Itä-Lappi",
  "Tunturi-Lappi",
  "Pohjois-Lappi",
])

export const FINLAND_PLACES: PlaceOptions = {
  attribution: PLACE_ATTRIBUTION,
  countries: { FI: { iso3: "FIN" }, AX: { iso3: "ALA" } },
  exclude: (place, source) =>
    source.level === "area" &&
    source.country === "FI" &&
    !place.populationReportingCode &&
    place.sourceAttribution !== PLACE_ATTRIBUTION &&
    LEGACY_LAPLAND_AREAS.has(String(place.name)),
}
export const planPlaces = (
  client: StrapiClient,
  sources: SourcePlace[],
  codes = new Map<string, string>()
) => plan(client, sources, codes, FINLAND_PLACES)
export const applyPlaces = (
  client: StrapiClient,
  plan: PlacePlan,
  checkpoint: (action: PlaceAction, documentId: string) => void
) => apply(client, plan, checkpoint, FINLAND_PLACES)
