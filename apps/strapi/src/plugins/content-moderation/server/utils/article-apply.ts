import { canDirectEdit } from "@repo/access"
import { parseArticleSources, articleReadingMinutes } from "@repo/shared-data"

import {
  configuredLocales,
  defaultLocale,
  knownLocale,
  normaliseLocale,
  submissionLocale,
} from "./locales"
import { isDocumentId, isNewArticleDraft } from "./params"
import { ApplyRefusedError, applyToLocale } from "./publish-guard"
import { ownedUploadIds } from "./uploads"
import { sanitizeWikiBody } from "./wiki-body"
import { publicArticleProfile } from "../../../../utils/article-attribution"
import { articleRevision } from "../../../../utils/article-content"
import {
  articleImageIds,
  articleRelationRows,
  articleRelationConnector,
  articlePlaceRelations,
  buildArticleGeography,
  frozenArticleGeography,
  ownsJournalArticle,
  publicEventMentions,
  submissionArticle,
} from "../../../../utils/article-relations"

/**
 * Applies an approved Knowledge (`wiki_edit`) or Journal (`blog_submission`)
 * submission to its article.
 *
 * Three shapes of submission reach here:
 * - a new article (`draftData.kind: "new_article"`): created from the draft.
 *   Editors' articles are published; anyone else's is created as a Strapi
 *   draft for an admin to publish.
 * - a direct edit (`draftData.body` / `draftData.title` on an existing
 *   article): re-checked against the submitter's capability at apply time
 *   and published. Without the capability nothing is applied
 *   (`skipped_suggestion`), matching the create-time gate.
 * - a suggestion with content (`draftData.proposedBody` and friends): written
 *   to the article's *draft* version only, never published here.
 *
 * "noop" is reserved for genuine no-ops; anything else throws so the
 * approval is reverted rather than spent.
 */

export type ArticleKind = "wiki" | "journal"

export type ApplyArticleOutcome =
  | "published"
  | "drafted"
  /** A direct edit written to the draft only: the draft held unpublished admin edits. */
  | "drafted_divergent"
  | "created_published"
  | "created_draft"
  | "skipped_suggestion"
  | "noop"

const TARGETS: Record<
  ArticleKind,
  {
    uid: string
    /** The `@repo/access` editor kind whose locales may direct-edit. */
    editor: "docs" | "journal"
    /**
     * Both kinds file an article under its home section (the editor's first
     * pick). Knowledge articles also keep every pick in `docsSections`, so
     * one article can be listed in more than one section.
     */
    docsSections: boolean
    sectionUid: string
  }
> = {
  wiki: {
    uid: "api::wiki-article.wiki-article",
    editor: "docs",
    docsSections: true,
    sectionUid: "api::wiki-section.wiki-section",
  },
  journal: {
    uid: "api::blog-article.blog-article",
    editor: "journal",
    docsSections: false,
    sectionUid: "api::blog-section.blog-section",
  },
}

const TOPIC = "api::topic.topic"
const LIBRARY = "api::library.library"
const PROFILE = "api::user-profile.user-profile"

export const MAX_TITLE = 200
export const MAX_SUMMARY = 600
const MAX_TAGS = 20
const MAX_SECTIONS = 6
const SECTION_KEY = /^[a-z0-9-]{1,255}$/

export type ArticleTag = {
  kind:
    | "topic"
    | "library"
    | "place"
    | "free"
    | "continent"
    | "country"
    | "region"
    | "area"
    | "event"
  label: string
  slug?: string
  documentId?: string
}

function cleanString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()

  return t ? t.slice(0, max) : null
}

/** Section keys as the editor stores them: short slugs, deduplicated, capped. */
export function cleanSectionKeys(v: unknown): string[] {
  if (!Array.isArray(v)) return []

  return [
    ...new Set(
      v.filter((k): k is string => typeof k === "string" && SECTION_KEY.test(k))
    ),
  ].slice(0, MAX_SECTIONS)
}

