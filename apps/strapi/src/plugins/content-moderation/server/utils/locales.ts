/**
 * Strapi's configured i18n locales, for everything that stores or writes a
 * Submission's locale. Read from the i18n plugin's locales service and
 * memoised per Strapi instance for 60 seconds, so a locale added in the
 * admin is picked up within a minute.
 *
 * Without the i18n plugin (unit tests, a stripped-down app) there is one
 * locale, `en`.
 */

import { legacyPayloadHash, payloadHash } from "./payload-hash"

const TTL_MS = 60_000
const FALLBACK = "en"

type LocaleRow = { code?: unknown; isDefault?: unknown }
type Memo = { at: number; codes: string[]; defaultCode: string }

const memo = new WeakMap<object, Memo>()

function localesService(strapi: any): any {
  try {
    return strapi?.plugin?.("i18n")?.service?.("locales") ?? null
  } catch {
    return null
  }
}

async function load(strapi: any): Promise<Memo> {
  const cached = strapi && memo.get(strapi)
  if (cached && Date.now() - cached.at < TTL_MS) return cached

  const service = localesService(strapi)
  let codes: string[] = []
  let defaultCode: string | null = null
  if (service) {
    const rows = ((await service.find?.()) ?? []) as LocaleRow[]
    codes = rows.flatMap((r) =>
      typeof r?.code === "string" && r.code ? [r.code] : []
    )
    const flagged = rows.find((r) => r?.isDefault === true)
    if (typeof flagged?.code === "string") defaultCode = flagged.code
    if (!defaultCode && typeof service.getDefaultLocale === "function") {
      const d = await service.getDefaultLocale()
      if (typeof d === "string" && d) defaultCode = d
    }
  }
  if (codes.length === 0) codes = [FALLBACK]
  if (!defaultCode || !codes.includes(defaultCode))
    defaultCode = codes.includes(FALLBACK) ? FALLBACK : codes[0]!

  const next = { at: Date.now(), codes, defaultCode }
  if (strapi && typeof strapi === "object") memo.set(strapi, next)

  return next
}

/** The locale codes Strapi is configured with (never empty). */
export async function configuredLocales(strapi: any): Promise<string[]> {
  return [...(await load(strapi)).codes]
}

/** Strapi's default locale (`en` when it names none). */
export async function defaultLocale(strapi: any): Promise<string> {
  return (await load(strapi)).defaultCode
}

/** `v` when it is a configured locale, otherwise the default locale. */
export async function normaliseLocale(
  strapi: any,
  v: unknown
): Promise<string> {
  const { codes, defaultCode } = await load(strapi)

  return typeof v === "string" && codes.includes(v) ? v : defaultCode
}

/** `v` when it is a configured locale, otherwise null. */
export async function knownLocale(
  strapi: any,
  v: unknown
): Promise<string | null> {
  const { codes } = await load(strapi)

  return typeof v === "string" && codes.includes(v) ? v : null
}

/**
 * A Submission's locale. Stored as `contentLocale` (`locale` is reserved by
 * Strapi's i18n plugin); the service layer and its callers call it `locale`.
 * Null when neither is set (a row written before the backfill).
 */
export function submissionLocale(s: unknown): string | null {
  if (!s || typeof s !== "object") return null
  const { contentLocale, locale } = s as Record<string, unknown>
  if (typeof contentLocale === "string" && contentLocale) return contentLocale
  if (typeof locale === "string" && locale) return locale

  return null
}

/** Drops the memo (tests). */
export function resetLocalesMemo(strapi: any): void {
  if (strapi && typeof strapi === "object") memo.delete(strapi)
}

const SUBMISSION = "plugin::content-moderation.submission"
const BACKFILL_STORE = { type: "plugin", name: "content-moderation" } as const
const BACKFILL_KEY = "submission-locale-v1"
const BACKFILL_PAGE = 100

/**
 * One-off: gives every Submission written before submissions carried a
 * locale its `contentLocale`: `draftData.locale` or `fields.locale` when it
 * is a configured locale, else the default. Adding the column may already
 * have filled old rows with the schema default, so a row counts as old when
 * its locale is empty or the default and it has no current-style hash. A
 * stored `payloadHash` that still matches its content (the pre-locale
 * computation) is re-pinned with the locale, so rows in review aren't read
 * as tampered; one that doesn't match is left alone and stays flagged.
 * Guarded by a core-store flag.
 */
export async function backfillSubmissionLocales(
  strapi: any
): Promise<{ updated: number }> {
  const store = strapi.store(BACKFILL_STORE)
  if (await store.get({ key: BACKFILL_KEY })) return { updated: 0 }

  const base = await defaultLocale(strapi)
  let updated = 0
  for (let start = 0; ; start += BACKFILL_PAGE) {
    const rows = (await strapi.documents(SUBMISSION).findMany({
      sort: "id:asc",
      start,
      limit: BACKFILL_PAGE,
    })) as Record<string, any>[]

    for (const row of rows) {
      const current: unknown = row.contentLocale
      if (row.payloadHash && row.payloadHash === payloadHash(row)) continue
      if (typeof current === "string" && current && current !== base) continue

      const draftData = row.draftData as Record<string, unknown> | null
      const fields = row.fields as Record<string, unknown> | null
      const locale =
        (await knownLocale(strapi, draftData?.locale)) ??
        (await knownLocale(strapi, fields?.locale)) ??
        base
      const data: Record<string, unknown> = {}
      if (locale !== current) data.contentLocale = locale
      if (row.payloadHash && row.payloadHash === legacyPayloadHash(row))
        data.payloadHash = payloadHash({ ...row, contentLocale: locale })
      if (Object.keys(data).length === 0) continue

      await strapi
        .documents(SUBMISSION)
        .update({ documentId: row.documentId, data })
      updated += 1
    }
    if (rows.length < BACKFILL_PAGE) break
  }

  await store.set({
    key: BACKFILL_KEY,
    value: { at: new Date().toISOString(), updated },
  })
  strapi.log.info(
    `[content-moderation] Backfilled the locale of ${updated} submissions`
  )

  return { updated }
}
