/**
 * GeoNames readers for the world place import (https://www.geonames.org,
 * CC BY 4.0). Parsing is pure; the loaders download once into `.cache/`.
 */
import { readFileSync } from "node:fs"
import path from "node:path"

import type { ResolvedProfile } from "./country-profiles"
import type { SourcePlace } from "./types"
import { fetchSourceFile, type SourceFile, unzip } from "../_shared/source-file"

export const GEONAMES_DUMP = "https://download.geonames.org/export/dump"
export const GEONAMES_ATTRIBUTION = "GeoNames (geonames.org), CC BY 4.0"

/** A GeoNames administrative level: country, region or area. */
export type GeonamesLevel = 1 | 2 | 3

/** One administrative division. */
export interface GeonamesDivision {
  geonameId: string
  level: GeonamesLevel
  /** ISO 3166-1 alpha-2, e.g. "CH". */
  country: string
  admin1: string
  /** "" for level 1. */
  admin2: string
  name: string
  asciiName: string
  altNames: string[]
}

/** `admin1CodesASCII.txt` or `admin2Codes.txt`: `CC.A1[.A2]\tname\tasciiname\tgeonameid`. */
export function parseAdminCodes(
  text: string,
  level: 1 | 2
): GeonamesDivision[] {
  const out: GeonamesDivision[] = []
  for (const line of text.split("\n")) {
    const [code, name, asciiName, geonameId] = line.split("\t")
    if (!code || !name || !geonameId) continue
    const parts = code.split(".")
    if (parts.length !== level + 1) continue
    out.push({
      geonameId: geonameId.trim(),
      level,
      country: parts[0]!,
      admin1: parts[1]!,
      admin2: level === 2 ? parts[2]! : "",
      name: name.trim(),
      asciiName: (asciiName ?? "").trim(),
      altNames: [],
    })
  }

  return out
}

const LEVELS: Record<string, GeonamesLevel> = { ADM1: 1, ADM2: 2, ADM3: 3 }

/** A country dump (`XX.txt`, 19 tab-separated columns): its ADM1–ADM3 rows. */
export function parseCountryDump(text: string): GeonamesDivision[] {
  const out: GeonamesDivision[] = []
  for (const line of text.split("\n")) {
    const c = line.split("\t")
    if (c.length < 19 || c[6] !== "A") continue
    const level = LEVELS[c[7]!]
    if (!level) continue
    out.push({
      geonameId: c[0]!,
      level,
      country: c[8]!,
      admin1: c[10]!,
      admin2: c[11]!,
      name: c[1]!,
      asciiName: c[2]!,
      altNames: c[3] ? c[3].split(",").filter(Boolean) : [],
    })
  }

  return out
}

/**
 * Drops each of `words` (one per entry) from the start or end of `name`, in
 * order; never to nothing.
 */
export function tidyName(name: string, words: readonly string[]): string {
  let out = name
  for (const w of words) {
    if (out.startsWith(w)) out = out.slice(w.length)
    else if (out.endsWith(w)) out = out.slice(0, -w.length)
  }

  return out.trim() || name
}

/** Tidies names unless two places in one group would end up the same. */
function tidyAll(
  places: SourcePlace[],
  words: readonly string[],
  groupOf: (p: SourcePlace) => string
): SourcePlace[] {
  if (words.length === 0) return places
  const tidied = places.map((p) => tidyName(p.name, words))
  const seen = new Map<string, number>()
  places.forEach((p, i) => {
    const k = `${groupOf(p)}|${tidied[i]}`
    seen.set(k, (seen.get(k) ?? 0) + 1)
  })

  return places.map((p, i) => {
    const t = tidied[i]!
    if (t === p.name || (seen.get(`${groupOf(p)}|${t}`) ?? 0) > 1) return p

    return { ...p, name: t, altNames: [...p.altNames, p.name] }
  })
}

/** A profile's Regions and Areas as source places (spec §6.3). */
export function geonamesPlaces(
  profile: ResolvedProfile,
  data: {
    admin1: readonly GeonamesDivision[]
    admin2: readonly GeonamesDivision[]
    dump?: readonly GeonamesDivision[]
  }
): { regions: SourcePlace[]; areas: SourcePlace[] } {
  const { country, admin1 } = profile.geonames
  const alt = new Map((data.dump ?? []).map((d) => [d.geonameId, d.altNames]))
  const rowsAt = (level: GeonamesLevel) =>
    (level === 1
      ? data.admin1
      : level === 2
        ? data.admin2
        : (data.dump ?? []).filter((d) => d.level === 3)
    ).filter((d) => d.country === country && (!admin1 || d.admin1 === admin1))
  const keyAt = (d: GeonamesDivision, level: 1 | 2) =>
    level === 1 ? d.admin1 : `${d.admin1}.${d.admin2}`
  const toPlace = (
    d: GeonamesDivision,
    key: string,
    parentKey?: string
  ): SourcePlace => ({
    sourceId: `geonames:${d.geonameId}`,
    geonamesId: d.geonameId,
    name: d.name,
    altNames: [
      ...new Set([d.asciiName, ...d.altNames, ...(alt.get(d.geonameId) ?? [])]),
    ].filter((n) => n && n !== d.name),
    key,
    ...(parentKey === undefined ? {} : { parentKey }),
    admin1: d.admin1,
  })

  const regions = rowsAt(profile.regionLevel).map((d) =>
    toPlace(d, keyAt(d, profile.regionLevel))
  )
  const areas =
    profile.areaLevel === null
      ? []
      : rowsAt(profile.areaLevel).map((d) =>
          toPlace(d, `geonames:${d.geonameId}`, keyAt(d, profile.regionLevel))
        )

  return {
    regions: tidyAll(regions, profile.tidyNames, () => ""),
    areas: tidyAll(areas, profile.tidyNames, (p) => p.parentKey ?? ""),
  }
}

/** The world's level-1 and level-2 divisions (two small files). */
export async function loadAdminCodes(cacheDir: string): Promise<{
  admin1: GeonamesDivision[]
  admin2: GeonamesDivision[]
  files: SourceFile[]
}> {
  const a1 = await fetchSourceFile(
    `${GEONAMES_DUMP}/admin1CodesASCII.txt`,
    cacheDir
  )
  const a2 = await fetchSourceFile(`${GEONAMES_DUMP}/admin2Codes.txt`, cacheDir)

  return {
    admin1: parseAdminCodes(readFileSync(a1.file, "utf8"), 1),
    admin2: parseAdminCodes(readFileSync(a2.file, "utf8"), 2),
    files: [a1, a2],
  }
}

/** One country's ADM1–ADM3 rows, for a profile whose Area level is 3. */
export async function loadCountryDump(
  country: string,
  cacheDir: string
): Promise<{ rows: GeonamesDivision[]; file: SourceFile }> {
  const zip = await fetchSourceFile(`${GEONAMES_DUMP}/${country}.zip`, cacheDir)
  const dir = unzip(zip.file)

  return {
    rows: parseCountryDump(
      readFileSync(path.join(dir, `${country}.txt`), "utf8")
    ),
    file: zip,
  }
}