/** Tags as the editor stores them; anything malformed is dropped. */
export function cleanTags(v: unknown): ArticleTag[] {
  if (!Array.isArray(v)) return []
  const out: ArticleTag[] = []
  for (const raw of v) {
    if (!raw || typeof raw !== "object") continue
    const t = raw as Record<string, unknown>
    const kind = t.kind
    if (
      ![
        "topic",
        "library",
        "continent",
        "country",
        "region",
        "area",
        "event",
      ].includes(String(kind))
    )
      continue
    const label = cleanString(t.label, 80)
    if (!label) continue
    const tag: ArticleTag = { kind: kind as ArticleTag["kind"], label }
    if (typeof t.slug === "string" && SECTION_KEY.test(t.slug))
      tag.slug = t.slug
    if (isDocumentId(t.documentId)) tag.documentId = t.documentId
    out.push(tag)
    if (out.length >= MAX_TAGS) break
  }

  return out
}

/** URL-safe slug from a title; falls back to "article". */
export function slugify(title: string): string {
  const s = title
    .normalize("NFKD")
    .replaceAll(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "")
    .slice(0, 80)

  return s || "article"
}

/** A slug no version of any article holds, in any locale. */
async function uniqueSlug(strapi: any, uid: string, base: string) {
  const taken = new Set<string | undefined>()
  for (const locale of await configuredLocales(strapi)) {
    const rows = (await strapi.documents(uid).findMany({
      filters: { slug: { $startsWith: base } },
      locale,
      fields: ["slug"],
      sort: "id:asc",
      limit: 200,
    })) as { slug?: string }[]
    for (const r of rows) taken.add(r.slug)
  }
  if (!taken.has(base)) return base
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) return candidate
  }

  return `${base}-${Date.now()}`
}

/** Approved topics named by the tags, as connect targets. */
async function topicTargets(strapi: any, tags: ArticleTag[], locale: string) {
  const slugs = tags.flatMap((t) =>
    t.kind === "topic" && t.slug ? [t.slug] : []
  )
  if (slugs.length === 0) return []
  const matched = await articleRelationRows(
    strapi,
    TOPIC,
    { slug: { $in: slugs }, status: { $eq: "approved" } },
    locale
  )
  if (!matched.length) return []
  const rows = await articleRelationRows(
    strapi,
    TOPIC,
    {
      documentId: { $in: matched.map((row) => row.documentId) },
      status: { $eq: "approved" },
    },
    locale
  )

  return rows.map((row) => articleRelationConnector(row, locale))
}

/** Libraries named by the tags that actually exist, as connect targets. */
async function libraryTargets(strapi: any, tags: ArticleTag[], locale: string) {
  const ids = tags.flatMap((t) =>
    t.kind === "library" && t.documentId ? [t.documentId] : []
  )
  if (ids.length === 0) return []
  const rows = await articleRelationRows(
    strapi,
    LIBRARY,
    { documentId: { $in: ids } },
    locale
  )

  return rows.map((row) => articleRelationConnector(row, locale))
}

async function submitterProfileId(strapi: any, baUserId: unknown) {
  if (typeof baUserId !== "string" || !baUserId) return null
  const [profile] = (await strapi.documents(PROFILE).findMany({
    filters: { baUserId: { $eq: baUserId } },
    fields: ["documentId"],
    limit: 1,
  })) as { documentId: string }[]

  return profile?.documentId ?? null
}

/** The section the first key names, by slug: the article's home section. */
async function sectionTarget(
  strapi: any,
  uid: string,
  keys: string[],
  locale: string
) {
  const slug = keys[0]
  if (!slug) return null
  const [matched] = await articleRelationRows(
    strapi,
    uid,
    { slug: { $eq: slug } },
    locale
  )
  if (!matched) return null
  const [section] = await articleRelationRows(
    strapi,
    uid,
    { documentId: { $eq: matched.documentId } },
    locale
  )

  return section ? articleRelationConnector(section, locale) : null
}

