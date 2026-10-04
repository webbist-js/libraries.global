// Photon answers recorded on 2026-10-04 (`lang=en`), trimmed to the keys
// toPlace reads.
import type { PhotonFeature } from "../place"

export const BRITISH_LIBRARY: PhotonFeature = {
  geometry: { coordinates: [-0.1276918, 51.5299119] },
  properties: {
    osm_type: "W",
    osm_id: 4680891,
    osm_key: "amenity",
    osm_value: "library",
    type: "house",
    housenumber: "96",
    name: "British Library",
    street: "Euston Road",
    district: "Somers Town",
    city: "London",
    state: "England",
    country: "United Kingdom",
    postcode: "NW1 2DB",
    countrycode: "GB",
  },
}

export const BAVARIAN_STATE_LIBRARY: PhotonFeature = {
  geometry: { coordinates: [11.5806127, 48.1473962] },
  properties: {
    osm_type: "R",
    osm_id: 52412,
    osm_key: "amenity",
    osm_value: "library",
    type: "house",
    housenumber: "16",
    name: "Bavarian State Library",
    street: "Ludwigstraße",
    locality: "Schönfeldvorstadt",
    district: "Maxvorstadt",
    city: "Munich",
    state: "Bavaria",
    country: "Germany",
    postcode: "80539",
    countrycode: "DE",
  },
}

export const BRONTE_MUSEUM: PhotonFeature = {
  geometry: { coordinates: [-1.9574451, 53.8311966] },
  properties: {
    osm_type: "W",
    osm_id: 61300076,
    osm_key: "tourism",
    osm_value: "museum",
    type: "house",
    name: "Bronte Parsonage Museum",
    street: "Church Street",
    locality: "Haworth Brow",
    district: "Haworth and Stanbury",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    postcode: "BD22 8DR",
    countrycode: "GB",
  },
}

export const HAWORTH_VILLAGE: PhotonFeature = {
  geometry: { coordinates: [-1.9485865, 53.8311942] },
  properties: {
    osm_type: "N",
    osm_id: 4813966154,
    osm_key: "place",
    osm_value: "village",
    type: "district",
    name: "Haworth",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    postcode: "BD22 8NJ",
    countrycode: "GB",
  },
}

export const CHURCH_STREET: PhotonFeature = {
  geometry: { coordinates: [-1.9573306, 53.8312899] },
  properties: {
    osm_type: "W",
    osm_id: 694332238,
    osm_key: "highway",
    osm_value: "unclassified",
    type: "street",
    name: "Church Street",
    locality: "Haworth Brow",
    district: "Haworth and Stanbury",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    postcode: "BD22 8DR",
    countrycode: "GB",
  },
}

/** A reverse-lookup answer: no street, no postcode. */
export const HAWORTH_CHURCHYARD: PhotonFeature = {
  geometry: { coordinates: [-1.9566318, 53.8309287] },
  properties: {
    osm_type: "W",
    osm_id: 120289822,
    osm_key: "landuse",
    osm_value: "cemetery",
    type: "other",
    name: "Haworth Churchyard",
    locality: "Haworth Brow",
    district: "Haworth and Stanbury",
    city: "Bradford",
    county: "West Yorkshire",
    state: "England",
    country: "United Kingdom",
    countrycode: "GB",
  },
}
