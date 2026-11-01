import type { IrishFeed } from "./feeds"
import type { DirectoryLibrary } from "../../_shared/directory"
import {
  directoryPoint,
  directorySlug,
  directoryText,
  directoryUrl,
} from "../../_shared/directory-fields"

export interface IrishFeature {
  attributes: Record<string, string | number | null>
  geometry?: { x?: number; y?: number }
}

export function mapIrishLibrary(
  feature: IrishFeature,
  feed: IrishFeed
): DirectoryLibrary | string {
  const row = feature.attributes ?? {}
  const recordId = directoryText(row[feed.idField])
  const name = directoryText(row.Name)
  if (!recordId || !name || name.length > 255)
    return "Missing source identity/name"
  if (/mobile|housebound|headquarters/i.test(name))
    return "Combined mobile/home delivery or administrative record does not establish a fixed visitor branch"
  const location = directoryPoint(
    feature.geometry?.y,
    feature.geometry?.x,
    [51.3, 55.5, -10.8, -5.9]
  )
  const warnings = [
    "Directory does not establish present operation or structured daily hours",
  ]
  if (!location) warnings.push("No usable WGS84 point")
  const website = directoryUrl(
    row.Website ?? row.Website___then_select_choosen_l
  )
  const scalar = (value: unknown) => {
    const text = directoryText(value)

    return text && text.length <= 255 ? text : undefined
  }
  const city = scalar(feed.idField === "F__REF" ? row.Address2 : row.Town)
  const address = scalar(row.Address1)
  const postalCode = scalar(row.Eircode ?? row.Postcode)
  const phone = scalar(row.Phone ?? row.Telephone_Number)

  return {
    recordId,
    countryCode: "IE",
    // CMS placement uses traditional counties; publisher councils remain distinct Datasets.
    regionName: feed.region,
    regionAliases: [`County ${feed.region}`],
    warnings,
    data: {
      name,
      slug: directorySlug(
        name,
        `${feed.key}-${recordId.replaceAll(/[^a-zA-Z0-9-]/g, "-")}`
      ),
      libraryType: /archive/i.test(name) ? "Archive" : "Public",
      operatorType: "Municipality",
      operationalStatus: "unknown",
      sourceUrl: `https://data.gov.ie/dataset/${feed.catalogue}`,
      ...(location ? { location } : {}),
      ...(address ? { streetAddress: address } : {}),
      ...(city ? { city } : {}),
      ...(postalCode ? { postalCode } : {}),
      ...(phone ? { phone } : {}),
      ...(website ? { website } : {}),
    },
  }
}

/** Different publisher IDs do not prove different branches. Quarantine both. */
export function ambiguousIrishNames(rows: IrishFeature[]) {
  const names = new Map<string, number>()
  for (const row of rows) {
    const key = directoryText(row.attributes?.Name)?.toLocaleLowerCase("en-IE")
    if (key) names.set(key, (names.get(key) ?? 0) + 1)
  }

  return new Set(
    [...names].filter(([, count]) => count > 1).map(([name]) => name)
  )
}
