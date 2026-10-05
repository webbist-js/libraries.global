/**
 * One Country Profile per country (spec §6.4): what its Regions and Areas
 * are called (Place Labels, UI only) and how the world place import reads
 * its places. A country with no entry imports GeoNames level 1 as Regions
 * and level 2 as Areas, adds nothing where places already exist, and keeps
 * its labels.
 */

export interface ProfileLabels {
  region: string
  regions: string
  area?: string
  areas?: string
}

export interface CountryProfile {
  /** The Country's iso2 in Strapi: "CH", or "GB-ENG" for a UK nation. */
  key: string
  labels?: ProfileLabels
  /** GeoNames level of the Region. Default 1. */
  regionLevel?: 1 | 2
  /** GeoNames level of the Area; null means no Areas. Default 2. */
  areaLevel?: 2 | 3 | null
  /** Where in GeoNames. Default `{ country: key }`; UK nations name their admin1. */
  geonames?: { country: string; admin1?: string }
  /** Add missing places where some already exist. Default false. */
  fill?: boolean
  /** "curated" reads `data/<curatedFile>`. Default "geonames". */
  source?: "geonames" | "curated"
  curatedFile?: string
  /** Type words to drop from either end of a name, e.g. "Landkreis ". */
  tidyNames?: string[]
  /** "admin1": every Area slug ends in its Region's admin1 code (US, IMLS style). */
  areaSlugSuffix?: "on-clash" | "admin1"
  /** Existing place name → the source's spelling, where the matcher can't join them. */
  aliases?: Record<string, string>
  /**
   * Region name → what that Region calls its Areas, where it differs from
   * the country's `labels.area` (Greater London's boroughs). Set on the
   * Region in the labels step.
   */
  regionLabels?: Record<string, RegionAreaLabels>
}

export interface RegionAreaLabels {
  area: string
  areas: string
}

export interface ResolvedProfile {
  key: string
  labels: ProfileLabels | null
  regionLevel: 1 | 2
  areaLevel: 2 | 3 | null
  geonames: { country: string; admin1?: string }
  fill: boolean
  source: "geonames" | "curated"
  curatedFile: string | null
  tidyNames: string[]
  areaSlugSuffix: "on-clash" | "admin1"
  aliases: Record<string, string>
  regionLabels: Record<string, RegionAreaLabels>
}

const BOROUGHS: RegionAreaLabels = { area: "Borough", areas: "Boroughs" }

