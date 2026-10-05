import { createHash, randomUUID } from "node:crypto"

import {
  type ChangeContext,
  resolveChangeContext,
} from "../utils/change-context"
import {
  diffVersions,
  normaliseForDiff,
  stableStringify,
  trackedAttributes,
  type TrackedAttributes,
} from "../utils/change-diff"

/**
 * Change Records and Article Changes: a document-service middleware that
 * records every write to a library (one row per changed field) and to a
 * Knowledge or Journal article (one row per write), whoever made it: admin
 * panel, API token, import script or an approved submission.
 *
 * Writes through `strapi.db.query` (the completeness lifecycle, compare-and-
 * set updates) bypass it by design: they are derived fields.
 *
 * The inserts are awaited and never caught. Inside `strapi.db.transaction`
 * a failed insert therefore fails, and rolls back, the write it describes.
 *
 * Cost per write: a library update reads the version before and after, and
 * inserts one batch of rows. Ingest and import scripts must batch their
 * writes (CLAUDE.md "Scale target": bulk imports bypass per-row paths);
 * an import token's `create` (source `import`) skips the read after the
 * write and records one `*` row from what the create returned.
 */

const LIBRARY = "api::library.library"
const WIKI = "api::wiki-article.wiki-article"
const BLOG = "api::blog-article.blog-article"
const LIBRARY_CHANGE = "api::library-change.library-change"
const ARTICLE_CHANGE = "api::article-change.article-change"

const ARTICLE_KIND: Record<string, "wiki" | "blog"> = {
  [WIKI]: "wiki",
  [BLOG]: "blog",
}
const TRACKED_UIDS = new Set([LIBRARY, WIKI, BLOG])

type Action = "create" | "update" | "delete" | "publish" | "unpublish"
const TRACKED_ACTIONS = new Set<string>([
  "create",
  "update",
  "delete",
  "publish",
  "unpublish",
])

/** Never diffed: identity, bookkeeping and derived fields. */
export const LIBRARY_IGNORED: ReadonlySet<string> = new Set([
  "id",
  "documentId",
  "locale",
  "createdAt",
  "updatedAt",
  "publishedAt",
  "createdBy",
  "updatedBy",
  "localizations",
  "completeness",
  // Derived from the location slugs by the entityRef lifecycle, which
  // rewrites it with a nested document update; every row still carries it
  // in the `entityRef` column.
  "entityRef",
])

type Doc = Record<string, unknown>
type Status = "draft" | "published"

const ARTICLE_KIND_BY_ACTION: Record<Action, string> = {
  create: "created",
  update: "edited",
  publish: "published",
  unpublish: "unpublished",
  delete: "deleted",
}

const isDisabled = () => process.env.CHANGE_RECORDS_ENABLED === "false"

/**
 * Relations by `documentId`, media by file `id`, components and dynamic
 * zones one level deep: relations and media nested inside a component or a
 * dynamic-zone block are not loaded, so they are not diffed and do not
 * feed an article's `bodyHash`.
 */
function populateFor(attrs: TrackedAttributes): Record<string, unknown> {
  const populate: Record<string, unknown> = {}
  for (const f of attrs.relations) populate[f] = { fields: ["documentId"] }
  for (const f of attrs.media) populate[f] = { fields: ["id"] }
  for (const f of attrs.components) populate[f] = true

  return populate
}

async function defaultLocale(strapi: any): Promise<string | undefined> {
  const service = strapi.plugin?.("i18n")?.service?.("locales")
  if (!service?.getDefaultLocale) return undefined

  return (await service.getDefaultLocale()) ?? undefined
}

const asStatus = (v: unknown): Status =>
  v === "published" ? "published" : "draft"

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")

const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null

type Snapshot = {
  locale: string | undefined
  before: Doc | null
  draftBefore: Doc | null
  publishedBefore: Doc | null
}

type RecordArgs = {
  strapi: any
  action: Action
  attrs: TrackedAttributes
  documentId: string
  after: Doc | null
  snap: Snapshot
  versionStatus: Status
  actor: ChangeContext
  changedAt: string
}

/**
 * The locales a write touches. A single locale (or the default), each
 * entry of a locale array; for a
 * `delete`, `publish` or `unpublish` with `locale: "*"`, every locale the
 * document has, since `findOne` cannot read `"*"`.
 */
async function localesFor(
  strapi: any,
  uid: string,
  action: Action,
  documentId: unknown,
  locale: unknown
): Promise<(string | undefined)[]> {
  // An array of locales (Content Manager bulk publish/unpublish/delete);
  // Strapi's checkLocale treats an empty one as no locale.
  if (Array.isArray(locale)) {
    const listed = [
      ...new Set(
        locale.filter((l): l is string => typeof l === "string" && l.length > 0)
      ),
    ]

    return listed.length > 0 ? listed : [await defaultLocale(strapi)]
  }
  if (locale !== "*") {
    if (typeof locale === "string" && locale.length > 0) return [locale]

    return [await defaultLocale(strapi)]
  }
  if (
    action === "create" ||
    action === "update" ||
    typeof documentId !== "string"
  )
    return []
  const rows = (await strapi.documents(uid).findMany({
    filters: { documentId: { $eq: documentId } },
    locale: "*",
    status: action === "unpublish" ? "published" : "draft",
    fields: ["locale"],
    sort: "id:asc",
  })) as { locale?: string | null }[]

  return [
    ...new Set(
      rows
        .map((r) => r.locale)
        .filter((l): l is string => typeof l === "string")
    ),
  ]
}