/**
 * The locale an article submission is written to: the submission's own
 * (stored as `contentLocale`), else the one its draft names, as a
 * configured locale; anything unknown falls back to the default locale.
 */
export async function articleLocale(
  strapi: any,
  submission: any
): Promise<string> {
  const draftData = (submission?.draftData ?? {}) as Record<string, unknown>

  return normaliseLocale(
    strapi,
    submissionLocale(submission) ?? draftData.locale
  )
}

/**
 * The article a submission targets, by its slug (shared by every locale):
 * the default-locale version when there is one, else the version in the
 * submission's locale.
 */
async function findArticle(
  strapi: any,
  uid: string,
  slug: string,
  locale: string
): Promise<{ documentId: string; locale?: string } | null> {
  const [article] = (await strapi.documents(uid).findMany({
    filters: { slug: { $eq: slug } },
    fields: ["documentId", "locale"],
    limit: 1,
  })) as { documentId: string; locale?: string }[]
  if (article) return article
  const [inLocale] = (await strapi.documents(uid).findMany({
    filters: { slug: { $eq: slug } },
    locale,
    fields: ["documentId", "locale"],
    limit: 1,
  })) as { documentId: string; locale?: string }[]

  return inLocale ?? null
}

/** Relation data shared by creates and edits: taxonomy, tags, credit. */
async function relationData(
  strapi: any,
  kind: ArticleKind,
  source: Record<string, unknown>,
  submitterBaUserId: unknown,
  locale: string
): Promise<Record<string, unknown>> {
  const target = TARGETS[kind]
  const data: Record<string, unknown> = {}
  const sections = cleanSectionKeys(source.sections)
  if (target.docsSections && sections.length > 0) data.docsSections = sections
  const section = await sectionTarget(
    strapi,
    target.sectionUid,
    sections,
    locale
  )
  if (section) data.section = { set: [section] }
  if (Array.isArray(source.tags)) {
    const tags = cleanTags(source.tags)
    data.topics = { set: await topicTargets(strapi, tags, locale) }
    data.libraries = { set: await libraryTargets(strapi, tags, locale) }
    Object.assign(data, await articlePlaceRelations(strapi, tags, locale))
  }
  if (kind === "journal" && Array.isArray(source.eventMentions))
    data.eventMentions = await publicEventMentions(
      strapi,
      source.eventMentions,
      locale
    )
  if (kind === "journal" && "sources" in source)
    data.sources = parseArticleSources(source.sources)
  const profileId = await submitterProfileId(strapi, submitterBaUserId)
  if (profileId) data.contributors = { connect: [{ documentId: profileId }] }

  return data
}

/** Image blocks may only reference files this submitter uploaded (A2). */
export function keepOwnedImages(
  body: unknown[] | null,
  owned: ReadonlySet<number>
): unknown[] | null {
  if (!body) return body

  return body.filter((block) => {
    if (!block || typeof block !== "object") return false
    const b = block as { __component?: unknown; image?: unknown }
    if (b.__component !== "content.image-block") return true
    const id = typeof b.image === "number" ? b.image : Number.NaN

    return Number.isInteger(id) && owned.has(id)
  })
}

function claimedImageIds(body: unknown): number[] {
  if (!Array.isArray(body)) return []

  return body.flatMap((b) =>
    b &&
    typeof b === "object" &&
    (b as { __component?: unknown }).__component === "content.image-block" &&
    Number.isInteger((b as { image?: unknown }).image)
      ? [(b as { image: number }).image]
      : []
  )
}

/**
 * Whether an approved article submission is a translation: it targets an
 * existing article, names one of Strapi's configured locales other than the
 * article's own, and that locale has no version yet. Decided from the target
 * and the i18n config, never from `fields.isTranslation` or an unchecked
 * locale (the submission's `locale`, else `draftData.locale`). Call it before applying: the apply creates the locale
 * version, after which the answer would be "no". The caller must still gate
 * points on the apply's outcome (a `noop` earns nothing).
 */
