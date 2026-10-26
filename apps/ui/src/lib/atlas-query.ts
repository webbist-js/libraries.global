import "server-only"
import { createHash } from "node:crypto"

import {
  atlasLocalGeography,
  atlasPeoplePerLibrary,
  type AtlasLibraryAccessResponse,
  ATLAS_LIMITS,
  atlasPopulationBaseline,
  atlasPerCapitaCountry,
  atlasPerCapitaSummary,
  populationCountryCode,
  POPULATION_REFERENCE_YEAR,
  type PopulationObservation,
  type AtlasPerCapitaResponse,
  ATLAS_OPERATOR_GROUPS,
  ATLAS_TYPE_GROUPS,
  atlasAccessFilter,
  atlasAggregation,
  atlasCellsForBounds,
  atlasCell,
  atlasCellId,
  atlasDensityBounds,
  atlasDensityCounts,
  atlasDensityResolution,
  atlasDensityCell,
  type AtlasLibraryDensity,
  atlasBoundsRanges,
  atlasKeysetFilter,
  atlasLongitude,
  atlasMeiliFilter,
  atlasPoint,
  atlasResolveScope,
  atlasTimezoneCatalog,
  atlasProjectionOpenNow,
  ATLAS_OPEN_DAYS,
  ATLAS_OPEN_FRAMES_PER_DAY,
  atlasOpenField,
  noticeLocalDate,
  type AtlasDictionary,
  type AtlasDensityGrid,
  emptyAtlasFilters,
  type AtlasAggregateCell,
  type AtlasCountsResponse,
  type AtlasCursorPayload,
  type AtlasCoverage,
  type AtlasExtentResponse,
  type AtlasListResponse,
  type AtlasListRow,
  type AtlasPopulation,
  type AtlasProjection,
  type AtlasQueryMetadata,
  type AtlasQueryRequest,
  type AtlasQueryResponse,
  type AtlasScope,
  type AtlasSearchResponse,
  type AtlasSuggestionsResponse,
  type AtlasViewportPopulation,
  type AtlasViewportResponse,
} from "@repo/shared-data"

import type {
  AtlasBackend,
  AtlasBackendState,
  AtlasSearchResult,
} from "./atlas-backend"
import { readAtlasCursor, signAtlasCursor } from "./atlas-cursor"

const ZONES = atlasTimezoneCatalog()
const COUNTRY_IDENTITIES = atlasPopulationBaseline.countries.map((row) => ({
  iso2: row.iso2,
  reportingCode: row.iso3,
}))
const GEOMETRY_BYTES = 256 * 1024
const POINT_FIELDS = [
  "atlas_id",
  "documentId",
  "slug",
  "name",
  "longitude",
  "latitude",
  "type_group",
  "operator_group",
  "network_ids",
  "status",
  "listed",
  "continent_id",
  "country_id",
  "region_id",
  "area_id",
  "city_key",
  "access_codes",
  "facility_codes",
  "has_events",
  "has_catalogue",
  "late_sunday",
  "founded",
  "completeness",
]
const LIST_FIELDS = [
  "documentId",
  "name",
  "slug",
  "path",
  "type_group",
  "city",
  "country_name",
  "region_name",
  "latitude",
  "longitude",
  "name_sort",
  "place_sort",
  "atlas_id",
  "status",
  "open_tz",
  "has_hours",
  "has_effective_hours",
  "closed_dates",
  "clock_valid_until",
  "access_codes",
  "completeness",
  ...["open", "regular_open", "staff_open"].flatMap((prefix) =>
    ATLAS_OPEN_DAYS.flatMap((day) =>
      Array.from({ length: ATLAS_OPEN_FRAMES_PER_DAY }, (_, n) => [
        atlasOpenField(
          day,
          n,
          "from",
          prefix as "open" | "regular_open" | "staff_open"
        ),
        atlasOpenField(
          day,
          n,
          "to",
          prefix as "open" | "regular_open" | "staff_open"
        ),
      ]).flat()
    )
  ),
]

export function atlasExactTotal(
  result: AtlasSearchResult,
  locale: string
): number {
  const total = result.facetDistribution?.locale?.[locale]
  if (total === undefined) {
    if (result.estimatedTotalHits === 0) return 0
    throw new Error("Atlas exact locale facet missing")
  }
  if (!Number.isSafeInteger(total) || total < 0)
    throw new Error("Invalid Atlas exact total")

  return total
}
export function atlasListRow(
  row: AtlasProjection & { _geoDistance?: number },
  dictionary: AtlasDictionary,
  now: Date,
  clockHealthy: boolean
): AtlasListRow {
  return {
    documentId: row.documentId,
    name: row.name,
    slug: row.slug,
    path: row.path,
    type: row.type_group,
    city: row.city,
    country: row.country_name,
    region: row.region_name,
    coordinate: { lat: row.latitude, lng: row.longitude },
    status: row.status,
    timezone: row.open_tz,
    hours: row.has_hours
      ? ATLAS_OPEN_DAYS.map((day) =>
          Array.from({ length: ATLAS_OPEN_FRAMES_PER_DAY }, (_, n) => {
            const from = row[atlasOpenField(day, n, "from", "regular_open")]
            const to = row[atlasOpenField(day, n, "to", "regular_open")]

            return from === undefined || to === undefined
              ? []
              : [[from, to] as [number, number]]
          }).flat()
        )
      : null,
    openNow:
      !clockHealthy ||
      (row.clock_valid_until !== null &&
        now.getTime() >= Date.parse(row.clock_valid_until))
        ? "unknown"
        : !row.has_effective_hours &&
            !row.closed_dates.includes(noticeLocalDate(now, row.open_tz))
          ? "unknown"
          : atlasProjectionOpenNow(row, now)
            ? "open"
            : "closed",
    accessibility: dictionary.entries
      .filter((entry) => row.access_codes.includes(entry.code))
      .flatMap((entry) => [entry.name, ...entry.aliases]),
    completeness: row.completeness,
    ...(row._geoDistance === undefined
      ? {}
      : { distanceMetres: row._geoDistance }),
  }
}
const world = (scope: AtlasScope): AtlasScope => ({
  filters: scope.filters,
  accessibility: { ...scope.accessibility, enabled: false },
})
// Place discovery and facet inventories remain within an institutional selection.
const discoveryFilters = (scope: AtlasScope): AtlasScope["filters"] => ({
  ...emptyAtlasFilters(),
  ...(scope.filters.networks?.length
    ? { networks: scope.filters.networks }
    : {}),
})
const fold = (text: string): string =>
  text.normalize("NFKD").replaceAll(/\p{M}/gu, "").trim().toLowerCase()
