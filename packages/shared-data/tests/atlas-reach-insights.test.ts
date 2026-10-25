import { expect, it } from "vitest"

import {
  atlasReachDistribution,
  atlasReachInsights,
  atlasCommunityGap,
  validateAtlasCommunityReach,
  type AtlasNetworkReachResult,
} from "../index"

const result = {
  state: "ready",
  totalResidents: 100,
  areaCode: "S12000033",
  contours: [5, 10, 15, 30].map((minutes, i) => ({
    minutes,
    residents: [10, 25, 55, 90][i]!,
    outsideResidents: 100 - [10, 25, 55, 90][i]!,
    percent: [10, 25, 55, 90][i]!,
  })),
} as AtlasNetworkReachResult
it("derives exclusive bands and insights without rounding cumulative estimates", () => {
  expect(atlasReachDistribution(result)?.map((b) => b.residents)).toEqual([
    10, 15, 30, 35, 10,
  ])
  expect(atlasReachInsights(result, 15)).toEqual({
    additional: 35,
    maximumMinutes: 30,
    maximumPercent: 90,
    beyondMaximum: 10,
  })
  expect(atlasReachInsights(result, 30)?.additional).toBeNull()
  expect(atlasReachDistribution({ ...result, state: "partial" })).toBeNull()
  expect(
    atlasReachDistribution({
      ...result,
      contours: result.contours.map((b, i) => ({
        ...b,
        residents: i === 2 ? 20 : b.residents,
      })),
    })
  ).toBeNull()
})
it("rejects wrong category denominators, missing classifications and cross-nation editions", () => {
  const community = {
    schemaVersion: 1 as const,
    state: "ready" as const,
    method: "deprivation-partition-equal-area-v1",
    release: {
      id: `community-gb-sct-${"a".repeat(16)}`,
      country: "GB-SCT",
      name: "Scotland",
      edition: "SIMD 2020v2",
      year: 2020,
      boundary: "2011 Data Zones",
      sourceUrl: "https://example.test",
      licence: "OGL",
      assetSha256: "a".repeat(64),
      geometryMethod: "Source",
      domain: "overall" as const,
    },
    groups: [1, 2, 3, 4, 5, null].map((quintile, i) => ({
      quintile,
      totalResidents: i === 5 ? 50 : 10,
      contours: result.contours.map((b) => ({
        minutes: b.minutes,
        residents: b.residents! * (i === 5 ? 0.5 : 0.1),
        outsideResidents: b.outsideResidents * (i === 5 ? 0.5 : 0.1),
        percent: b.percent,
        shareOfOutside: i === 5 ? 50 : 10,
      })),
    })),
  }
  const value = { ...result, community }
  expect(() => validateAtlasCommunityReach(value)).not.toThrow()
  expect(atlasCommunityGap(community, 15)?.points).toBe(0)
  expect(() =>
    validateAtlasCommunityReach({ ...value, totalResidents: 99 })
  ).toThrow()
  expect(() =>
    validateAtlasCommunityReach({ ...value, areaCode: "E06000016" })
  ).toThrow()
  expect(() =>
    validateAtlasCommunityReach({
      ...value,
      community: { ...community, groups: community.groups.slice(0, 5) },
    })
  ).toThrow()
  const bad = structuredClone(value)
  bad.community.groups[0]!.contours[0]!.percent = 50
  expect(() => validateAtlasCommunityReach(bad)).toThrow()
})

it("bounds floating-point tails without generating negative residents beyond the maximum", () => {
  const tail = {
    ...result,
    contours: result.contours.map((band, i) => ({
      ...band,
      residents: i === 3 ? 100 + 1e-10 : band.residents,
    })),
  }
  const bands = atlasReachDistribution(tail)!
  expect(bands.map((b) => b.residents)).toEqual([10, 15, 30, 45, 0])
  expect(bands.reduce((n, b) => n + b.residents, 0)).toBe(100)
  expect(atlasReachInsights(tail, 15)?.additional).toBe(45)
  expect(atlasReachInsights(tail, 15)?.beyondMaximum).toBe(0)
  expect(atlasReachDistribution({ ...tail, totalResidents: 99 })).toBeNull()
})
