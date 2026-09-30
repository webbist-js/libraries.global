import {
  DataSet,
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
} from "obscenity"

/**
 * Content checks for anything a contributor sends: offensive language in
 * text, and links to adult sites, hidden destinations or unsafe schemes.
 * Shared so the form can warn early and Strapi can refuse for good (the
 * content-moderation submission policy is the authoritative gate).
 */

// "porn" is a subject, not a swear: a collection can be about it. Adult
// sites are caught by the link rules instead.
const dataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  .removePhrasesIf((p) => p.metadata?.originalWord === "porn")

const matcher = new RegExpMatcher({
  ...dataset.build(),
  ...englishRecommendedTransformers,
})

/**
 * Real places (and ordinary words) the matcher mistakes for swears. They are
 * blanked out before matching; callers can add their own, such as the
 * library's name and address.
 */
export const SAFE_TERMS: readonly string[] = [
  "penistone",
  "cumnock",
  "twatt",
  "shitterton",
  "fucking, austria",
  "fugging",
  "pussycat",
  "pussy willow",
  "scunthorpe",
  "cockermouth",
  "clitheroe",
  "dickens",
  "hancock",
  "sussex",
  "essex",
  "middlesex",
  "wetwang",
  "bitchfield",
  "crapstone",
  "brown willy",
  "slutshole",
]

const ADULT_TLDS = new Set(["xxx", "porn", "sex", "adult", "sexy"])

const ADULT_HOST_WORDS = [
  "porn",
  "xxx",
  "xvideos",
  "xnxx",
  "xhamster",
  "redtube",
  "youporn",
  "onlyfans",
  "fansly",
  "chaturbate",
  "brazzers",
  "hentai",
  "nsfw",
  "livejasmin",
  "stripchat",
  "bongacams",
  "camsoda",
  "rule34",
  "escort",
  "spankbang",
  "eporner",
]

/** Shorteners hide where a link goes, so reviewers can't check it. */
const SHORTENERS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
  "shorturl.at",
  "tiny.cc",
  "rb.gy",
  "t.ly",
  "s.id",
  "v.gd",
])

export const LANGUAGE_MESSAGE =
  "Please remove the offensive language before sending."
export const LINK_MESSAGE =
  "That link can’t be accepted. Link to the library, a council or another public source."
export const SHORT_LINK_MESSAGE =
  "Please use the full link rather than a shortened one."
export const SCHEME_MESSAGE = "Links must start with http:// or https://."

const escape = (s: string) =>
  s.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

function blank(text: string, allow: readonly string[]): string {
  let out = text
  for (const term of [...SAFE_TERMS, ...allow]) {
    const t = term.trim()
    if (t.length < 3) continue
    out = out.replaceAll(new RegExp(escape(t), "gi"), " ")
  }

  return out
}

/** Why this text can't be accepted, or null. Links inside it are checked too. */
export function checkText(
  text: string,
  allow: readonly string[] = []
): string | null {
  if (!text.trim()) return null
  if (matcher.hasMatch(blank(text, allow))) return LANGUAGE_MESSAGE
  for (const m of text.matchAll(/\b(?:https?:\/\/|www\.)[^\s<>"')]+/gi)) {
    const raw = m[0].startsWith("www.") ? `https://${m[0]}` : m[0]
    const issue = checkLink(raw)
    if (issue) return issue
  }

  return null
}

/**
 * Why this link can't be accepted, or null. Text that isn't a URL at all
 * (a reference like "the noticeboard") is checked as text instead.
 */
export function checkLink(value: string): string | null {
  const raw = value.trim()
  if (!raw) return null
  if (/^(?:javascript|data|vbscript|file):/i.test(raw)) return SCHEME_MESSAGE
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return checkText(raw)
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return SCHEME_MESSAGE
  const host = url.hostname.toLowerCase().replace(/^www\./, "")
  const tld = host.split(".").at(-1) ?? ""
  if (ADULT_TLDS.has(tld)) return LINK_MESSAGE
  if (ADULT_HOST_WORDS.some((w) => host.includes(w))) return LINK_MESSAGE
  if (SHORTENERS.has(host)) return SHORT_LINK_MESSAGE
  if (matcher.hasMatch(`${host} ${safeDecode(url.pathname)}`))
    return LINK_MESSAGE

  return null
}

/** `decodeURIComponent`, or the raw string when the encoding is malformed. */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export type SafetyIssue = {
  path: string
  message: string
  /** Set when the payload itself is the problem rather than a value in it. */
  code?: "too_deep"
}

export const TOO_DEEP_MESSAGE =
  "That submission is nested too deeply to be checked. Please simplify it."

/**
 * Deeper than any real payload: article bodies reach about 8 levels, and a
 * rich-text list nested to the sanitiser's 8-level cap about 21. Past this
 * the check fails closed rather than passing what it didn't read.
 */
const MAX_DEPTH = 24

// Machine ids: exact keys only. A suffix rule (`...Id`) would also skip
// free text such as `wikidataId`.
const ID_KEYS = new Set([
  "id",
  "documentId",
  "targetDocumentId",
  "libraryDocumentId",
  "libraryDocumentIds",
  "topicDocumentId",
  "suggestionDocumentId",
  "continentDocumentId",
  "countryDocumentId",
  "regionDocumentId",
  "areaDocumentId",
  "fileId",
  "fileIds",
  "uploadIds",
  "photoId",
  "strapiId",
  "baUserId",
])

// Other machine values: times, enum keys and our own upload paths.
const SKIP_KEYS = new Set([
  ...ID_KEYS,
  "kind",
  "locale",
  "day",
  "staffing",
  "platform",
  "startTime",
  "endTime",
  "version",
  "photoUrl",
  "reviewedPayloadHash",
])

const RELATION_OP_KEYS = new Set(["connect", "disconnect", "set"])

/** A relation change's id list: strings, or `{ id }` / `{ documentId }` objects. */
const isIdList = (v: unknown) =>
  Array.isArray(v) &&
  v.every(
    (item) =>
      typeof item === "string" ||
      typeof item === "number" ||
      (!!item &&
        typeof item === "object" &&
        Object.keys(item).every((k) => k === "id" || k === "documentId"))
  )

const isLinkKey = (key: string) =>
  /(?:url|link|website|href|endpoint)$/i.test(key) || key === "url"

/**
 * The first problem anywhere in a submission payload (fields, note,
 * draftData, article blocks...), with the path to it, or null.
 */
export function findUnsafeContent(
  value: unknown,
  allow: readonly string[] = [],
  path = "",
  depth = 0
): SafetyIssue | null {
  if (value == null) return null
  if (depth > MAX_DEPTH)
    return { path, message: TOO_DEEP_MESSAGE, code: "too_deep" }
  if (typeof value === "string") {
    const key = path.split(".").at(-1) ?? ""
    const message = isLinkKey(key) ? checkLink(value) : checkText(value, allow)

    return message ? { path, message } : null
  }
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const issue = findUnsafeContent(item, allow, `${path}[${i}]`, depth + 1)
      if (issue) return issue
    }

    return null
  }
  if (typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      if (SKIP_KEYS.has(key)) continue
      if (RELATION_OP_KEYS.has(key) && isIdList(item)) continue
      const issue = findUnsafeContent(
        item,
        allow,
        path ? `${path}.${key}` : key,
        depth + 1
      )
      if (issue) return issue
    }
  }

  return null
}