const coverage = (base: number, all: number, any: number): AtlasCoverage => {
  if (all > any || any > base || Math.min(base, all, any) < 0)
    throw new Error("Concurrent Atlas coverage changed; retry")

  return {
    total: base,
    matches: all,
    partial: any - all,
    unconfirmed: base - all,
  }
}

/** All map, controls and pagination share the same code/clock predicates. */
export class AtlasQueryEngine {
  constructor(
    readonly backend: AtlasBackend,
    readonly state: AtlasBackendState,
    readonly now: Date
  ) {}

  filter(
    scope: AtlasScope,
    population: AtlasPopulation = "listed",
    ignoreAccessView = false,
    libraryAccess = false
  ): string {
    if (
      ["now", "staff_now"].includes(scope.filters.opening) &&
      population !== "closures" &&
      (this.state.projectionRevision !== this.state.indexedThrough ||
        (this.state.clockDue !== null &&
          Date.parse(this.state.clockDue) <= this.now.getTime()))
    )
      throw new Error("Atlas opening-hour clock is catching up")

    return `locale = ${JSON.stringify(this.state.canonicalLocale)} AND ${atlasMeiliFilter(atlasResolveScope(scope, this.state.dictionary), { now: this.now, timezones: ZONES, population, ignoreAccessView, libraryAccess })}`
  }

  metadata(request: AtlasQueryRequest): AtlasQueryMetadata {
    const input = {
      ...request,
      ...("cursor" in request ? { cursor: undefined } : {}),
      dictionary: this.state.dictionary.version,
      epoch: this.state.queryEpoch,
      minute: ["now", "staff_now"].includes(request.scope.filters.opening)
        ? Math.floor(this.now.getTime() / 60000)
        : null,
    }

    return {
      schemaVersion: 1,
      dictionaryVersion: this.state.dictionary.version,
      fingerprint: createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex"),
      queryEpoch: this.state.queryEpoch,
      indexedThrough: this.state.indexedThrough,
      evaluatedAt: this.now.toISOString(),
    }
  }

  private total(result: AtlasSearchResult): number {
    return atlasExactTotal(result, this.state.canonicalLocale)
  }

  async count(scope: AtlasScope): Promise<number> {
    return this.total(
      await this.backend.search({
        filter: this.filter(scope),
        limit: 0,
        facets: ["locale"],
      })
    )
  }

  async perCapita(
    request: Extract<AtlasQueryRequest, { purpose: "perCapita" }>,
    includeMobile = false
  ): Promise<AtlasPerCapitaResponse> {
    // Numerator and denominator both cover whole countries, regardless of camera.
    // Legacy comparisons exclude mobile services; Library access counts each depot once.
    const eligible = includeMobile
      ? 'status != "planned"'
      : 'type_group != "mobile" AND status != "planned"'
    const countryCounts = async (scope: AtlasScope) => {
      const filter = `${this.filter(scope, "listed", false, includeMobile)} AND ${eligible}`
      const [result, missing] = await Promise.all([
        this.backend.search({
          filter,
          limit: 0,
          facets: ["locale", "country_id"],
        }),
        this.backend.search({
          filter: `${filter} AND (country_id IS NULL OR country_id NOT EXISTS)`,
          limit: 0,
          facets: ["locale"],
        }),
      ])
      const total = this.total(result),
        missingCount = this.total(missing)
      const counts = result.facetDistribution?.country_id ?? {}
      if (
        Object.values(counts).some((n) => !Number.isSafeInteger(n) || n < 0) ||
        Object.values(counts).reduce((sum, n) => sum + n, 0) + missingCount !==
          total
      )
        throw new Error("Incomplete Atlas country counts")

      return { counts, total, missing: missingCount }
    }
    const [filtered, indexed, catalogue] = await Promise.all([
      countryCounts(request.scope),
      countryCounts({
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      }),
      this.backend.bridge("/api/atlas/countries"),
    ])
    if (
      !Array.isArray(catalogue.countries) ||
      catalogue.countries.length > ATLAS_LIMITS.facetValues
    )
      throw new Error("Invalid Atlas country catalogue")
    if (
      !Array.isArray(catalogue.observations) ||
      catalogue.observations.length === 0 ||
      catalogue.observations.length > 512 ||
      typeof catalogue.populationVersion !== "string"
    )
      throw new Error("Atlas population import is not ready")
    const observations = catalogue.observations as PopulationObservation[]
    const populations = new Map<string, PopulationObservation>()
    for (const observation of observations) {
      if (
        populations.has(observation.reportingCode) ||
        !/^[A-Z]{3}$/.test(observation.reportingCode) ||
        observation.level !== "country" ||
        observation.year !== POPULATION_REFERENCE_YEAR ||
        (observation.population !== null &&
          (!Number.isSafeInteger(observation.population) ||
            observation.population <= 0)) ||
        !Number.isFinite(Date.parse(observation.retrievedAt))
      )
        throw new Error("Invalid Atlas population observation")
      populations.set(observation.reportingCode, observation)
    }
    const byIso3 = new Map(
      atlasPopulationBaseline.countries.map((country) => [
        country.iso3,
        country,
      ])
    )
    const join = new Map<string, string>()
    const identities = new Set<string>()
    for (const country of catalogue.countries) {
      if (
        typeof country.documentId !== "string" ||
        identities.has(country.documentId)
      )
        throw new Error("Invalid Atlas country identity")
      identities.add(country.documentId)
      // Country pages may use newer, differently scoped population estimates.
      // This fixed-year comparison joins ISO identities to its own observations.
      const code = populationCountryCode(country, COUNTRY_IDENTITIES)?.code
      if (code && byIso3.has(code)) join.set(country.documentId, code)
    }
    const sum = (counts: Record<string, number>) => {
      const result = new Map<string, number>()
      for (const [id, n] of Object.entries(counts)) {
        const iso3 = join.get(id)
        if (iso3) result.set(iso3, (result.get(iso3) ?? 0) + n)
      }

      return result
    }
    const matched = sum(filtered.counts),
      base = sum(indexed.counts)
    const countries = atlasPopulationBaseline.countries.map((country) =>
      atlasPerCapitaCountry(
        {
          ...country,
          population: populations.get(country.iso3)?.population ?? null,
        },
        matched.get(country.iso3) ?? 0,
        base.get(country.iso3) ?? 0
      )
    )
    const { countries: _countries, ...baseline } = atlasPopulationBaseline
    const tiles = this.state.manifest?.countryTiles

    return {
      ...this.metadata(request),
      scope: request.scope,
      baseline: {
        ...baseline,
        year: POPULATION_REFERENCE_YEAR,
        populationVersion: catalogue.populationVersion,
        retrievedAt: observations
          .map((row) => row.retrievedAt)
          .sort()
          .at(-1)!,
        populationSource: observations[0]!.source,
        populationUrl: observations[0]!.sourceUrl,
        populationLicence: observations[0]!.licence,
      },
      countries,
      geometry:
        tiles?.version === baseline.version
          ? { type: "pmtiles", url: tiles.url }
          : { type: "geojson", url: baseline.geometryUrl },
      exactTotal: filtered.total,
      unmappedLibraries:
        filtered.total - [...matched.values()].reduce((a, b) => a + b, 0),
      summary: atlasPerCapitaSummary(countries),
    }
  }

