# Finland and Åland

The `kirjastot-fi` ingest reads the [Kirkanta library directory](https://api.kirjastot.fi/), joins each Library to its municipality, and imports the current administrative hierarchy and population from Statistics Finland. It uses the existing Library, Country, Region, Area, Dataset and Source Record fields. No schema changes are required.

## Sources and licence

The directory's API documentation explicitly permits adaptation and redistribution under CC BY 4.0. It requires credit to Kirjastot.fi, the licence and a link to its API documentation. The Dataset registry records all three, plus a description of our mapping.

Statistics Finland's [terms of use](https://stat.fi/en/about-us/get-to-know-statistics-finland/legislation/terms-of-use) apply CC BY 4.0 to its open data. Population comes from [PxWeb table 11ra](https://pxdata.stat.fi/PxWeb/pxweb/en/StatFin/StatFin__vaerak/11ra.px/), using **Population 31 Dec** for the selected year. Place names and membership come from the official [municipality-to-region correspondence](https://stat.fi/en/luokitukset/corrmaps/kunta_1_20260101%23maakunta_1_20260101) and municipality-to-subregion correspondence. The boundary date is read from the population table's area dimension, then used for every classification request. It is recorded separately from the population year.

Each response is cached with its request and actual retrieval time. Run reports record the SHA-256 of every snapshot. Finnish, English and Swedish official names are used for matching. Library names remain in Finnish as provided by the source; descriptions and slogans are omitted rather than inserted into English prose fields.

## Run

From `apps/strapi`, with the application's existing `.env`:

```bash
# Download, validate and map; no CMS or database connection
pnpm ingest --dataset=kirjastot-fi

# Also compare geography, Source Records and global slugs; read only
pnpm ingest --dataset=kirjastot-fi --check-cms

# Create the complete geographic catalogue and population; add 25 Library drafts
pnpm ingest --dataset=kirjastot-fi --apply --limit=25

# Resume and add all remaining Library drafts
pnpm ingest --dataset=kirjastot-fi --apply

# Replay saved input without fetching from either publisher
pnpm ingest --dataset=kirjastot-fi --snapshot=scripts/ingests/finland/kirjastot-fi/.cache

# Intentionally replace cached inputs
pnpm ingest --dataset=kirjastot-fi --refresh --year=2025
```

CMS checks and writes require `STRAPI_API_TOKEN`, `STRAPI_BRIDGE_SECRET`, `DATABASE_*` and, for a remote server, `STRAPI_URL`. REST and database document identities must agree. Public REST projections omit reporting codes, so the preflight reads those identifiers from PostgreSQL; population writes reuse the existing transactional population store. The bridge secret is required because the server otherwise strips draft status. The runner never publishes Libraries or new places.

`--limit=N` counts newly created Libraries. Existing Source Records do not consume that limit. Every run maps the whole directory and validates the complete geography first. Unknown library types, ambiguous municipalities, missing populations, incomplete classifications and slug conflicts stop the run before writes. The pipeline stops on the first failed write and saves what completed. Re-run the same snapshots to continue.

## Geography and population

Mainland Finland uses 18 current Regions and 292 Municipalities as Areas. Åland is already a separate ISO country (`AX`) in the atlas. Its three recognised subregions remain Regions, with 16 Municipalities as Areas. The directory's Maarianhamina library therefore belongs under Åland → Mariehamn → Mariehamn.

Finland's official national total includes Åland. To avoid counting it twice in the atlas, the Finland population is the complete sum of its 18 mainland Regions (`sum_complete_children`), with coverage metadata naming the excluded `AX` country. Åland uses its directly reported regional total. Every Region's municipality populations must reconcile, as must both country totals with the official national total. For the 2025 population on 2026 boundaries, mainland Finland is 5,622,045 and Åland is 30,836.

Estimates retain the year, reporting code, boundary date, retrieval time, publisher, URL, licence and bot attribution. Population-only updates preserve publication state and unrelated draft text, retain older estimates, and update every locale/version of the matched document. Finnish codes never populate the UK-only `gssCode` field.

The initial atlas has four obsolete Finnish provinces and six Lapland statistical subregions. The report lists them for editorial review. They are neither deleted nor moved. In particular, the old Rovaniemi subregion is not reused as the current Rovaniemi Municipality. Lapland itself can be reused because it corresponds to the current Region. Once a place has its official reporting code, later runs match by that code even if a contributor changes its name.

## Field mapping

| Kirkanta field                   | Library field                     | Rule                                                                                                                                                                                                     |
| -------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                             | `sourceRecords[].recordId`        | Numeric ID as a string; `source` is `kirjastot-fi`.                                                                                                                                                      |
| `name`                           | `name`, `slug`                    | Preserve the institution's name. Slug includes country and stable ID.                                                                                                                                    |
| `type`                           | `libraryType`                     | Municipal/children → Public; mobile → Mobile; university → University; polytechnic/school/vocational college → Academic; special/institutional/music → Special; other → Other. Home delivery is skipped. |
| `city` and `refs.city`           | Country, Region, Area             | Exact unique match against official multilingual municipality names, including the two parts of a bilingual official name.                                                                               |
| `address`                        | Street address, city, postal code | Preserve source strings. A Mobile Library's address describes its base.                                                                                                                                  |
| `coordinates`                    | `location`                        | Use finite coordinates within Finland's geographic range. Missing/invalid points are flagged and omitted.                                                                                                |
| `primaryContactInfo`             | Website, email, phone             | Main institutional contacts only; malformed URLs/emails are flagged and omitted.                                                                                                                         |
| `founded`, `shortName`           | Foundation year, short name       | Valid year only; ignore placeholder strings.                                                                                                                                                             |
| No persistent operational status | `operationalStatus`               | Unknown. Real-time opening status does not establish permanent closure or opening.                                                                                                                       |

All Libraries use `Europe/Helsinki`. Operator is Municipality for municipal/mobile records and University for university records; other operators remain unfilled. Photos, staff contacts, HTML descriptions, services, dated opening schedules and mobile timetables are not imported by this adapter.

## Coverage checked on 11 October 2026

The complete snapshot has 978 records. Two home delivery services are skipped, leaving 976 Library drafts: 962 in Finland and 14 in Åland. By type there are 726 Public, 101 Mobile, 38 University, 69 Academic, 35 Special and 7 Other. Of these, 64 lack a usable map pin. This is directory coverage, not a claim that every Finnish library institution is represented.

The completed local import has 331 sourced population estimates and no invalid Country/Region/Area links. A subsequent CMS preflight recognises all 976 Source Records and all 331 geographic documents, with nothing left to create. An interrupted request had committed before its response was lost; the resumed run adopted that Source Record without creating a duplicate.

After publication and index reseeding, suitable contributor work is operational status verification, missing map pins, opening hours and mobile timetables. Split Drives by Region and name Kirjastot.fi's reusable directory in the evidence instructions.
