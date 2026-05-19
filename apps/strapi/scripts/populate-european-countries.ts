/**
 * Populate all sovereign European countries in the Country content type.
 *
 * - Skips entries that already exist by slug (updates missing fields instead)
 * - Links all entries to the Europe continent
 * - Sets: name, slug, iso2, iso3, shortName, capitalCity, regionTypeLabel, population, languages
 *
 * Usage:
 *   STRAPI_API_TOKEN=xxx apps/strapi/node_modules/.bin/tsx apps/strapi/scripts/populate-european-countries.ts
 */

import {
  StrapiClient,
  type StrapiEntity,
  type StrapiListResponse,
} from "./strapi-client"

interface EuropeanCountry {
  name: string
  slug: string
  iso2: string
  iso3: string
  shortName?: string
  capitalCity: string
  regionTypeLabel: string
  population: string
  languages: string
}

// Sovereign states with territory in Europe (all UN members + Vatican + Kosovo)
// UK devolved nations kept as separate country entries (matching LibraryOn ingest model)
const EUROPEAN_COUNTRIES: EuropeanCountry[] = [
  {
    name: "Albania",
    slug: "albania",
    iso2: "AL",
    iso3: "ALB",
    capitalCity: "Tirana",
    regionTypeLabel: "County",
    population: "2,793,592",
    languages: "Albanian",
  },
  {
    name: "Andorra",
    slug: "andorra",
    iso2: "AD",
    iso3: "AND",
    capitalCity: "Andorra la Vella",
    regionTypeLabel: "Parish",
    population: "79,824",
    languages: "Catalan",
  },
  {
    name: "Austria",
    slug: "austria",
    iso2: "AT",
    iso3: "AUT",
    capitalCity: "Vienna",
    regionTypeLabel: "State",
    population: "9,042,000",
    languages: "German",
  },
  {
    name: "Belarus",
    slug: "belarus",
    iso2: "BY",
    iso3: "BLR",
    capitalCity: "Minsk",
    regionTypeLabel: "Region",
    population: "9,419,000",
    languages: "Belarusian, Russian",
  },
  {
    name: "Belgium",
    slug: "belgium",
    iso2: "BE",
    iso3: "BEL",
    capitalCity: "Brussels",
    regionTypeLabel: "Province",
    population: "11,590,000",
    languages: "Dutch, French, German",
  },
  {
    name: "Bosnia and Herzegovina",
    slug: "bosnia-and-herzegovina",
    iso2: "BA",
    iso3: "BIH",
    shortName: "Bosnia & Herz.",
    capitalCity: "Sarajevo",
    regionTypeLabel: "Canton",
    population: "3,281,000",
    languages: "Bosnian, Croatian, Serbian",
  },
  {
    name: "Bulgaria",
    slug: "bulgaria",
    iso2: "BG",
    iso3: "BGR",
    capitalCity: "Sofia",
    regionTypeLabel: "Province",
    population: "6,519,000",
    languages: "Bulgarian",
  },
  {
    name: "Croatia",
    slug: "croatia",
    iso2: "HR",
    iso3: "HRV",
    capitalCity: "Zagreb",
    regionTypeLabel: "County",
    population: "3,888,000",
    languages: "Croatian",
  },
  {
    name: "Cyprus",
    slug: "cyprus",
    iso2: "CY",
    iso3: "CYP",
    capitalCity: "Nicosia",
    regionTypeLabel: "District",
    population: "1,244,000",
    languages: "Greek, Turkish",
  },
  {
    name: "Czechia",
    slug: "czechia",
    iso2: "CZ",
    iso3: "CZE",
    shortName: "Czech Republic",
    capitalCity: "Prague",
    regionTypeLabel: "Region",
    population: "10,900,000",
    languages: "Czech",
  },
  {
    name: "Denmark",
    slug: "denmark",
    iso2: "DK",
    iso3: "DNK",
    capitalCity: "Copenhagen",
    regionTypeLabel: "Region",
    population: "5,935,000",
    languages: "Danish",
  },
  {
    name: "England",
    slug: "england",
    iso2: "GB-ENG",
    iso3: "ENG",
    capitalCity: "London",
    regionTypeLabel: "County",
    population: "56,490,048",
    languages: "English",
  },
  {
    name: "Estonia",
    slug: "estonia",
    iso2: "EE",
    iso3: "EST",
    capitalCity: "Tallinn",
    regionTypeLabel: "County",
    population: "1,331,000",
    languages: "Estonian",
  },
  {
    name: "Finland",
    slug: "finland",
    iso2: "FI",
    iso3: "FIN",
    capitalCity: "Helsinki",
    regionTypeLabel: "Region",
    population: "5,541,000",
    languages: "Finnish, Swedish",
  },
  {
    name: "France",
    slug: "france",
    iso2: "FR",
    iso3: "FRA",
    capitalCity: "Paris",
    regionTypeLabel: "Region",
    population: "68,042,000",
    languages: "French",
  },
  {
    name: "Germany",
    slug: "germany",
    iso2: "DE",
    iso3: "DEU",
    capitalCity: "Berlin",
    regionTypeLabel: "State",
    population: "84,358,000",
    languages: "German",
  },
  {
    name: "Greece",
    slug: "greece",
    iso2: "GR",
    iso3: "GRC",
    capitalCity: "Athens",
    regionTypeLabel: "Region",
    population: "10,718,000",
    languages: "Greek",
  },
  {
    name: "Hungary",
    slug: "hungary",
    iso2: "HU",
    iso3: "HUN",
    capitalCity: "Budapest",
    regionTypeLabel: "County",
    population: "9,710,000",
    languages: "Hungarian",
  },
  {
    name: "Iceland",
    slug: "iceland",
    iso2: "IS",
    iso3: "ISL",
    capitalCity: "Reykjavík",
    regionTypeLabel: "Region",
    population: "370,000",
    languages: "Icelandic",
  },
  {
    name: "Italy",
    slug: "italy",
    iso2: "IT",
    iso3: "ITA",
    capitalCity: "Rome",
    regionTypeLabel: "Region",
    population: "59,030,000",
    languages: "Italian",
  },
  {
    name: "Kosovo",
    slug: "kosovo",
    iso2: "XK",
    iso3: "XKX",
    capitalCity: "Pristina",
    regionTypeLabel: "Municipality",
    population: "1,810,000",
    languages: "Albanian, Serbian",
  },
  {
    name: "Latvia",
    slug: "latvia",
    iso2: "LV",
    iso3: "LVA",
    capitalCity: "Riga",
    regionTypeLabel: "Municipality",
    population: "1,842,000",
    languages: "Latvian",
  },
  {
    name: "Liechtenstein",
    slug: "liechtenstein",
    iso2: "LI",
    iso3: "LIE",
    capitalCity: "Vaduz",
    regionTypeLabel: "Municipality",
    population: "38,250",
    languages: "German",
  },
  {
    name: "Lithuania",
    slug: "lithuania",
    iso2: "LT",
    iso3: "LTU",
    capitalCity: "Vilnius",
    regionTypeLabel: "County",
    population: "2,795,000",
    languages: "Lithuanian",
  },
  {
    name: "Luxembourg",
    slug: "luxembourg",
    iso2: "LU",
    iso3: "LUX",
    capitalCity: "Luxembourg City",
    regionTypeLabel: "Canton",
    population: "660,809",
    languages: "Luxembourgish, French, German",
  },
  {
    name: "Malta",
    slug: "malta",
    iso2: "MT",
    iso3: "MLT",
    capitalCity: "Valletta",
    regionTypeLabel: "Region",
    population: "535,064",
    languages: "Maltese, English",
  },
  {
    name: "Moldova",
    slug: "moldova",
    iso2: "MD",
    iso3: "MDA",
    capitalCity: "Chișinău",
    regionTypeLabel: "District",
    population: "2,597,000",
    languages: "Romanian",
  },
  {
    name: "Monaco",
    slug: "monaco",
    iso2: "MC",
    iso3: "MCO",
    capitalCity: "Monaco",
    regionTypeLabel: "Ward",
    population: "36,686",
    languages: "French",
  },
  {
    name: "Montenegro",
    slug: "montenegro",
    iso2: "ME",
    iso3: "MNE",
    capitalCity: "Podgorica",
    regionTypeLabel: "Municipality",
    population: "622,000",
    languages: "Montenegrin",
  },
  {
    name: "Netherlands",
    slug: "netherlands",
    iso2: "NL",
    iso3: "NLD",
    capitalCity: "Amsterdam",
    regionTypeLabel: "Province",
    population: "17,890,000",
    languages: "Dutch",
  },
  {
    name: "North Macedonia",
    slug: "north-macedonia",
    iso2: "MK",
    iso3: "MKD",
    capitalCity: "Skopje",
    regionTypeLabel: "Municipality",
    population: "2,068,000",
    languages: "Macedonian, Albanian",
  },
  {
    name: "Northern Ireland",
    slug: "northern-ireland",
    iso2: "GB-NIR",
    iso3: "NIR",
    capitalCity: "Belfast",
    regionTypeLabel: "Council",
    population: "1,903,175",
    languages: "English, Irish",
  },
  {
    name: "Norway",
    slug: "norway",
    iso2: "NO",
    iso3: "NOR",
    capitalCity: "Oslo",
    regionTypeLabel: "County",
    population: "5,403,000",
    languages: "Norwegian",
  },
  {
    name: "Poland",
    slug: "poland",
    iso2: "PL",
    iso3: "POL",
    capitalCity: "Warsaw",
    regionTypeLabel: "Voivodeship",
    population: "37,840,000",
    languages: "Polish",
  },
  {
    name: "Portugal",
    slug: "portugal",
    iso2: "PT",
    iso3: "PRT",
    capitalCity: "Lisbon",
    regionTypeLabel: "District",
    population: "10,290,000",
    languages: "Portuguese",
  },
  {
    name: "Republic of Ireland",
    slug: "republic-of-ireland",
    iso2: "IE",
    iso3: "IRL",
    shortName: "Ireland",
    capitalCity: "Dublin",
    regionTypeLabel: "County",
    population: "5,123,000",
    languages: "Irish, English",
  },
  {
    name: "Romania",
    slug: "romania",
    iso2: "RO",
    iso3: "ROU",
    capitalCity: "Bucharest",
    regionTypeLabel: "County",
    population: "19,237,000",
    languages: "Romanian",
  },
  {
    name: "Russia",
    slug: "russia",
    iso2: "RU",
    iso3: "RUS",
    capitalCity: "Moscow",
    regionTypeLabel: "Oblast",
    population: "144,100,000",
    languages: "Russian",
  },
  {
    name: "San Marino",
    slug: "san-marino",
    iso2: "SM",
    iso3: "SMR",
    capitalCity: "San Marino",
    regionTypeLabel: "Municipality",
    population: "33,931",
    languages: "Italian",
  },
  {
    name: "Scotland",
    slug: "scotland",
    iso2: "GB-SCT",
    iso3: "SCT",
    capitalCity: "Edinburgh",
    regionTypeLabel: "Council area",
    population: "5,479,000",
    languages: "English, Scots, Scottish Gaelic",
  },
  {
    name: "Serbia",
    slug: "serbia",
    iso2: "RS",
    iso3: "SRB",
    capitalCity: "Belgrade",
    regionTypeLabel: "District",
    population: "6,833,000",
    languages: "Serbian",
  },
  {
    name: "Slovakia",
    slug: "slovakia",
    iso2: "SK",
    iso3: "SVK",
    capitalCity: "Bratislava",
    regionTypeLabel: "Region",
    population: "5,460,000",
    languages: "Slovak",
  },
  {
    name: "Slovenia",
    slug: "slovenia",
    iso2: "SI",
    iso3: "SVN",
    capitalCity: "Ljubljana",
    regionTypeLabel: "Municipality",
    population: "2,108,000",
    languages: "Slovenian",
  },
  {
    name: "Spain",
    slug: "spain",
    iso2: "ES",
    iso3: "ESP",
    capitalCity: "Madrid",
    regionTypeLabel: "Community",
    population: "47,415,000",
    languages: "Spanish",
  },
  {
    name: "Sweden",
    slug: "sweden",
    iso2: "SE",
    iso3: "SWE",
    capitalCity: "Stockholm",
    regionTypeLabel: "County",
    population: "10,521,000",
    languages: "Swedish",
  },
  {
    name: "Switzerland",
    slug: "switzerland",
    iso2: "CH",
    iso3: "CHE",
    capitalCity: "Bern",
    regionTypeLabel: "Canton",
    population: "8,703,000",
    languages: "German, French, Italian, Romansh",
  },
  {
    name: "Turkey",
    slug: "turkey",
    iso2: "TR",
    iso3: "TUR",
    capitalCity: "Ankara",
    regionTypeLabel: "Province",
    population: "85,279,000",
    languages: "Turkish",
  },
  {
    name: "Ukraine",
    slug: "ukraine",
    iso2: "UA",
    iso3: "UKR",
    capitalCity: "Kyiv",
    regionTypeLabel: "Oblast",
    population: "43,500,000",
    languages: "Ukrainian",
  },
  {
    name: "Vatican City",
    slug: "vatican-city",
    iso2: "VA",
    iso3: "VAT",
    capitalCity: "Vatican City",
    regionTypeLabel: "Municipality",
    population: "764",
    languages: "Italian, Latin",
  },
  {
    name: "Wales",
    slug: "wales",
    iso2: "GB-WLS",
    iso3: "WLS",
    capitalCity: "Cardiff",
    regionTypeLabel: "County",
    population: "3,107,500",
    languages: "English, Welsh",
  },
]