  async libraryAccess(
    request: Extract<AtlasQueryRequest, { purpose: "libraryAccess" }>
  ): Promise<AtlasLibraryAccessResponse> {
    const all = `locale = ${JSON.stringify(this.state.canonicalLocale)}`
    const [current, assigned] = await Promise.all([
      this.backend.search({ filter: all, limit: 0, facets: ["locale"] }),
      this.backend.search({
        filter: `${all} AND local_area_version = ${JSON.stringify(atlasLocalGeography.version)}`,
        limit: 0,
        facets: ["locale"],
      }),
    ])
    if (this.total(current) !== this.total(assigned))
      throw new Error(
        "Library access geography is updating. Please retry shortly."
      )
    if (request.level === "countries") {
      const response = await this.perCapita(
        { ...request, purpose: "perCapita" },
        true
      )
      const { countries, ...comparison } = response

      return {
        ...comparison,
        level: "countries",
        geometry: { ...response.geometry, property: "iso3" },
        areas: countries.map((area) => ({
          ...area,
          id: area.iso3,
          country: area.iso3,
          level: "countries",
          populationYear: response.baseline.year,
          populationSource: response.baseline.populationSource,
          populationSourceUrl: response.baseline.populationUrl,
          populationLicence: response.baseline.populationLicence,
          populationRetrievedAt: response.baseline.retrievedAt,
          peoplePerLibrary:
            area.status === "available"
              ? atlasPeoplePerLibrary(area.libraryCount, area.population)
              : null,
        })),
        coverage: {
          countries: atlasLocalGeography.countries,
          note: "Country comparison worldwide. Local-area comparison currently covers UK districts.",
        },
      }
    }
    const [catalogue, countryCatalogue] = await Promise.all([
      this.backend.bridge("/api/atlas/population/local"),
      this.backend.bridge("/api/atlas/countries"),
    ])
    if (
      catalogue.geography?.version !== atlasLocalGeography.version ||
      !Array.isArray(catalogue.observations) ||
      catalogue.observations.length !== atlasLocalGeography.areas.length
    )
      throw new Error("Local population and boundary versions disagree")
    const observations = new Map<string, any>()
    for (const row of catalogue.observations) {
      if (
        observations.has(row.reportingCode) ||
        row.boundaryVersion !== atlasLocalGeography.version ||
        row.year !== POPULATION_REFERENCE_YEAR ||
        !Number.isSafeInteger(row.population) ||
        row.population <= 0
      )
        throw new Error("Invalid local population observation")
      observations.set(row.reportingCode, row)
    }
    const countryIds = countryCatalogue.countries
      .filter(
        (country: any) =>
          populationCountryCode(country, COUNTRY_IDENTITIES)?.code === "GBR"
      )
      .map((country: any) => country.documentId)
    const codes = atlasLocalGeography.areas.map((area) => area.code)
    const count = async (scope: AtlasScope) => {
      const filter = `${this.filter(scope, "listed", false, true)} AND status != "planned" AND (local_area_code IN ${JSON.stringify(codes)} OR country_id IN ${JSON.stringify(countryIds)})`
      const [result, missing] = await Promise.all([
        this.backend.search({
          filter,
          limit: 0,
          facets: ["locale", "local_area_code"],
        }),
        this.backend.search({
          filter: `${filter} AND local_area_code IS NULL`,
          limit: 0,
          facets: ["locale"],
        }),
      ])
      const counts = result.facetDistribution?.local_area_code ?? {},
        total = this.total(result),
        unassigned = this.total(missing)
      if (
        Object.keys(counts).some((code) => !codes.includes(code)) ||
        Object.values(counts).some((n) => !Number.isSafeInteger(n) || n < 0) ||
        Object.values(counts).reduce((a, b) => a + b, 0) + unassigned !== total
      )
        throw new Error("Incomplete local-area library counts")

      return { counts, total, unassigned }
    }
    const [filtered, indexed] = await Promise.all([
      count(request.scope),
      count({
        filters: emptyAtlasFilters(),
        accessibility: { enabled: false, selected: [], view: "matches" },
      }),
    ])
    const areas = atlasLocalGeography.areas.map((area) => {
      const observation = observations.get(area.code)
      if (!observation) throw new Error("Missing local population observation")
      const value = atlasPerCapitaCountry(
        {
          iso3: area.code,
          iso2: "GB",
          name: area.name,
          population: observation.population,
          featureId: null,
          bounds: area.bounds,
        },
        filtered.counts[area.code] ?? 0,
        indexed.counts[area.code] ?? 0
      )

      return {
        ...value,
        id: area.code,
        level: "local" as const,
        country: area.country,
        populationYear: observation.year,
        populationSource: observation.source,
        populationSourceUrl: observation.sourceUrl,
        populationLicence: observation.licence,
        populationRetrievedAt: observation.retrievedAt,
        peoplePerLibrary:
          value.status === "available"
            ? atlasPeoplePerLibrary(value.libraryCount, value.population)
            : null,
      }
    })
    const first = catalogue.observations[0],
      { countries: _countries, ...baseline } = atlasPopulationBaseline

    return {
      ...this.metadata(request),
      scope: request.scope,
      level: "local",
      areas,
      baseline: {
        ...baseline,
        version: atlasLocalGeography.version,
        populationVersion: catalogue.populationVersion,
        year: POPULATION_REFERENCE_YEAR,
        populationSource: first.source,
        populationUrl: first.sourceUrl,
        populationLicence: first.licence,
        retrievedAt: catalogue.observations
          .map((row: any) => row.retrievedAt)
          .sort()
          .at(-1),
        boundarySource: atlasLocalGeography.boundarySource,
        boundaryUrl: atlasLocalGeography.boundaryUrl,
        boundaryLicence: atlasLocalGeography.boundaryLicence,
        geometryUrl: atlasLocalGeography.geometryUrl,
      },
      geometry: {
        type: "geojson",
        url: atlasLocalGeography.geometryUrl,
        property: "code",
      },
      exactTotal: filtered.total,
      unmappedLibraries: filtered.unassigned,
      summary: atlasPerCapitaSummary(areas),
      coverage: {
        countries: ["GBR"],
        note: "361 UK local authority districts on December 2023 boundaries. Other countries do not yet have local comparisons.",
      },
    }
  }

