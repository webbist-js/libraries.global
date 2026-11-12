/**
 * National Diet Library ISIL registry (libraries and public reading rooms) → Library.
 * Source: https://www.ndl.go.jp/library/isil, public domain.
 */

import type { DirectoryLibrary } from "../../_shared/directory"
import { isilSlug } from "../../_shared/isil-registry"

/** Release the first import used; newer releases change the file names. */
export const JAPAN_RELEASE = "20261102"

export type JapanList = "public" | "other"

export function japanUrls(release = JAPAN_RELEASE) {
  if (!/^\d{8}$/.test(release))
    throw new Error("--release must be a YYYYMMDD NDL file date")
  const base = "https://www.ndl.go.jp/file/library/isil"

  return {
    public: `${base}/isil_libraries_public_${release}_J.csv`,
    other: `${base}/isil_libraries_${release}_J.csv`,
    deleted: `${base}/isil_deleted_${release}_J.csv`,
  }
}

/**
 * Column order shared by both library lists. Their bilingual headings differ
 * slightly between lists, so columns are read by position after checking
 * each heading against these patterns.
 */
export const JAPAN_COLUMNS = [
  ["recordId", /^ISIL$/],
  ["name", /Institution name in Japanese$/],
  ["english", /Institution name in English/],
  ["kana", /kana/],
  ["postal", /Postal code/],
  ["pref", /Prefecture/],
  ["city", /City\/Ward\/Town\/Village/],
  ["street", /Address/],
  ["phone", /Telephone/],
  ["fax", /Fax/],
  ["url", /^URL$/],
] as const

export type JapanRow = Record<(typeof JAPAN_COLUMNS)[number][0], string> & {
  list: JapanList
}

/** Prefectures in the registry → existing Atlas region names. */
export const JAPAN_PREFECTURES: Record<string, string> = {
  北海道: "Hokkaido",
  青森県: "Aomori",
  岩手県: "Iwate",
  宮城県: "Miyagi",
  秋田県: "Akita",
  山形県: "Yamagata",
  福島県: "Fukushima",
  茨城県: "Ibaraki",
  栃木県: "Tochigi",
  群馬県: "Gunma",
  埼玉県: "Saitama",
  千葉県: "Chiba",
  東京都: "Tokyo",
  神奈川県: "Kanagawa",
  新潟県: "Niigata",
  富山県: "Toyama",
  石川県: "Ishikawa",
  福井県: "Fukui",
  山梨県: "Yamanashi",
  長野県: "Nagano",
  岐阜県: "Gifu",
  静岡県: "Shizuoka",
  愛知県: "Aichi",
  三重県: "Mie",
  滋賀県: "Shiga",
  京都府: "Kyoto",
  大阪府: "Osaka",
  兵庫県: "Hyōgo",
  奈良県: "Nara",
  和歌山県: "Wakayama",
  鳥取県: "Tottori",
  島根県: "Shimane",
  岡山県: "Okayama",
  広島県: "Hiroshima",
  山口県: "Yamaguchi",
  徳島県: "Tokushima",
  香川県: "Kagawa",
  愛媛県: "Ehime",
  高知県: "Kochi",
  福岡県: "Fukuoka",
  佐賀県: "Saga",
  長崎県: "Nagasaki",
  熊本県: "Kumamoto",
  大分県: "Oita",
  宮崎県: "Miyazaki",
  鹿児島県: "Kagoshima",
  沖縄県: "Okinawa",
}

/** The existing curated National Diet Library entry; linked, never created. */
export const JAPAN_CURATED = {
  recordId: "JP-1000001",
  slug: "national-diet-library",
} as const

const NATIONAL = new Set([
  "国立国会図書館",
  "国立国会図書館関西館",
  "国立国会図書館国際子ども図書館",
])

/**
 * Conservative type from list membership and institution name. The registry
 * has no type field; anything not clearly identified is Other.
 */
export function japanLibraryType(
  row: Pick<JapanRow, "name" | "english" | "list">
) {
  const name = row.name
  if (NATIONAL.has(name)) return "National"
  if (
    name.includes("国立国会図書館支部") ||
    row.english.includes("Branch of the NDL")
  )
    return "Special"
  if (row.list === "public")
    return /[都道府県]立.*図書館/.test(name) ? "Regional" : "Public"
  if (name.includes("議会")) return "Parliamentary"
  if (["点字", "視覚障害", "ライトハウス"].some((part) => name.includes(part)))
    return "Specific User Groups"
  if (name.includes("大学")) return "University"
  if (
    ["専門学校", "高等専門", "短期大学校", "職業能力開発大学校"].some((part) =>
      name.includes(part)
    )
  )
    return "Academic"
  if (
    [
      "研究",
      "株式会社",
      "財団",
      "協会",
      "省",
      "庁",
      "博物館",
      "美術館",
      "病院",
      "センター",
    ].some((part) => name.includes(part))
  )
    return "Special"

  return "Other"
}

/** Origin URL is the list file the row came from. */
export function japanSourceUrl(list: JapanList, release = JAPAN_RELEASE) {
  return japanUrls(release)[list]
}

/** Returns the skip reason, or the Library with its prefecture placement. */
export function mapJapaneseLibrary(
  row: JapanRow,
  release = JAPAN_RELEASE
): DirectoryLibrary | string {
  if (!/^JP-\d{7}$/.test(row.recordId))
    return `Invalid Japanese ISIL ${row.recordId}`
  // Without both, a record cannot be placed or shown to a visitor.
  if (!row.pref || !row.city) return "No usable prefecture and municipality"
  const regionName = JAPAN_PREFECTURES[row.pref]
  if (!regionName) return `Unknown prefecture ${row.pref}`
  if (!row.name) return "Missing institution name"
  const alternateNames = row.kana ? [row.kana] : []
  // Long upper-case runs are romanised kana, not a readable English name.
  if (row.english && !/[A-Z]{12}/.test(row.english))
    alternateNames.push(row.english)
  const website =
    /^https?:\/\//.test(row.url) && row.url.length <= 255 && !/\s/.test(row.url)
      ? row.url
      : undefined

  return {
    recordId: row.recordId,
    warnings: [],
    countryCode: "JP",
    regionName,
    data: {
      name: row.name,
      slug: isilSlug(row.english, row.recordId, "library"),
      libraryType: japanLibraryType(row),
      operationalStatus: "unknown",
      sourceUrl: japanSourceUrl(row.list, release),
      // Municipality strings are retained as published; no Area is inferred.
      city: row.city,
      streetAddress: row.street || undefined,
      // Python's \d in the first import also accepted full-width digits.
      postalCode: /^\p{Nd}{3}-\p{Nd}{4}$/u.test(row.postal)
        ? row.postal
        : undefined,
      website,
      phone:
        row.phone && /^[0-9０-９()（）+\-－ー \u3000]+$/.test(row.phone)
          ? row.phone
          : undefined,
      alternateNames: alternateNames.length ? alternateNames : undefined,
    },
  }
}
