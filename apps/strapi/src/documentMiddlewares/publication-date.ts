import type { Core, UID } from "@strapi/strapi"

import { ARTICLE_UIDS } from "../utils/article-content"

/**
 * Publication Date: the public "published on" date of a Knowledge or Journal
 * article, per locale. Strapi's own `publishedAt` moves on every republish,
 * so it stays internal. The first publication stamps `publicationDate` when
 * it is empty; editors may change it in the admin and it is never
 * overwritten.
 *
 * Writes use `updateMany` with object data, which leaves `updatedAt`
 * untouched, so stamping a date never marks a draft as modified.
 */

const ARTICLE_CHANGE = "api::article-change.article-change"
const KIND: Record<string, "wiki" | "blog"> = {
  "api::wiki-article.wiki-article": "wiki",
  "api::blog-article.blog-article": "blog",
}
const HISTORY_STORE = { type: "plugin", name: "content-moderation" } as const
const HISTORY_KEY = "article-republish-history-v1"

/** The document-service params the middleware reads and may amend. */
interface ArticleWriteParams {
  documentId?: unknown
  locale?: unknown
  status?: unknown
  data?: Record<string, unknown> | null
}

/** Query an article (or Article Change) table by its string uid. */
const articleQuery = (strapi: Core.Strapi, uid: string) =>
  strapi.db.query(uid as UID.Schema)

/** The locales a publish touches; `null` for every locale (`"*"`). */
async function publishLocales(
  strapi: Core.Strapi,
  locale: unknown
): Promise<string[] | null> {
  if (locale === "*") return null
  const listed = (Array.isArray(locale) ? locale : [locale]).filter(
    (l): l is string => typeof l === "string" && l.length > 0
  )
  if (listed.length > 0) return listed
  const fallback = await strapi
    .plugin?.("i18n")
    ?.service?.("locales")
    ?.getDefaultLocale?.()

  return fallback ? [fallback] : null
}

/** The first publication stamps the draft; publish copies it to the live version. */
async function stampOnPublish(
  strapi: Core.Strapi,
  uid: string,
  documentId: string,
  locale: unknown
): Promise<void> {
  const locales = await publishLocales(strapi, locale)
  await articleQuery(strapi, uid).updateMany({
    where: {
      documentId,
      publishedAt: null,
      publicationDate: null,
      ...(locales ? { locale: { $in: locales } } : {}),
    },
    data: { publicationDate: new Date() },
  })
}

/** A create or update straight to published fills an empty date in the data. */
async function stampPublishedWrite(
  strapi: Core.Strapi,
  uid: string,
  action: string,
  params: ArticleWriteParams,
  data: Record<string, unknown>
): Promise<void> {
  const current =
    action === "update" && typeof params.documentId === "string"
      ? ((await articleQuery(strapi, uid).findOne({
          where: {
            documentId: params.documentId,
            publishedAt: null,
            ...(typeof params.locale === "string" && params.locale !== "*"
              ? { locale: params.locale }
              : {}),
          },
          select: ["publicationDate"],
        })) as { publicationDate?: unknown } | null)
      : null
  if (!current?.publicationDate) data.publicationDate = new Date().toISOString()
}

export function registerPublicationDateMiddleware({
  strapi,
}: {
  strapi: Core.Strapi
}): void {
  strapi.documents.use(
    async (
      context: { uid: string; action: string; params?: unknown },
      next
    ) => {
      const { uid, action } = context
      if (!ARTICLE_UIDS.has(uid)) return next()
      const params = (context.params ?? {}) as ArticleWriteParams

      if (action === "publish" && typeof params.documentId === "string") {
        await stampOnPublish(strapi, uid, params.documentId, params.locale)
      } else if (
        (action === "create" || action === "update") &&
        params.status === "published" &&
        params.data &&
        params.data.publicationDate == null
      ) {
        await stampPublishedWrite(strapi, uid, action, params, params.data)
      }

      return next()
    }
  )
}

const earliest = (...dates: unknown[]): Date | null => {
  const times = dates
    .map((d) => (d ? new Date(d as string).getTime() : Number.NaN))
    .filter((t) => Number.isFinite(t))

  return times.length > 0 ? new Date(Math.min(...times)) : null
}