  private async many<T>(
    items: T[],
    operation: (item: T) => Promise<any>,
    concurrency = 12
  ): Promise<any[]> {
    let next = 0
    const results = Array.from({ length: items.length })
    await Promise.all(
      Array.from({ length: Math.min(concurrency, items.length) }, async () => {
        while (next < items.length) {
          const position = next++
          results[position] = await operation(items[position]!)
        }
      })
    )

    return results
  }

  private async cellQuery(
    scope: AtlasScope,
    population: AtlasPopulation,
    field: string,
    extra = "",
    ignoreAccessView = false
  ): Promise<AtlasSearchResult> {
    return this.backend.search({
      filter: `${this.filter(scope, population, ignoreAccessView)}${extra ? ` AND ${extra}` : ""}`,
      limit: 0,
      facets: ["locale", field],
    })
  }

  private cellCounts(
    result: AtlasSearchResult,
    field: string,
    allowed: Set<string>
  ): Record<string, number> {
    const counts = result.facetDistribution?.[field] ?? {}
    if (
      Object.entries(counts).some(
        ([id, n]) => !allowed.has(id) || !Number.isSafeInteger(n) || n < 0
      ) ||
      Object.values(counts).reduce((sum, n) => sum + n, 0) !==
        this.total(result)
    )
      throw new Error("Incomplete Atlas cell facet")

    return counts
  }

  private async densityGrid(
    scope: AtlasScope,
    population: AtlasPopulation,
    cameraZoom: number,
    expectedTotal: number
  ): Promise<AtlasDensityGrid> {
    // A 512-pixel world at zoom zero: aim for cells no wider than 16 pixels.
    // Unlike pin queries, only occupied cells count towards the density budget.
    const target = Math.min(ATLAS_LIMITS.maxCellZoom, Math.ceil(cameraZoom + 5))
    const ranges = atlasBoundsRanges(scope.bbox!)
    for (let zoom = target; zoom >= 0; zoom--) {
      const field = `atlas_cell_${zoom}`
      const result = await this.cellQuery(scope, population, field)
      if (this.total(result) !== expectedTotal)
        throw new Error("Concurrent Atlas density population changed; retry")
      const counts = result.facetDistribution?.[field] ?? {}
      if (Object.values(counts).some((n) => !Number.isSafeInteger(n) || n <= 0))
        throw new Error("Invalid Atlas density counts")
      if (
        Object.keys(counts).length > ATLAS_LIMITS.densityCells ||
        Object.values(counts).reduce((sum, n) => sum + n, 0) !== expectedTotal
      )
        continue
      const cells = Object.entries(counts).map(([id, total]) => {
        const cell = atlasCell(id)
        if (
          !id.startsWith(`${zoom}/`) ||
          !ranges.some(
            (range) =>
              cell.bounds.west <= range.east &&
              cell.bounds.east >= range.west &&
              cell.bounds.south <= range.north &&
              cell.bounds.north >= range.south
          )
        )
          throw new Error("Invalid Atlas density geography")

        return { id, total }
      })

      return { cells }
    }
    throw new Error("Complete Atlas density unavailable")
  }

