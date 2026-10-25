import type { AtlasNetworkReachResult } from "./network-reach"

export interface AtlasCommunityReach {
  schemaVersion: 1
  state: "ready" | "unavailable" | "incomplete" | "insufficient"
  method?: string
  release?: {
    id: string
    country: string
    name: string
    edition: string
    year: number
    boundary: string
    sourceUrl: string
    licence: string
    assetSha256: string
    geometryMethod: string
    domain: "overall"
  }
  groups?: {
    quintile: number | null
    totalResidents: number
    contours: {
      minutes: number
      residents: number
      outsideResidents: number
      percent: number | null
      shareOfOutside: number | null
    }[]
  }[]
}

/** Mutually exclusive bands. Missing or incomplete cumulative results stay unknown. */
export function atlasReachDistribution(result: AtlasNetworkReachResult) {
  if (
    result.state !== "ready" ||
    result.totalResidents === null ||
    !Number.isFinite(result.totalResidents) ||
    result.totalResidents < 0 ||
    result.unavailableLibraries > 0 ||
    result.contours.length !== 4
  )
    return null
  let previous = 0
  let from = 0
  const tolerance = Math.max(0.001, result.totalResidents * 1e-9)
  const bands = []
  for (const [i, band] of result.contours.entries()) {
    if (
      band.minutes !== [5, 10, 15, 30][i] ||
      band.residents === null ||
      !Number.isFinite(band.residents) ||
      band.residents < previous ||
      band.residents > result.totalResidents + tolerance
    )
      return null
    const residents = Math.min(result.totalResidents, band.residents)
    bands.push({
      from,
      to: band.minutes as number | null,
      residents: residents - previous,
    })
    previous = residents
    from = band.minutes
  }
  bands.push({ from, to: null, residents: result.totalResidents - previous })

  return bands
}

/** Data only: UI translations supply descriptive, non-causal sentences. */
export function atlasReachInsights(
  result: AtlasNetworkReachResult,
  minutes: number
) {
  const distribution = atlasReachDistribution(result)
  const current = result.contours.find((band) => band.minutes === minutes)
  const maximum = result.contours.at(-1)
  if (
    !distribution ||
    !current ||
    current.residents === null ||
    !maximum ||
    maximum.residents === null
  )
    return null

  return {
    additional:
      minutes < maximum.minutes
        ? distribution
            .filter((band) => band.from >= minutes && band.to !== null)
            .reduce((sum, band) => sum + band.residents, 0)
        : null,
    maximumMinutes: maximum.minutes,
    maximumPercent: maximum.percent,
    beyondMaximum: distribution.at(-1)!.residents,
  }
}

export function atlasCommunityGap(
  community: AtlasCommunityReach,
  minutes: number
) {
  if (community.state !== "ready") return null
  const values = community.groups
    ?.filter((group) => group.quintile !== null && group.totalResidents > 0)
    .map((group) => ({
      quintile: group.quintile!,
      percent: group.contours.find((band) => band.minutes === minutes)?.percent,
    }))
    .filter(
      (row): row is { quintile: number; percent: number } => row.percent != null
    )
    .sort((a, b) => a.percent - b.percent)
  if (!values || values.length < 2) return null

  return {
    low: values[0]!,
    high: values.at(-1)!,
    points: values.at(-1)!.percent - values[0]!.percent,
  }
}

export function validateAtlasCommunityReach(result: AtlasNetworkReachResult) {
  const value = result.community
  if (!value) return
  if (
    value.schemaVersion !== 1 ||
    !["ready", "unavailable", "incomplete", "insufficient"].includes(
      value.state
    )
  )
    throw new RangeError("Invalid community state")
  validateCommunityProvenance(value)
  if (value.state !== "ready") {
    if (value.groups !== undefined)
      throw new RangeError("Incomplete community metrics")

    return
  }
  if (
    result.state !== "ready" ||
    !value.release ||
    value.method !== "deprivation-partition-equal-area-v1" ||
    !Array.isArray(value.groups) ||
    value.groups.length !== 6 ||
    result.totalResidents === null
  )
    throw new RangeError("Invalid community result")
  const expectedCountry = {
    E: "GB-ENG",
    W: "GB-WLS",
    S: "GB-SCT",
    N: "GB-NIR",
  }[result.areaCode[0]!]
  if (
    value.release.country !== expectedCountry ||
    (result.areaCodes ?? [result.areaCode]).some(
      (code) => code[0] !== result.areaCode[0]
    )
  )
    throw new RangeError("Incompatible national indices")
  const tolerance = Math.max(0.01, result.totalResidents * 1e-8)
  const close = (a: number | null, b: number | null, epsilon = tolerance) =>
    a === null || b === null
      ? a === b
      : Number.isFinite(a) && Math.abs(a - b) <= epsilon
  for (const [i, group] of value.groups.entries()) {
    if (
      group.quintile !== (i < 5 ? i + 1 : null) ||
      !Number.isFinite(group.totalResidents) ||
      group.totalResidents < 0 ||
      !Array.isArray(group.contours) ||
      group.contours.length !== 4
    )
      throw new RangeError("Invalid community group")
    let previous = 0
    group.contours.forEach((band, j) => {
      const all = result.contours[j]!
      if (
        band.minutes !== all.minutes ||
        !Number.isFinite(band.residents) ||
        band.residents < previous ||
        band.residents > group.totalResidents ||
        !Number.isFinite(band.outsideResidents) ||
        band.outsideResidents < 0 ||
        [band.percent, band.shareOfOutside].some(
          (rate) =>
            rate !== null && (!Number.isFinite(rate) || rate < 0 || rate > 100)
        ) ||
        !close(band.outsideResidents, group.totalResidents - band.residents) ||
        !close(
          band.percent,
          group.totalResidents > 0
            ? (band.residents / group.totalResidents) * 100
            : null,
          1e-6
        ) ||
        !close(
          band.shareOfOutside,
          all.outsideResidents! > 0.001
            ? Math.min(
                100,
                (band.outsideResidents / all.outsideResidents!) * 100
              )
            : null,
          1e-6
        )
      )
        throw new RangeError("Inconsistent community rates")
      previous = band.residents
    })
  }
  if (
    !close(
      value.groups.reduce((n, g) => n + g.totalResidents, 0),
      result.totalResidents
    )
  )
    throw new RangeError("Community denominator mismatch")
  result.contours.forEach((band, i) => {
    if (
      !close(
        value.groups!.reduce((n, g) => n + g.contours[i]!.residents, 0),
        band.residents
      )
    )
      throw new RangeError("Community numerator mismatch")
  })
}

function validateCommunityProvenance(value: AtlasCommunityReach) {
  if (
    value.release &&
    (!/^community-gb-(eng|wls|sct|nir)-[a-f0-9]{16}$/.test(value.release.id) ||
      !/^https:\/\//.test(value.release.sourceUrl) ||
      !/^[a-f0-9]{64}$/.test(value.release.assetSha256))
  )
    throw new RangeError("Invalid community release")
  if (
    value.release &&
    (value.release.domain !== "overall" ||
      !Number.isInteger(value.release.year) ||
      value.release.year < 1900 ||
      value.release.year > 2100 ||
      [
        value.release.name,
        value.release.edition,
        value.release.boundary,
        value.release.licence,
        value.release.geometryMethod,
      ].some((text) => typeof text !== "string" || !text || text.length > 2000))
  )
    throw new RangeError("Invalid community provenance")
}