/**
 * Published articles without a Publication Date take their first recorded
 * publication, or their current `publishedAt` when that is earlier (articles
 * published before Article Changes existed). Idempotent.
 */
export async function backfillArticlePublicationDates(
  strapi: Core.Strapi
): Promise<number> {
  let filled = 0
  for (const uid of ARTICLE_UIDS) {
    for (;;) {
      const rows = (await articleQuery(strapi, uid).findMany({
        where: {
          publishedAt: { $notNull: true },
          publicationDate: { $null: true },
        },
        select: ["id", "documentId", "locale", "publishedAt"],
        orderBy: { id: "asc" },
        limit: 100,
      })) as {
        documentId: string
        locale: string | null
        publishedAt: string
      }[]
      if (rows.length === 0) break
      for (const row of rows) {
        const first = (await articleQuery(strapi, ARTICLE_CHANGE).findOne({
          where: {
            articleKind: KIND[uid],
            articleDocumentId: row.documentId,
            contentLocale: row.locale,
            versionStatus: "published",
            kind: "published",
          },
          select: ["changedAt"],
          orderBy: [{ changedAt: "asc" }, { id: "asc" }],
        })) as { changedAt?: unknown } | null
        await articleQuery(strapi, uid).updateMany({
          where: {
            documentId: row.documentId,
            locale: row.locale,
            publicationDate: null,
          },
          data: {
            publicationDate: earliest(first?.changedAt, row.publishedAt),
          },
        })
        filled++
      }
    }
  }
  if (filled > 0)
    strapi.log.info(
      `[publication-date] Set the publication date on ${filled} article versions`
    )

  return filled
}

/**
 * One-off: before republishes were told apart, every republish of a live
 * article was recorded as `published`. A `published` row for a locale that
 * was already live becomes `edited`. Rows are append-only and inserted in
 * time order, so id order is chronological. Guarded by a core-store flag.
 */
interface ArticleChangeRow {
  id: number
  articleKind: string
  articleDocumentId: string
  contentLocale: string | null
  kind: string
}

/**
 * The ids of `published` rows for a locale that was already live, tracking
 * liveness per article locale in `live` across pages.
 */
function republishedIds(
  rows: ArticleChangeRow[],
  live: Map<string, boolean>
): number[] {
  const republished: number[] = []
  for (const row of rows) {
    const key = `${row.articleKind}:${row.articleDocumentId}:${row.contentLocale ?? ""}`
    if (row.kind === "published") {
      if (live.get(key)) republished.push(row.id)
      live.set(key, true)
    } else if (row.kind === "unpublished" || row.kind === "deleted")
      live.set(key, false)
  }

  return republished
}

export async function normaliseArticleRepublishHistory(
  strapi: Core.Strapi
): Promise<number> {
  const store = strapi.store(HISTORY_STORE)
  if (await store.get({ key: HISTORY_KEY })) return 0
  const live = new Map<string, boolean>()
  let lastId = 0
  let corrected = 0
  for (;;) {
    const rows = (await articleQuery(strapi, ARTICLE_CHANGE).findMany({
      where: { id: { $gt: lastId }, versionStatus: "published" },
      select: [
        "id",
        "articleKind",
        "articleDocumentId",
        "contentLocale",
        "kind",
      ],
      orderBy: { id: "asc" },
      limit: 500,
    })) as ArticleChangeRow[]
    if (rows.length === 0) break
    const republished = republishedIds(rows, live)
    if (republished.length > 0)
      await articleQuery(strapi, ARTICLE_CHANGE).updateMany({
        where: { id: { $in: republished } },
        data: { kind: "edited" },
      })
    corrected += republished.length
    lastId = rows.at(-1)!.id
  }
  await store.set({
    key: HISTORY_KEY,
    value: { corrected, at: new Date().toISOString() },
  })
  if (corrected > 0)
    strapi.log.info(
      `[publication-date] Recorded ${corrected} article republishes as edits`
    )

  return corrected
}