  private async aggregate(
    scope: AtlasScope,
    population: AtlasPopulation,
    quality: boolean,
    densityZoom?: number
  ): Promise<AtlasViewportPopulation> {
    const selected = atlasAggregation(scope.bbox!)
    for (let zoom = selected.zoom; zoom >= 0; zoom--) {
      const cells = atlasCellsForBounds(scope.bbox!, zoom).cells,
        allowed = new Set(cells.map((cell) => cell.id)),
        field = `atlas_cell_${zoom}`
      try {
        const result = await this.cellQuery(scope, population, field),
          counts = this.cellCounts(result, field, allowed)
        let access: Record<string, number>[] | null = null,
          bins: Record<string, number>[] | null = null
        if (population === "listed" && scope.accessibility.enabled) {
          const resolved = atlasResolveScope(scope, this.state.dictionary)
          const extra = [
            "",
            atlasAccessFilter(resolved),
            atlasAccessFilter(resolved, "any"),
          ]
          access = await this.many(
            extra,
            async (predicate) =>
              this.cellCounts(
                await this.cellQuery(scope, population, field, predicate, true),
                field,
                allowed
              ),
            3
          )
        }
        if (quality && population !== "closures")
          bins = await this.many(
            [
              "completeness IS NULL",
              "completeness >= 0 AND completeness < 50",
              "completeness >= 50 AND completeness < 80",
              "completeness >= 80",
            ],
            async (predicate) =>
              this.cellCounts(
                await this.cellQuery(scope, population, field, predicate),
                field,
                allowed
              ),
            4
          )
        // Facets supply exact counts without downloading the catalogue. Fetch
        // one stable matching record per occupied cell so markers cannot drift to
        // artificial tile centres (often offshore). The shared search pool
        // bounds concurrency; at most 1,024 records are retrieved per population.
        const occupied = cells.filter((cell) => counts[cell.id])
        const [anchors, density] = await Promise.all([
          this.many(occupied, async (cell) => {
            const rows = await this.backend.search({
              filter: `${this.filter(scope, population)} AND ${field} = ${JSON.stringify(cell.id)}`,
              sort: ["atlas_id:asc"],
              limit: 1,
              facets: ["locale"],
              attributesToRetrieve:
                counts[cell.id] === 1
                  ? POINT_FIELDS
                  : ["latitude", "longitude"],
            })
            if (rows.hits.length !== 1 || this.total(rows) !== counts[cell.id])
              throw new Error("Concurrent Atlas cell population changed; retry")

            return rows.hits[0]!
          }),
          densityZoom === undefined
            ? undefined
            : this.densityGrid(
                scope,
                population,
                densityZoom,
                this.total(result)
              ),
        ])
        const values: AtlasAggregateCell[] = occupied.map((cell, index) => {
          const total = counts[cell.id] ?? 0
          const anchor = anchors[index] as AtlasProjection
          const completeness = bins
            ? {
                unknown: bins[0]![cell.id] ?? 0,
                low: bins[1]![cell.id] ?? 0,
                medium: bins[2]![cell.id] ?? 0,
                high: bins[3]![cell.id] ?? 0,
              }
            : undefined
          if (
            completeness &&
            Object.values(completeness).reduce((sum, n) => sum + n, 0) !== total
          )
            throw new Error("Concurrent Atlas completeness changed; retry")

          return {
            ...cell,
            centre: { lat: anchor.latitude, lng: anchor.longitude },
            total,
            ...(total === 1 ? { point: atlasPoint(anchor) } : {}),
            ...(access
              ? {
                  coverage: coverage(
                    access[0]![cell.id] ?? 0,
                    access[1]![cell.id] ?? 0,
                    access[2]![cell.id] ?? 0
                  ),
                }
              : {}),
            ...(completeness ? { completeness } : {}),
          }
        })

        return {
          mode: "aggregate",
          exactTotal: this.total(result),
          complete: true,
          cells: values,
          ...(density ? { density } : {}),
        }
      } catch (error) {
        if (
          zoom === 0 ||
          !(error instanceof Error && /facet|Concurrent/.test(error.message))
        )
          throw error
      }
    }
    throw new Error("Atlas aggregates unavailable")
  }

  private async libraryDensity(
    request: Extract<AtlasQueryRequest, { purpose: "viewport" }>,
    exactTotal: number
  ): Promise<AtlasLibraryDensity> {
    const settings = request.libraryDensity!
    const requestedResolution = atlasDensityResolution(
      request.zoom,
      settings.detail
    )
    const base = { exactTotal, requestedResolution, coarsened: false }
    const manifest = this.state.manifest
    const f = request.scope.filters
    // Aggregates cannot use the point journal overlay: removals and moved
    // records must subtract from the old cells. Use a prepared surface only
    // when its stable snapshot still exactly matches the indexed generation.
    if (
      request.drawingPreference === "auto" &&
      settings.detail === "auto" &&
      settings.scale === "fixed" &&
      manifest?.densityTiles?.version === 1 &&
      manifest.sourceStartRevision === manifest.sourceEndRevision &&
      manifest.sourceEndRevision === this.state.indexedThrough &&
      manifest.builtAgainstQueryEpoch === this.state.queryEpoch &&
      manifest.dictionaryVersion === this.state.dictionary.version &&
      manifest.canonicalLocale === this.state.canonicalLocale &&
      !request.scope.place &&
      !request.scope.accessibility.enabled &&
      !f.types.length &&
      !f.operators.length &&
      !f.facilities.length &&
      !f.networks?.length &&
      f.opening === "any" &&
      !f.events &&
      !f.catalogue &&
      !f.founded
    ) {
      return {
        ...base,
        mode: "tiles",
        resolution: requestedResolution,
        cells: [],
        archive: manifest.densityTiles,
      }
    }
    for (let resolution = requestedResolution; resolution >= 0; resolution--) {
      const scope = {
        ...request.scope,
        bbox: atlasDensityBounds(request.scope.bbox!, resolution),
      }
      const field = `atlas_cell_${resolution}`
      let result: AtlasSearchResult
      try {
        result = await this.cellQuery(scope, "listed", field)
      } catch (error) {
        // During an additive index rollout, older indexes still have the
        // original z0..12 fields. They remain a complete, labelled fallback.
        if (resolution <= ATLAS_LIMITS.maxCellZoom) throw error
        result = await this.backend.search({
          filter: this.filter(scope),
          limit: 0,
          facets: ["locale"],
        })
      }
      const total = this.total(result)
      let cells = Object.entries(result.facetDistribution?.[field] ?? {}).map(
        ([id, total]) => ({ id, total })
      )
      if (total <= ATLAS_LIMITS.points) {
        const rows = await this.backend.search({
          filter: this.filter(scope),
          limit: ATLAS_LIMITS.points,
          facets: ["locale"],
          attributesToRetrieve: ["latitude", "longitude"],
        })
        if (this.total(rows) !== total || rows.hits.length !== total)
          throw new Error("Concurrent Atlas density population changed; retry")
        cells = atlasDensityCounts(
          rows.hits.map((row) => ({ lat: row.latitude, lng: row.longitude })),
          resolution
        )
      }
      if (
        cells.some(
          (cell) => !Number.isSafeInteger(cell.total) || cell.total <= 0
        )
      )
        throw new Error("Invalid library density count")
      if (
        cells.length > ATLAS_LIMITS.densityCells ||
        cells.reduce((sum, cell) => sum + cell.total, 0) !== total
      )
        continue
      for (const cell of cells) {
        const parsed = atlasCell(cell.id)
        if (
          !cell.id.startsWith(`${resolution}/`) ||
          atlasCellId(parsed.centre, resolution) !== cell.id ||
          !atlasBoundsRanges(scope.bbox).some(
            (b) =>
              parsed.bounds.west <= b.east &&
              parsed.bounds.east >= b.west &&
              parsed.bounds.south <= b.north &&
              parsed.bounds.north >= b.south
          )
        )
          throw new Error("Invalid library density geography")
      }
      const ranges = atlasBoundsRanges(request.scope.bbox!)
      const maxPer100Km2 = cells.reduce((max, cell) => {
        const value = atlasDensityCell(cell.id, cell.total)

        return ranges.some(
          (b) =>
            value.bounds.west < b.east &&
            value.bounds.east > b.west &&
            value.bounds.south < b.north &&
            value.bounds.north > b.south
        )
          ? Math.max(max, value.per100Km2)
          : max
      }, 0)

      return {
        ...base,
        mode: "cells",
        resolution,
        coarsened: resolution !== requestedResolution,
        cells,
        maxPer100Km2,
      }
    }
    throw new Error("Complete library density unavailable")
  }