export async function isTranslationSubmission(
  strapi: any,
  submission: any,
  kind: ArticleKind
): Promise<boolean> {
  const draftData = (submission?.draftData ?? {}) as Record<string, unknown>
  if (isNewArticleDraft(draftData)) return false
  const locale = await knownLocale(
    strapi,
    submissionLocale(submission) ?? draftData.locale
  )
  const slug: string | undefined = submission?.targetSlug ?? undefined
  if (!locale || !slug) return false
  const uid = TARGETS[kind].uid
  const [source] = (await strapi.documents(uid).findMany({
    filters: { slug: { $eq: slug } },
    fields: ["documentId", "locale"],
    limit: 1,
  })) as { documentId: string; locale?: string }[]
  if (!source || source.locale === locale) return false
  const [existing] = (await strapi.documents(uid).findMany({
    filters: { slug: { $eq: slug } },
    locale,
    fields: ["documentId"],
    limit: 1,
  })) as { documentId: string }[]

  return !existing
}

/** What an article apply did, plus the article it created, if any. */
export type ApplyArticleResult = {
  outcome: ApplyArticleOutcome
  /** Set for `created_published` / `created_draft`. */
  documentId?: string
}

export type ApplyArticleOptions = {
  /**
   * A Moderator chose "Approve and publish": a suggestion or a non-editor's
   * new article is published (through the publish guard) instead of being
   * written as a draft. It changes the write mode only: a reader's direct
   * edit is still skipped, and points don't depend on it.
   */
  publish?: boolean
  /** Called with the new article's documentId when one is created. */
  onCreated?: (documentId: string) => void
}

/** `applyArticleSubmission`, also returning the created article's documentId. */
export async function applyArticleSubmissionWithResult(
  strapi: any,
  submission: any,
  kind: ArticleKind,
  opts: Omit<ApplyArticleOptions, "onCreated"> = {}
): Promise<ApplyArticleResult> {
  let documentId: string | undefined
  const outcome = await applyArticleSubmission(strapi, submission, kind, {
    ...opts,
    onCreated: (id) => {
      documentId = id
    },
  })

  return documentId ? { outcome, documentId } : { outcome }
}

export async function applyArticleSubmission(
  strapi: any,
  submission: any,
  kind: ArticleKind,
  opts: ApplyArticleOptions = {}
): Promise<ApplyArticleOutcome> {
  if (["pg", "postgres", "postgresql"].includes(strapi.db?.dialect?.client)) {
    return strapi.db.transaction(async ({ trx }: { trx: any }) => {
      await trx.raw("select pg_advisory_xact_lock(hashtextextended(?, 0))", [
        `article-submit:${TARGETS[kind].uid}:${submission.targetSlug ?? `new:${slugify(String(submission.draftData?.title ?? "article"))}`}`,
      ])

      return applyArticleSubmissionUnlocked(strapi, submission, kind, opts)
    })
  }

  return applyArticleSubmissionUnlocked(strapi, submission, kind, opts)
}

