/**
 * Where the Atlas opens when the URL names no view: the visitor's region,
 * guessed from the browser's time zone (no location permission needed),
 * close enough that its libraries fill the screen. Phones open a step wider.
 */
export type AtlasStartView = { lat: number; lng: number; zoom: number }

/** South American zones, which also start with "America/". */
const SOUTH_AMERICA = new Set([
  "Argentina",
  "Asuncion",
  "Bahia",
  "Belem",
  "Boa_Vista",
  "Bogota",
  "Campo_Grande",
  "Caracas",
  "Cayenne",
  "Cuiaba",
  "Fortaleza",
  "Guayaquil",
  "Guyana",
  "La_Paz",
  "Lima",
  "Manaus",
  "Montevideo",
  "Paramaribo",
  "Porto_Velho",
  "Recife",
  "Rio_Branco",
  "Santiago",
  "Sao_Paulo",
])
const southAmerican = (zone: string) =>
  zone.startsWith("America/") && SOUTH_AMERICA.has(zone.split("/")[1] ?? "")

const REGIONS: { match: (zone: string) => boolean; view: AtlasStartView }[] = [
  { match: southAmerican, view: { lat: -18, lng: -60, zoom: 2.9 } },
  {
    match: (zone) => /^(America|Canada|US)\//.test(zone),
    view: { lat: 40, lng: -97, zoom: 3.3 },
  },
  {
    match: (zone) =>
      /^(Europe\/|Atlantic\/(Reykjavik|Faroe|Canary|Madeira))/.test(zone),
    view: { lat: 51, lng: 10, zoom: 3.7 },
  },
  {
    match: (zone) => /^(Australia\/|Pacific\/(Auckland|Chatham))/.test(zone),
    view: { lat: -28, lng: 140, zoom: 3.3 },
  },
  {
    match: (zone) => zone.startsWith("Africa/"),
    view: { lat: 4, lng: 20, zoom: 2.8 },
  },
  {
    match: (zone) => zone.startsWith("Asia/"),
    view: { lat: 28, lng: 95, zoom: 2.8 },
  },
]
const WORLD: AtlasStartView = { lat: 35, lng: 10, zoom: 2.3 }

export function atlasStartView(
  timeZone: string | undefined,
  narrow: boolean
): AtlasStartView {
  const view =
    (timeZone && REGIONS.find((region) => region.match(timeZone))?.view) ||
    WORLD

  return narrow ? { ...view, zoom: Math.max(1.6, view.zoom - 0.8) } : view
}

/** The start view for this browser. */
export function browserStartView(width: number): AtlasStartView {
  let timeZone: string | undefined
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    timeZone = undefined
  }

  return atlasStartView(timeZone, width < 640)
}