  async viewport(
    request: Extract<AtlasQueryRequest, { purpose: "viewport" }>
  ): Promise<AtlasViewportResponse> {
    const manifest = this.state.manifest
    const detail = manifest?.detailZoom ?? 10
    const populations: AtlasViewportResponse["populations"] = {}
    for (const population of request.populations) {
      const densityZoom =
        request.density &&
        request.zoom < 12 &&
        (population === "listed" || population === "events")
          ? request.zoom
          : undefined
      const body = {
        filter: this.filter(request.scope, population),
        facets: ["locale"],
      }
      const observed = await this.backend.search({ ...body, limit: 0 }),
        total = this.total(observed)
      if (
        request.drawingPreference === "auto" &&
        process.env.ATLAS_GEOMETRY_MODE !== "current" &&
        request.scope.filters.opening === "any" &&
        manifest &&
        request.archiveBuildId === manifest.buildId &&
        manifest.builtAgainstQueryEpoch === this.state.queryEpoch &&
        manifest.canonicalLocale === this.state.canonicalLocale &&
        BigInt(this.state.journalFloor) <=
          BigInt(manifest.sourceStartRevision) &&
        BigInt(this.state.indexedThrough) >=
          BigInt(manifest.sourceEndRevision) &&
        request.zoom >= detail &&
        total <= ATLAS_LIMITS.points
      ) {
        populations[population] = {
          mode: "tiles",
          exactTotal: total,
          complete: true,
          archiveBuildId: manifest.buildId,
        }
        continue
      }
      if (total > ATLAS_LIMITS.points) {
        populations[population] = await this.aggregate(
          request.scope,
          population,
          request.quality === true,
          densityZoom
        )
        continue
      }
      const rows = await this.backend.search({
        ...body,
        limit: ATLAS_LIMITS.points,
        attributesToRetrieve: POINT_FIELDS,
      })
      if (rows.hits.length !== this.total(rows))
        throw new Error("Atlas point population changed; retry")
      const points = rows.hits.map(atlasPoint)
      if (Buffer.byteLength(JSON.stringify(points)) > GEOMETRY_BYTES) {
        populations[population] = await this.aggregate(
          request.scope,
          population,
          request.quality === true,
          densityZoom
        )
        continue
      }
      // Tile use is a later provider decision after this same viewport receives
      // a complete journal generation. Current mode is always a safe fallback.
      populations[population] = {
        mode: "points",
        exactTotal: points.length,
        complete: true,
        points,
      }
    }
    let summary: AtlasCoverage | undefined
    if (request.scope.accessibility.enabled) {
      const resolved = atlasResolveScope(request.scope, this.state.dictionary),
        base = this.filter(request.scope, "listed", true)
      const counts = await this.many(
        [
          base,
          `${base} AND ${atlasAccessFilter(resolved)}`,
          `${base} AND ${atlasAccessFilter(resolved, "any")}`,
        ],
        async (filter) =>
          this.total(
            await this.backend.search({ filter, limit: 0, facets: ["locale"] })
          ),
        3
      )
      summary = coverage(counts[0], counts[1], counts[2])
    }

    return {
      ...this.metadata(request),
      populations,
      ...(request.libraryDensity
        ? {
            libraryDensity: await this.libraryDensity(
              request,
              populations.listed?.exactTotal ??
                (await this.count(request.scope))
            ),
          }
        : {}),
      ...(summary ? { coverage: summary } : {}),
    }
  }