const FIELD_GROUPS = (attrs: TrackedAttributes) => [
  ...attrs.scalars,
  ...attrs.relations,
  ...attrs.components,
  ...attrs.media,
]

type Change = { field: string; previous: unknown; next: unknown }

/**
 * A value for the `previous`/`next` jsonb columns. Strapi's JSON field
 * stringifies objects but passes a string through as is, and Postgres
 * rejects `Old Library` as JSON: encode strings here. Strapi parses them
 * back on read.
 */
function jsonColumn(value: unknown): unknown {
  return typeof value === "string" ? JSON.stringify(value) : value
}

/** The Change Records one library write produces, before actor fields. */
function libraryChanges(
  action: Action,
  prev: Doc | null,
  next: Doc | null,
  fields: readonly string[]
): Change[] {
  switch (action) {
    case "update":
    case "publish": {
      if (!next) return []
      // No previous version (a first publish, or a write that creates a new
      // locale version): one snapshot row, like create.
      if (!prev) return [{ field: "*", previous: null, next }]
      const changes = diffVersions(prev, next, fields)

      // An unchanged publish is still an event; a no-op update is not.
      if (changes.length > 0 || action === "update") return changes

      return [{ field: "*", previous: null, next: null }]
    }
    case "create":
      return next ? [{ field: "*", previous: null, next }] : []

    default:
      // delete, unpublish: the removed version.
      return prev ? [{ field: "*", previous: prev, next: null }] : []
  }
}

/**
 * The versions a write replaces: `before` (same status as the write),
 * the draft (to tell an edit from a new translation, and for publish) and
 * the published version (a delete of a published document is public).
 */
async function captureBefore(
  load: (status: Status) => Promise<Doc | null>,
  action: Action,
  readStatus: Status,
  locale: string | undefined
): Promise<Snapshot> {
  if (action === "create")
    return { locale, before: null, draftBefore: null, publishedBefore: null }
  const before = await load(readStatus)
  const draftBefore = readStatus === "draft" ? before : await load("draft")
  let publishedBefore: Doc | null = null
  if (action === "unpublish") publishedBefore = before
  else if (action === "delete") publishedBefore = await load("published")

  return { locale, before, draftBefore, publishedBefore }
}

/**
 * `published` for writes that change the public version (publish,
 * unpublish, a delete of a published document); otherwise the written
 * status.
 */
function versionStatusFor(
  action: Action,
  writeStatus: Status,
  snap: Snapshot
): Status {
  if (action === "publish" || action === "unpublish") return "published"
  if (action === "delete") return snap.publishedBefore ? "published" : "draft"

  return writeStatus
}

/**
 * `normaliseForDiff` for a document read without `populate` (what a
 * `create` returns): relations and media it doesn't carry are left out
 * rather than recorded as empty.
 */
function normaliseLoaded(doc: Doc, attrs: TrackedAttributes): Doc {
  const out = normaliseForDiff(doc, attrs)
  for (const f of [...attrs.relations, ...attrs.media])
    if (!(f in doc)) delete out[f]

  return out
}

async function recordLibrary(
  args: RecordArgs & { batchId: string; unpopulated?: boolean }
) {
  const { strapi, action, attrs, documentId, after, snap, actor } = args
  // A delete that removes a published version is public: describe what the
  // public saw, never unpublished draft edits.
  const removed =
    action === "delete" && args.versionStatus === "published"
      ? snap.publishedBefore
      : snap.before
  const prev = removed ? normaliseForDiff(removed, attrs) : null
  let nextDoc: Doc | null = null
  if (after)
    nextDoc = args.unpopulated
      ? normaliseLoaded(after, attrs)
      : normaliseForDiff(after, attrs)
  const changes = libraryChanges(action, prev, nextDoc, FIELD_GROUPS(attrs))
  if (changes.length === 0) return

  const entityRef =
    str(after?.entityRef) ??
    str(snap.before?.entityRef) ??
    str(snap.draftBefore?.entityRef)
  const rows = changes.map((change) => ({
    batchId: args.batchId,
    libraryDocumentId: documentId,
    entityRef,
    contentLocale: snap.locale ?? null,
    versionStatus: args.versionStatus,
    action,
    field: change.field,
    previous: jsonColumn(change.previous),
    next: jsonColumn(change.next),
    source: actor.source,
    actorKind: actor.actorKind,
    actorId: actor.actorId,
    actorName: actor.actorName ?? null,
    reviewerId: actor.reviewerId ?? null,
    submissionDocumentId: actor.submissionDocumentId ?? null,
    changedAt: args.changedAt,
    // What the Document Service sets on a type without draft & publish.
    publishedAt: new Date(args.changedAt),
  }))

  // One INSERT per batch, not one Document Service create per field (CLAUDE.md
  // "Scale target": bulk writes bypass per-row paths). `library-change` is
  // an append-only log with no draft & publish, no relations and no
  // lifecycles, so the query engine writes the same row the Document Service
  // would (documentId and timestamps come from the model defaults). It joins
  // the surrounding `strapi.db.transaction`, so a failed insert still rolls
  // back the write it describes.
  await strapi.db.query(LIBRARY_CHANGE).createMany({ data: rows })
}

