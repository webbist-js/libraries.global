import {
  atlasReachDistribution,
  type AtlasNetworkReachResult,
} from "@repo/shared-data"

const csvQuote = (v: unknown) => {
  const value = String(v ?? "")

  return `"${(/^\s*[=+\-@]/.test(value) ? "'" : "") + value.replaceAll('"', '""')}"`
}

export function buildAtlasNetworkExport(
  result: AtlasNetworkReachResult,
  minutes: number,
  format: "csv" | "geojson" | "json"
): string {
  const metadata = {
    network: result.networkName,
    area: result.areaCode,
    reportingAreas: (result.areaCodes ?? [result.areaCode]).join(";"),
    reportingAreaName: result.reportingArea?.name,
    method: result.method,
    state: result.state,
    excludedLibraries: result.excludedLibraries,
    warnings: JSON.stringify(result.warnings),
    mode: result.mode,
    populationYear: result.population.year,
    populationSource: result.population.sourceUrl,
    populationLicence: result.population.licence,
    routingLicence: result.network.licence,
    filters: JSON.stringify(result.scope ?? {}),
    reportingBoundary: result.reportingArea?.sourceUrl,
    reportingBoundaryVersion: result.reportingArea?.version,
    reportingBoundaryLicence: result.reportingArea?.licence,
    networkSource: result.network.sourceUrl,
    calculatedAt: result.calculatedAt,
    selectionHash: result.selectionHash,
    selectedLibraries: result.selectedLibraries,
    unavailableLibraries: result.unavailableLibraries,
    totalResidents: result.totalResidents,
  }
  const rows = result.contours.map(
    ({ geometry: _geometry, gapGeometry: _gapGeometry, ...band }) => ({
      ...metadata,
      ...band,
    })
  )

  return format === "json"
    ? JSON.stringify({
        exportSchemaVersion: 2,
        metric: "Modelled geographical reach; not usage or effective access",
        selectedMinutes: minutes,
        reproduction: {
          geometryPurpose:
            "Simplified display geometry; counts use full native contours",
          branchSnapDistances:
            "Not retained; the shared network snapDistanceMetres scalar is a legacy placeholder",
        },
        distribution: atlasReachDistribution(result),
        result,
      })
    : format === "csv"
      ? [
          Object.keys(rows[0]!).map(csvQuote).join(","),
          ...rows.map((row) => Object.values(row).map(csvQuote).join(",")),
        ].join("\r\n")
      : JSON.stringify({
          type: "FeatureCollection",
          analysis: {
            exportSchemaVersion: 2,
            ...result.analysis,
            population: result.population,
            network: result.network,
            reportingArea: result.reportingArea,
            selectedMinutes: minutes,
            community: result.community,
            geometryPurpose:
              "Simplified display geometry; population uses full analytical contours",
          },
          features: result.contours.flatMap(
            ({ geometry, gapGeometry, ...band }) => [
              ...(band.empty
                ? []
                : [
                    {
                      type: "Feature",
                      geometry,
                      properties: {
                        ...metadata,
                        ...band,
                        coverageKind: "covered",
                      },
                    },
                  ]),
              ...(gapGeometry
                ? [
                    {
                      type: "Feature",
                      geometry: gapGeometry,
                      properties: {
                        ...metadata,
                        ...band,
                        coverageKind: "outside",
                      },
                    },
                  ]
                : []),
            ]
          ),
        })
}