  async counts(
    request: Extract<AtlasQueryRequest, { purpose: "counts" }>
  ): Promise<AtlasCountsResponse> {
    const scope = world(request.scope),
      global: AtlasScope = { ...scope, filters: discoveryFilters(scope) }
    const inventory = await this.backend.search({
      filter: this.filter(global),
      facets: ["locale", "facility_codes", "type_group", "operator_group"],
      limit: 0,
    })
    const codes = inventory.facetDistribution?.facility_codes ?? {}
    if (Object.keys(codes).length >= ATLAS_LIMITS.facetValues)
      throw new Error(
        "Atlas facility inventory needs a larger validated facet budget"
      )
    const available = new Set(
      this.state.dictionary.entries
        .filter((entry) => codes[entry.code])
        .map((entry) => entry.name)
    )
    const options = [...available]
      .filter(
        (name) =>
          fold(name).includes(fold(request.facilityQuery ?? "")) &&
          (!request.facilityAfter || name > request.facilityAfter)
      )
      .sort()
    const shown = [
      ...new Set([...options.slice(0, 50), ...scope.filters.facilities]),
    ]
    const accessNames = [
      ...new Set([
        ...this.state.dictionary.entries
          .filter((entry) => entry.kind === "access" && codes[entry.code])
          .map((entry) => entry.name),
        ...scope.accessibility.selected,
      ]),
    ].sort()
    const presets: { label: string; patch: Partial<AtlasScope["filters"]> }[] =
      [
        { label: "Open now", patch: { opening: "now" } },
        {
          label: "Open on Sundays",
          patch: { opening: "at", atDay: 6, atMinutes: 720 },
        },
        {
          label: "Community-run libraries",
          patch: { operators: ["community"] },
        },
        { label: "Live catalogue", patch: { catalogue: true } },
        { label: "Monastic libraries", patch: { types: ["monastic"] } },
        { label: "Academic libraries", patch: { types: ["academic"] } },
      ]
    const types = Object.keys(ATLAS_TYPE_GROUPS).filter(
      (type) =>
        inventory.facetDistribution?.type_group?.[type] ||
        scope.filters.types.includes(type as any)
    )
    const operators = Object.keys(ATLAS_OPERATOR_GROUPS).filter(
      (operator) =>
        inventory.facetDistribution?.operator_group?.[operator] ||
        scope.filters.operators.includes(operator as any)
    )
    const patched = async (patch: Partial<AtlasScope["filters"]>) =>
      this.count({ ...scope, filters: { ...scope.filters, ...patch } })
    const [
      exactTotal,
      typeCounts,
      operatorCounts,
      facilityCounts,
      events,
      catalogue,
      oldest,
      accessCounts,
      presetCounts,
    ] = await Promise.all([
      this.count(scope),
      this.many(types, (type) => patched({ types: [type as any] })),
      this.many(operators, (operator) =>
        patched({ operators: [operator as any] })
      ),
      this.many(shown, (name) =>
        patched({
          facilities: scope.filters.facilities.includes(name)
            ? scope.filters.facilities
            : [...scope.filters.facilities, name],
        })
      ),
      patched({ events: true }),
      patched({ catalogue: true }),
      this.backend.search({
        filter: `${this.filter(global)} AND founded IS NOT NULL`,
        sort: ["founded:asc", "atlas_id:asc"],
        limit: 1,
        attributesToRetrieve: ["founded"],
      }),
      this.many(accessNames, (name) =>
        this.count({
          ...scope,
          accessibility: { enabled: true, selected: [name], view: "matches" },
        })
      ),
      this.many(presets, (preset) =>
        preset.patch.opening === "now" &&
        (this.state.indexedThrough !== this.state.projectionRevision ||
          (this.state.clockDue &&
            Date.parse(this.state.clockDue) <= this.now.getTime()))
          ? Promise.resolve(null)
          : patched(preset.patch)
      ),
    ])

    return {
      ...this.metadata(request),
      exactTotal,
      typeGroups: Object.fromEntries(
        types.map((type, i) => [type, typeCounts[i]])
      ),
      operatorGroups: Object.fromEntries(
        operators.map((operator, i) => [operator, operatorCounts[i]])
      ),
      facilities: shown.map((name, i) => ({ name, count: facilityCounts[i] })),
      accessibility: accessNames.map((name, i) => ({
        name,
        count: accessCounts[i],
      })),
      presets: presets
        .flatMap((preset, i) =>
          presetCounts[i] > 0
            ? [{ ...preset, exactTotal: presetCounts[i] }]
            : []
        )
        .slice(0, 5),
      events,
      catalogue,
      foundedRange:
        oldest.hits[0]?.founded === null ||
        oldest.hits[0]?.founded === undefined
          ? null
          : [oldest.hits[0].founded, this.now.getFullYear()],
      facilitiesHasMore: options.length > 50,
      ...(options.length > 50 ? { facilitiesNext: options[49]! } : {}),
    }
  }

  async suggestions(
    request: Extract<AtlasQueryRequest, { purpose: "suggestions" }>
  ): Promise<AtlasSuggestionsResponse> {
    const scope = world(request.scope),
      f = scope.filters,
      patches: Partial<typeof f>[] = []
    if (f.opening !== "any") patches.push({ opening: "any" })
    if (f.types.length) patches.push({ types: [] })
    if (f.operators.length) patches.push({ operators: [] })
    for (const name of f.facilities)
      patches.push({
        facilities: f.facilities.filter((selected) => selected !== name),
      })
    if (f.events) patches.push({ events: false })
    if (f.catalogue) patches.push({ catalogue: false })
    if (f.founded) patches.push({ founded: null })
    const exactTotal = await this.count(scope)
    const values = await this.many(patches, async (patch) => ({
      patch,
      exactTotal: await this.count({ ...scope, filters: { ...f, ...patch } }),
    }))
    const suggestions = values
      .filter((value) => value.exactTotal > exactTotal)
      .sort((a, b) => b.exactTotal - a.exactTotal)
      .slice(0, 3)

    return { ...this.metadata(request), exactTotal, suggestions }
  }