async function recordArticle(args: RecordArgs & { uid: string }) {
  const { strapi, action, attrs, documentId, after, snap, actor } = args
  if ((action === "delete" || action === "unpublish") && !snap.before) return
  if ((action === "create" || action === "update") && !after) return
  const kind =
    action === "update" && !snap.draftBefore
      ? "translated"
      : ARTICLE_KIND_BY_ACTION[action]
  const body = after ? normaliseForDiff(after, attrs).body : undefined

  await strapi.documents(ARTICLE_CHANGE).create({
    data: {
      articleKind: ARTICLE_KIND[args.uid],
      articleDocumentId: documentId,
      slug:
        str(after?.slug) ??
        str(snap.before?.slug) ??
        str(snap.draftBefore?.slug),
      contentLocale: snap.locale ?? null,
      versionStatus: args.versionStatus,
      kind,
      actorKind: actor.actorKind,
      actorId: actor.actorId,
      actorName: actor.actorName ?? null,
      reviewerId: actor.reviewerId ?? null,
      submissionDocumentId: actor.submissionDocumentId ?? null,
      editSummary: actor.editSummary ?? null,
      bodyHash: after ? sha256(stableStringify(body)) : null,
      changedAt: args.changedAt,
    },
  })
}

export function registerChangeRecordsMiddleware({
  strapi,
}: {
  strapi: any
}): void {
  if (isDisabled())
    strapi.log.warn(
      "[change-records] CHANGE_RECORDS_ENABLED=false: library and article writes are NOT being recorded"
    )

  strapi.documents.use(
    async (
      context: { uid: string; action: string; params?: any; contentType?: any },
      next: () => Promise<unknown>
    ) => {
      if (
        !TRACKED_UIDS.has(context.uid) ||
        !TRACKED_ACTIONS.has(context.action) ||
        isDisabled()
      )
        return next()

      const uid = context.uid
      const action = context.action as Action
      const params = context.params ?? {}
      const schema = context.contentType ?? strapi.contentType(uid)
      const attrs = trackedAttributes(schema, LIBRARY_IGNORED)
      const populate = populateFor(attrs)

      const writeStatus = asStatus(params.status)
      const readStatus: Status =
        action === "publish" || action === "unpublish"
          ? "published"
          : writeStatus

      const load = async (
        documentId: unknown,
        locale: string | undefined,
        status: Status
      ): Promise<Doc | null> => {
        if (typeof documentId !== "string" || documentId.length === 0)
          return null
        const doc = await strapi
          .documents(uid)
          .findOne({ documentId, locale, status, populate })

        // A copy: the "before" version must not see the write.
        return doc ? (structuredClone(doc) as Doc) : null
      }

      // Who is writing; read before the write so an import's create can
      // skip the reads it doesn't need.
      const actor = resolveChangeContext(strapi)
      const importCreate =
        uid === LIBRARY && action === "create" && actor.source === "import"

      const locales = await localesFor(
        strapi,
        uid,
        action,
        params.documentId,
        params.locale
      )

      // Before the write, per locale.
      const snapshots: Snapshot[] = []
      for (const locale of locales)
        snapshots.push(
          await captureBefore(
            (status) => load(params.documentId, locale, status),
            action,
            readStatus,
            locale
          )
        )

      const result = (await next()) as Doc | null | undefined

      const documentId =
        (params.documentId as string | undefined) ??
        (typeof result?.documentId === "string" ? result.documentId : null)
      if (!documentId) return result

      const changedAt = new Date().toISOString()
      const batchId = randomUUID()

      for (const snap of snapshots) {
        let after: Doc | null = null
        if (importCreate) after = result ?? null
        else if (action !== "delete" && action !== "unpublish")
          after = await load(documentId, snap.locale, readStatus)
        const versionStatus = versionStatusFor(action, writeStatus, snap)
        const common = {
          strapi,
          action,
          attrs,
          documentId,
          after,
          snap,
          versionStatus,
          actor,
          changedAt,
        }
        await (uid === LIBRARY
          ? recordLibrary({ ...common, batchId, unpopulated: importCreate })
          : recordArticle({ ...common, uid }))
      }

      return result
    }
  )
}