async function applyArticleSubmissionUnlocked(
  strapi: any,
  submission: any,
  kind: ArticleKind,
  opts: ApplyArticleOptions
): Promise<ApplyArticleOutcome> {
  const target = TARGETS[kind]
  const draftData = (submission.draftData ?? {}) as Record<string, unknown>
  const fields = (submission.fields ?? {}) as Record<string, unknown>
  const storedArticle = isNewArticleDraft(draftData)
    ? null
    : await submissionArticle(
        strapi,
        {
          ...submission,
          submissionType: kind === "wiki" ? "wiki_edit" : "blog_submission",
        },
        submissionLocale(submission)
      )
  const owned = await ownedUploadIds(
    strapi,
    submission.submittedByUserId,
    claimedImageIds(draftData.body ?? draftData.proposedBody)
  )
  for (const id of articleImageIds(storedArticle?.body)) owned.add(id)
  if (
    claimedImageIds(draftData.body ?? draftData.proposedBody).some(
      (id) => !owned.has(id)
    )
  ) {
    throw new ApplyRefusedError(
      "invalid_media",
      target.uid,
      storedArticle?.documentId ?? submission.documentId
    )
  }
  const cleanBody = (raw: unknown) =>
    keepOwnedImages(sanitizeWikiBody(raw), owned)

  // Re-check the submitter's rights at apply time, never trust the past.
  const { caps } = await strapi
    .plugin("content-moderation")
    .service("submission-policy")
    .loadCapabilities(submission.submittedByUserId)
  const locale = await articleLocale(strapi, submission)
  // Editors may be scoped to locales: the right is to publish in this one.
  const canPublish = canDirectEdit(caps, target.editor, locale)
  const publish = canPublish || opts.publish === true
  if (
    storedArticle &&
    typeof draftData.baseRevision === "string" &&
    draftData.baseRevision !== articleRevision(storedArticle)
  ) {
    throw new ApplyRefusedError(
      "stale_article",
      target.uid,
      storedArticle.documentId
    )
  }

  // ── New article ──────────────────────────────────────────────────────
  // `draftData.kind` alone decides (never `fields.kind`, which the
  // contributor controls and which the points tiers must not trust).
  if (isNewArticleDraft(draftData)) {
    const title =
      cleanString(draftData.title, MAX_TITLE) ??
      cleanString(fields.title, MAX_TITLE)
    if (!title) return "noop"
    const body = cleanBody(draftData.body) ?? []
    const summary =
      cleanString(draftData.summary, MAX_SUMMARY) ??
      cleanString(fields.summary, MAX_SUMMARY)
    const slug = await uniqueSlug(strapi, target.uid, slugify(title))
    const relations = await relationData(
      strapi,
      kind,
      { ...fields, ...draftData },
      submission.submittedByUserId,
      locale
    )
    const geographyFacet = await buildArticleGeography(strapi, relations)
    const [writer] = await strapi
      .documents("api::user-profile.user-profile")
      .findMany({
        filters: { baUserId: { $eq: submission.submittedByUserId } },
        fields: ["username", "profileVisibility", "publicPrefs"],
        limit: 1,
      })
    const publicWriter = publicArticleProfile(writer)
    const byline =
      cleanString(draftData.byline, 120) ??
      (typeof publicWriter?.username === "string"
        ? `@${publicWriter.username}`
        : "Community member")
    const contributors = relations.contributors as
      | { connect: { documentId: string }[] }
      | undefined
    delete relations.contributors

    const created = await strapi.documents(target.uid).create({
      locale,
      status: publish ? "published" : "draft",
      data: {
        title,
        slug,
        summary: summary ?? undefined,
        body,
        author: byline,
        ...(kind === "journal"
          ? {
              publicationOrigin:
                canPublish && draftData.publicationOrigin === "index"
                  ? "index"
                  : "community",
              ...(contributors?.connect[0]
                ? { authorProfile: { connect: [contributors.connect[0]] } }
                : {}),
            }
          : {}),
        readingTimeMinutes: articleReadingMinutes(body),
        geographyFacet,
        ...relations,
        ...(contributors ? { contributors } : {}),
      },
    })
    strapi.log.info(
      `[content-moderation] ${kind} ${submission.documentId}: created ${publish ? "published" : "draft"} article ${created?.documentId ?? slug}`
    )
    if (typeof created?.documentId === "string")
      opts.onCreated?.(created.documentId)

    return publish ? "created_published" : "created_draft"
  }

  // ── Existing article ─────────────────────────────────────────────────
  // A2: the target is whatever the moderator saw, never draftData.
  const slug: string | undefined = submission.targetSlug ?? undefined
  if (!slug) return "noop"
  const article = await findArticle(strapi, target.uid, slug, locale)
  if (!article) return "noop"

  const direct =
    Array.isArray(draftData.body) || typeof draftData.title === "string"
  const proposed =
    Array.isArray(draftData.proposedBody) ||
    typeof draftData.proposedTitle === "string" ||
    typeof draftData.proposedSummary === "string"

  if (direct) {
    const ownsArticle =
      kind === "journal" &&
      (await ownsJournalArticle(
        strapi,
        submission.submittedByUserId,
        submission
      ))
    if (!canPublish && !ownsArticle) {
      // A reader's draft can be turned into a direct-edit body after the
      // create-time check; defence in depth alongside the finalize CAS.
      strapi.log.warn(
        `[content-moderation] ${kind} ${submission.documentId} is a suggestion; apply it manually`
      )

      return "skipped_suggestion"
    }
    const data: Record<string, unknown> = {}
    const title = cleanString(draftData.title, MAX_TITLE)
    if (title) data.title = title
    const summary = cleanString(draftData.summary, MAX_SUMMARY)
    if (typeof draftData.summary === "string") data.summary = summary ?? ""
    const body = cleanBody(draftData.body)
    if (body) data.body = body
    if (body) data.readingTimeMinutes = articleReadingMinutes(body)
    Object.assign(
      data,
      await relationData(
        strapi,
        kind,
        draftData,
        submission.submittedByUserId,
        locale
      )
    )
    if (Array.isArray(draftData.tags))
      data.geographyFacet = await frozenArticleGeography(
        strapi,
        data,
        storedArticle
      )
    if (!publish) {
      await strapi.documents(target.uid).update({
        documentId: article.documentId,
        locale,
        status: "draft",
        data,
      })

      return "drafted"
    }
    if (Object.keys(data).length === 0) return "noop"
    // A locale the article has no version in yet is created (published)
    // from this edit: a translation.
    const { mode } = await applyToLocale(
      strapi,
      target.uid,
      article.documentId,
      data,
      { locale, defaultLocale: await defaultLocale(strapi) }
    )

    return mode === "draft_only" ? "drafted_divergent" : "published"
  }

  if (proposed) {
    const data: Record<string, unknown> = {}
    const title = cleanString(draftData.proposedTitle, MAX_TITLE)
    if (title) data.title = title
    const summary = cleanString(draftData.proposedSummary, MAX_SUMMARY)
    if (typeof draftData.proposedSummary === "string")
      data.summary = summary ?? ""
    const body = cleanBody(draftData.proposedBody)
    if (body) data.body = body
    if (body) data.readingTimeMinutes = articleReadingMinutes(body)
    Object.assign(
      data,
      await relationData(
        strapi,
        kind,
        draftData,
        submission.submittedByUserId,
        locale
      )
    )
    if (Array.isArray(draftData.tags))
      data.geographyFacet = await frozenArticleGeography(
        strapi,
        data,
        storedArticle
      )
    if (Object.keys(data).length === 0) return "noop"
    const profileId = await submitterProfileId(
      strapi,
      submission.submittedByUserId
    )
    if (opts.publish === true) {
      // "Approve and publish": through the publish guard, like a direct edit.
      if (profileId)
        data.contributors = { connect: [{ documentId: profileId }] }
      const { mode } = await applyToLocale(
        strapi,
        target.uid,
        article.documentId,
        data,
        { locale, defaultLocale: await defaultLocale(strapi) }
      )

      return mode === "draft_only" ? "drafted_divergent" : "published"
    }
    // Draft version only: an admin publishes from the Content Manager.
    await strapi.documents(target.uid).update({
      documentId: article.documentId,
      locale,
      status: "draft",
      data,
    })
    if (profileId)
      await strapi.documents(target.uid).update({
        documentId: article.documentId,
        locale,
        status: "draft",
        data: { contributors: { connect: [{ documentId: profileId }] } },
      })

    return "drafted"
  }

  return "noop"
}