async function run() {
  const strapi = new StrapiClient()

  // Ensure Europe continent exists
  const europeId = await strapi.findOrCreateContinent("Europe", "europe", "EU")
  console.log(`Europe continent: ${europeId}\n`)

  let created = 0
  let updated = 0
  let skipped = 0

  for (const country of EUROPEAN_COUNTRIES) {
    // Check if exists by slug
    const existing = await strapi.get<
      StrapiListResponse<StrapiEntity & Record<string, unknown>>
    >("/countries", {
      "filters[slug][$eq]": country.slug,
      status: "draft",
      "pagination[limit]": "1",
    })
    const record = existing.data[0]

    if (record) {
      // Update only fields that are missing or need correction
      const patch: Record<string, unknown> = {}

      if (!record.iso2 && country.iso2) patch.iso2 = country.iso2
      if (!record.iso3 && country.iso3) patch.iso3 = country.iso3
      if (!record.capitalCity && country.capitalCity)
        patch.capitalCity = country.capitalCity
      if (
        (!record.regionTypeLabel || record.regionTypeLabel === "Region") &&
        country.regionTypeLabel !== "Region"
      )
        patch.regionTypeLabel = country.regionTypeLabel
      if (!record.population && country.population)
        patch.population = country.population
      if (!record.languages && country.languages)
        patch.languages = country.languages
      if (!record.shortName && country.shortName)
        patch.shortName = country.shortName
      // Ensure continent is linked
      if (!record.continent) {
        patch.continent = { connect: [{ documentId: europeId }] }
      }

      if (Object.keys(patch).length > 0) {
        await strapi.put(`/countries/${record.documentId}`, { data: patch })
        console.log(`[UPD] ${country.name} (${Object.keys(patch).join(", ")})`)
        updated++
      } else {
        console.log(`[OK ] ${country.name} — already complete`)
        skipped++
      }
    } else {
      // Create new
      await strapi.post(`/countries?status=draft`, {
        data: {
          name: country.name,
          slug: country.slug,
          iso2: country.iso2,
          iso3: country.iso3,
          ...(country.shortName ? { shortName: country.shortName } : {}),
          capitalCity: country.capitalCity,
          regionTypeLabel: country.regionTypeLabel,
          population: country.population,
          languages: country.languages,
          continent: { connect: [{ documentId: europeId }] },
        },
      })
      console.log(`[NEW] ${country.name}`)
      created++
    }

    await sleep(80)
  }

  console.log(
    `\nDone. ${created} created, ${updated} updated, ${skipped} already complete`
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

run().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})