export const PROFILES: CountryProfile[] = [
  // ── The UK's four nations ───────────────────────────────────────────────
  {
    key: "GB-ENG",
    labels: {
      region: "County",
      regions: "Counties",
      area: "District",
      areas: "Districts",
    },
    source: "curated",
    curatedFile: "england.json",
    fill: true,
    // London boroughs, and the metropolitan boroughs of the six metropolitan
    // counties; the shire counties keep "District".
    regionLabels: {
      "Greater London": BOROUGHS,
      "Greater Manchester": BOROUGHS,
      Merseyside: BOROUGHS,
      "South Yorkshire": BOROUGHS,
      "Tyne and Wear": BOROUGHS,
      "West Midlands": BOROUGHS,
      "West Yorkshire": BOROUGHS,
    },
  },
  {
    key: "GB-SCT",
    labels: { region: "Authority", regions: "Authorities" },
    geonames: { country: "GB", admin1: "SCT" },
    regionLevel: 2,
    areaLevel: null,
    // The atlas had 31 of the 32 council areas (no Shetland Islands).
    fill: true,
    // The Western Isles: the atlas has the Gaelic "Na h-Eileanan Siar", run together.
    aliases: { "Nah-Eileanan Siar": "Eilean Siar" },
  },
  {
    key: "GB-WLS",
    labels: { region: "County", regions: "Counties" },
    geonames: { country: "GB", admin1: "WLS" },
    regionLevel: 2,
    areaLevel: null,
    // The atlas had 12 of the 22 principal areas.
    fill: true,
    // GeoNames: "Bridgend county borough", "City and County of Swansea", "Sir Powys".
    tidyNames: [
      " County Borough",
      " county borough",
      "City and County of ",
      "County of ",
      "Sir ",
    ],
    aliases: { "Isle of Anglesey": "Anglesey" },
  },
  // Was "County"; its Regions are the eleven districts.
  {
    key: "GB-NIR",
    labels: { region: "District", regions: "Districts" },
    geonames: { country: "GB", admin1: "NIR" },
    regionLevel: 2,
    areaLevel: null,
  },

  // ── Countries already in the atlas (Region labels kept unless noted) ────
  {
    key: "AD",
    labels: { region: "Parish", regions: "Parishes" },
    areaLevel: null,
  },
  {
    key: "AL",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "AT",
    labels: {
      region: "State",
      regions: "States",
      area: "District",
      areas: "Districts",
    },
  },
  // Was "Canton"; its Regions are the two entities and Brčko.
  {
    key: "BA",
    labels: {
      region: "Entity",
      regions: "Entities",
      area: "Canton",
      areas: "Cantons",
    },
    // Misspelt in the atlas ("Bosnai", "Repuplika").
    aliases: {
      "Federacija Bosnai Hercegovina": "Federation of B&H",
      "Repuplika Srpska": "Srpska",
    },
  },
  // Was "Province"; its Regions are Brussels, Flanders and Wallonia.
  {
    key: "BE",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Province",
      areas: "Provinces",
    },
  },
  {
    key: "BG",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "BY",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "CH",
    labels: {
      region: "Canton",
      regions: "Cantons",
      area: "District",
      areas: "Districts",
    },
    tidyNames: ["Bezirk ", "Wahlkreis ", "Region ", " District"],
    // The atlas files these cantons under their local names; GeoNames uses English ones.
    aliases: {
      "Basel-Stadt": "Basel-City",
      Genève: "Geneva",
      Graubünden: "Grisons",
      "Sankt Gallen": "Saint Gallen",
    },
  },
  {
    key: "CY",
    labels: { region: "District", regions: "Districts" },
    areaLevel: null,
  },
  {
    key: "CZ",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  // GeoNames level 2 is Regierungsbezirke; Kreise are level 3.
  {
    key: "DE",
    labels: {
      region: "State",
      regions: "States",
      area: "District",
      areas: "Districts",
    },
    areaLevel: 3,
    tidyNames: ["Landkreis ", "Kreisfreie Stadt ", "Stadtkreis ", "Kreis "],
  },
  {
    key: "DK",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "EE",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "EG",
    labels: {
      region: "Governorate",
      regions: "Governorates",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "ES",
    labels: {
      region: "Community",
      regions: "Communities",
      area: "Province",
      areas: "Provinces",
    },
    // The atlas's Spanish names lost a space ("Castillay", "Comunidadde").
    aliases: {
      "Castillay León": "Castille and León",
      "Comunidad Foralde Navarra": "Navarre",
      "Comunidadde Madrid": "Madrid",
      "Principadode Asturias": "Asturias",
      "Regiónde Murcia": "Murcia",
    },
  },
  {
    key: "FI",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "FR",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Department",
      areas: "Departments",
    },
  },
  {
    key: "GR",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Regional unit",
      areas: "Regional units",
    },
  },
  {
    key: "HR",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
    aliases: { "Bjelovarska-Bilogorska": "Bjelovar-Bilogora" },
  },
  {
    key: "HU",
    labels: {
      region: "County",
      regions: "Counties",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "IE",
    labels: { region: "County", regions: "Counties" },
    regionLevel: 2,
    areaLevel: null,
  },
  {
    key: "IS",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Municipality",
      areas: "Municipalities",
    },
    // Norðurland eystra and vestra, run together in the atlas.
    aliases: {
      Norðurlandeystra: "Northeast",
      Norðurlandvestra: "Northwest",
    },
  },
  {
    key: "IT",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "Province",
      areas: "Provinces",
    },
    aliases: { "Valled'Aosta": "Aosta Valley" },
  },
  {
    key: "LT",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
    // The atlas uses the genitive ("Alytaus apskritis" is Alytus County).
    aliases: {
      Alytaus: "Alytus",
      Kauno: "Kaunas",
      Klaipedos: "Klaipėda County",
      Marijampoles: "Marijampolė County",
      Panevezio: "Panevėžys",
      Taurages: "Tauragė County",
      Utenos: "Utena",
      Vilniaus: "Vilnius",
    },
  },
  // Was "Municipality"; its Regions are the five planning regions. GeoNames
  // level 1 for LV is municipalities, not these planning/statistical
  // regions (see README "Known gaps").
  {
    key: "LV",
    labels: { region: "Region", regions: "Regions" },
    areaLevel: null,
  },
  {
    key: "MD",
    labels: { region: "District", regions: "Districts" },
    areaLevel: null,
  },
  {
    key: "ME",
    labels: { region: "Municipality", regions: "Municipalities" },
    areaLevel: null,
    aliases: { Plav: "Opština Plav" },
  },
  {
    key: "MK",
    labels: { region: "Municipality", regions: "Municipalities" },
    areaLevel: null,
    // Transliterated with "ts" for "c" in the atlas, or run together.
    aliases: {
      Centaržupa: "Centar Zhupa",
      Jegunovtse: "Jegunovce",
      Kavadartsi: "Kavadarci",
      "Mavrovoand Rostuša": "Mavrovo and Rostuša",
      Novatsi: "Novaci",
      Strumitsa: "Strumica",
      Vinitsa: "Vinica",
    },
  },
  {
    key: "NL",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "NO",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
    // "Ãstfold" is Østfold mis-encoded.
    aliases: {
      Ãstfold: "Østfold",
      "Møreog Romsdal": "Møre og Romsdal",
    },
  },
  {
    key: "PL",
    labels: {
      region: "Voivodeship",
      regions: "Voivodeships",
      area: "County",
      areas: "Counties",
    },
  },
  {
    key: "PT",
    labels: {
      region: "District",
      regions: "Districts",
      area: "Municipality",
      areas: "Municipalities",
    },
    aliases: { "Vianado Castelo": "Viana do Castelo" },
  },
  {
    key: "RO",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "RS",
    labels: {
      region: "District",
      regions: "Districts",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "SE",
    labels: {
      region: "County",
      regions: "Counties",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  // Was "Municipality"; its Regions are the twelve statistical regions.
  // GeoNames level 1 for SI is municipalities, not these planning/statistical
  // regions (see README "Known gaps").
  {
    key: "SI",
    labels: { region: "Region", regions: "Regions" },
    areaLevel: null,
  },
  {
    key: "SK",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "UA",
    labels: {
      region: "Oblast",
      regions: "Oblasts",
      area: "District",
      areas: "Districts",
    },
    // Older romanisations in the atlas.
    aliases: {
      "Khmel'nyts'kyy": "Khmelnytskyi",
      Mykolayiv: "Mykolaiv",
      "Sevastopol'": "Sevastopol City",
      Vinnytsya: "Vinnytsia",
    },
  },
  {
    key: "US",
    labels: {
      region: "State",
      regions: "States",
      area: "County",
      areas: "Counties",
    },
    fill: true,
    areaSlugSuffix: "admin1",
  },
  // Was "Municipality"; its Regions are the seven districts.
  {
    key: "XK",
    labels: {
      region: "District",
      regions: "Districts",
      area: "Municipality",
      areas: "Municipalities",
    },
    // The atlas uses the Serbian names; GeoNames the Albanian ones.
    aliases: {
      Đakovica: "Gjakova",
      Gnjilane: "Gjilan",
      "Kosovska Mitrovica": "Mitrovica",
      Pećki: "Pec",
      Uroševac: "Ferizaj",
    },
  },

  // ── Countries with no places yet ────────────────────────────────────────
  {
    key: "AR",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Department",
      areas: "Departments",
    },
  },
  {
    key: "AU",
    labels: {
      region: "State",
      regions: "States",
      area: "Local government area",
      areas: "Local government areas",
    },
  },
  {
    key: "BR",
    labels: {
      region: "State",
      regions: "States",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "CA",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Division",
      areas: "Divisions",
    },
  },
  {
    key: "CN",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Prefecture",
      areas: "Prefectures",
    },
  },
  {
    key: "IN",
    labels: {
      region: "State",
      regions: "States",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "JP",
    labels: {
      region: "Prefecture",
      regions: "Prefectures",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "MX",
    labels: {
      region: "State",
      regions: "States",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  {
    key: "NG",
    labels: {
      region: "State",
      regions: "States",
      area: "Local government area",
      areas: "Local government areas",
    },
  },
  {
    key: "NZ",
    labels: {
      region: "Region",
      regions: "Regions",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "RU",
    labels: {
      region: "Federal subject",
      regions: "Federal subjects",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "TR",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "District",
      areas: "Districts",
    },
  },
  {
    key: "ZA",
    labels: {
      region: "Province",
      regions: "Provinces",
      area: "Municipality",
      areas: "Municipalities",
    },
  },
  // Too small for a second level.
  { key: "LI", areaLevel: null },
  { key: "MC", areaLevel: null },
  { key: "SG", areaLevel: null },
  { key: "SM", areaLevel: null },
  { key: "VA", areaLevel: null },
]

/** A key's profile with every default filled in; throws on one that can't work. */
export function resolveProfile(
  key: string,
  profiles: readonly CountryProfile[] = PROFILES
): ResolvedProfile {
  const p = profiles.find((x) => x.key === key)
  const regionLevel = p?.regionLevel ?? 1
  const areaLevel = p?.areaLevel === undefined ? 2 : p.areaLevel
  const source = p?.source ?? "geonames"
  if (areaLevel !== null && areaLevel <= regionLevel)
    throw new Error(
      `${key}: the Area level (${areaLevel}) must be below the Region level (${regionLevel})`
    )
  if (source === "curated" && !p?.curatedFile)
    throw new Error(`${key}: a curated profile needs a curatedFile`)
  if (source === "geonames" && !p?.geonames && !/^[A-Z]{2}$/.test(key))
    throw new Error(`${key}: name its GeoNames country`)

  return {
    key,
    labels: p?.labels ?? null,
    regionLevel,
    areaLevel,
    geonames: p?.geonames ?? { country: key },
    fill: p?.fill ?? false,
    source,
    curatedFile: p?.curatedFile ?? null,
    tidyNames: p?.tidyNames ?? [],
    areaSlugSuffix: p?.areaSlugSuffix ?? "on-clash",
    aliases: p?.aliases ?? {},
    regionLabels: p?.regionLabels ?? {},
  }
}

/** The profile's own label words, ignored when matching names. */
export function labelWords(profile: ResolvedProfile): string[] {
  const l = profile.labels

  return l
    ? [l.region, l.regions, l.area, l.areas].filter((w): w is string => !!w)
    : []
}