  async list(
    request: Extract<AtlasQueryRequest, { purpose: "list" }>
  ): Promise<AtlasListResponse> {
    const metadata = this.metadata(request),
      distance = request.sort === "distance",
      field = request.sort.startsWith("place")
        ? "place_sort"
        : request.sort.startsWith("record")
          ? "completeness"
          : "name_sort",
      descending = request.sort.endsWith("_desc")
    let filter = this.filter(request.scope)
    if (request.cursor) {
      const cursor = readAtlasCursor(
        request.cursor,
        {
          fingerprint: metadata.fingerprint,
          queryEpoch: metadata.queryEpoch,
          dictionaryVersion: metadata.dictionaryVersion,
          sort: request.sort as AtlasCursorPayload["sort"],
        },
        this.now
      )
      filter += ` AND ${atlasKeysetFilter(field, cursor.lastKey, cursor.lastId, descending)}`
    }
    const page = request.page ?? 0,
      offset = distance ? page * ATLAS_LIMITS.listRows : 0
    const result = await this.backend.search({
      filter,
      sort: distance
        ? [
            `_geoPoint(${request.centre.lat},${atlasLongitude(request.centre.lng)}):asc`,
            "atlas_id:asc",
          ]
        : [`${field}:${descending ? "desc" : "asc"}`, "atlas_id:asc"],
      limit: Math.min(
        ATLAS_LIMITS.listRows + 1,
        ATLAS_LIMITS.reachableDistanceRows - offset
      ),
      offset,
      facets: ["locale"],
      attributesToRetrieve: LIST_FIELDS,
    })
    // A keyset predicate limits the page, so total is measured on the original
    // scope separately; the hit-window estimate is never used as a count.
    const exactTotal = request.cursor
        ? await this.count(request.scope)
        : this.total(result),
      reachableTotal = distance
        ? Math.min(exactTotal, ATLAS_LIMITS.reachableDistanceRows)
        : exactTotal
    const rows = result.hits
        .slice(0, ATLAS_LIMITS.listRows)
        .map((row) =>
          atlasListRow(
            row,
            this.state.dictionary,
            this.now,
            this.state.indexedThrough === this.state.projectionRevision &&
              (!this.state.clockDue ||
                Date.parse(this.state.clockDue) > this.now.getTime())
          )
        ),
      hasMore = distance
        ? offset + rows.length < reachableTotal
        : result.hits.length > ATLAS_LIMITS.listRows
    const last =
      result.hits[Math.min(result.hits.length, ATLAS_LIMITS.listRows) - 1]
    const nextCursor =
      !distance && hasMore && last
        ? signAtlasCursor({
            schemaVersion: 1,
            fingerprint: metadata.fingerprint,
            queryEpoch: metadata.queryEpoch,
            dictionaryVersion: metadata.dictionaryVersion,
            sort: request.sort as AtlasCursorPayload["sort"],
            lastKey: last[field] ?? null,
            lastId: last.atlas_id,
            evaluatedAt: metadata.evaluatedAt,
            expiresAt: new Date(
              this.now.getTime() + ATLAS_LIMITS.cursorSeconds * 1000
            ).toISOString(),
          })
        : undefined

    return {
      ...metadata,
      rows,
      exactTotal,
      reachableTotal,
      hasMore,
      ...(nextCursor ? { nextCursor } : {}),
      ...(distance && hasMore ? { nextPage: page + 1 } : {}),
    }
  }

  async extent(
    request: Extract<AtlasQueryRequest, { purpose: "extent" }>
  ): Promise<AtlasExtentResponse> {
    const filter = this.filter(request.scope),
      total = await this.count(request.scope)
    if (!total)
      return { ...this.metadata(request), exactTotal: 0, bounds: null }
    const cut = atlasLongitude(request.centre.lng - 180)
    const extrema = await this.many(
      [
        { field: "latitude", direction: "asc", extra: "" },
        { field: "latitude", direction: "desc", extra: "" },
        ...["asc", "desc"].flatMap((direction) => [
          { field: "longitude", direction, extra: `longitude >= ${cut}` },
          { field: "longitude", direction, extra: `longitude < ${cut}` },
        ]),
      ],
      (item) =>
        this.backend.search({
          filter: `${filter}${item.extra ? ` AND ${item.extra}` : ""}`,
          sort: [`${item.field}:${item.direction}`, "atlas_id:asc"],
          limit: 1,
          attributesToRetrieve: ["latitude", "longitude"],
        }),
      6
    )
    const longitudes = extrema
      .slice(2)
      .flatMap((result) =>
        result.hits.map((row: AtlasProjection) =>
          row.longitude < cut ? row.longitude + 360 : row.longitude
        )
      )
    if (!extrema[0]?.hits[0] || !extrema[1]?.hits[0] || !longitudes.length)
      throw new Error("Atlas extent changed; retry")

    return {
      ...this.metadata(request),
      exactTotal: total,
      bounds: {
        south: extrema[0].hits[0].latitude,
        north: extrema[1].hits[0].latitude,
        west: Math.min(...longitudes),
        east: Math.max(...longitudes),
      },
    }
  }

  async search(
    request: Extract<AtlasQueryRequest, { purpose: "search" }>
  ): Promise<AtlasSearchResponse> {
    const scope = world(request.scope)
    const libraries = await this.backend.search({
      q: request.q,
      filter: this.filter(scope),
      limit: 12,
      attributesToRetrieve: LIST_FIELDS,
    })
    // Distinct is per search, so library hits/facets remain undeduplicated.
    // Dense places must not crowd every other place out of a library sample.
    const places = await this.many(
      [
        ["country", "country_id", "country_name"],
        ["region", "region_id", "region_name"],
        ["city", "city_key", "city"],
      ] as const,
      async ([level, idField, nameField]) => {
        const result = await this.backend.search({
          q: request.q,
          attributesToSearchOn: [nameField],
          distinct: idField,
          filter: this.filter({ ...scope, filters: discoveryFilters(scope) }),
          limit: 12,
          attributesToRetrieve: [idField, nameField],
        })

        return result.hits.flatMap((row) => {
          const id = row[idField],
            name = row[nameField]

          return id && name ? [{ level, id, name }] : []
        })
      },
      3
    )
    const matched = places
      .flat()
      .sort(
        (a, b) =>
          Number(!fold(a.name).startsWith(fold(request.q))) -
            Number(!fold(b.name).startsWith(fold(request.q))) ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 12)
    const results = await this.many(
      matched,
      async (place) => ({
        ...place,
        exactTotal: await this.count({
          ...scope,
          filters: discoveryFilters(scope),
          place: { level: place.level, id: place.id },
        }),
      }),
      6
    )

    return {
      ...this.metadata(request),
      libraries: libraries.hits.map((row) =>
        atlasListRow(
          row,
          this.state.dictionary,
          this.now,
          this.state.indexedThrough === this.state.projectionRevision &&
            (!this.state.clockDue ||
              Date.parse(this.state.clockDue) > this.now.getTime())
        )
      ),
      places: results,
      stops: [],
    }
  }

  async execute(request: AtlasQueryRequest): Promise<AtlasQueryResponse> {
    return this[request.purpose](request as never)
  }
}
