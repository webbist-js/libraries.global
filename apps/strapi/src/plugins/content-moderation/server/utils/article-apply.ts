import { canDirectEdit } from "@repo/access"

import {
  configuredLocales,
  defaultLocale,
  knownLocale,
  normaliseLocale,
  submissionLocale,
} from "./locales"
import { isDocumentId, isNewArticleDraft } from "./params"
import { applyToLocale } from "./publish-guard"
import { ownedUploadIds } from "./uploads"
import { sanitizeWikiBody } from "./wiki-body"

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
    /** Knowledge articles carry the docs taxonomy; Journal ones a section relation. */
    docsSections: boolean
    sectionUid: string | null
  }
> = {
  wiki: {
    uid: "api::wiki-article.wiki-article",
    editor: "docs",
    docsSections: true,
    sectionUid: null,
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
const SECTION_KEY = /^[a-z0-9-]{1,40}$/

export type ArticleTag = {
  kind: "topic" | "library" | "place" | "free"
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
      kind !== "topic" &&
      kind !== "library" &&
      kind !== "place" &&
      kind !== "free"
    )
      continue
    const label = cleanString(t.label, 80)
    if (!label) continue
    const tag: ArticleTag = { kind, label }
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
async function topicTargets(strapi: any, tags: ArticleTag[]) {
  const slugs = tags.flatMap((t) =>
    t.kind === "topic" && t.slug ? [t.slug] : []
  )
  if (slugs.length === 0) return []
  const rows = (await strapi.documents(TOPIC).findMany({
    filters: { slug: { $in: slugs }, status: { $eq: "approved" } },
    fields: ["documentId"],
    limit: slugs.length,
  })) as { documentId: string }[]

  return rows.map((r) => ({ documentId: r.documentId }))
}

/** Libraries named by the tags that actually exist, as connect targets. */
async function libraryTargets(strapi: any, tags: ArticleTag[]) {
  const ids = tags.flatMap((t) =>
    t.kind === "library" && t.documentId ? [t.documentId] : []
  )
  if (ids.length === 0) return []
  const rows = (await strapi.documents(LIBRARY).findMany({
    filters: { documentId: { $in: ids } },
    status: "published",
    fields: ["documentId"],
    limit: ids.length,
  })) as { documentId: string }[]

  return rows.map((r) => ({ documentId: r.documentId }))
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

async function journalSectionTarget(strapi: any, keys: string[]) {
  const slug = keys[0]
  if (!slug) return null
  const [section] = (await strapi
    .documents(TARGETS.journal.sectionUid)
    .findMany({
      filters: { slug: { $eq: slug } },
      fields: ["documentId"],
      limit: 1,
    })) as { documentId: string }[]

  return section ? { documentId: section.documentId } : null
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
  submitterBaUserId: unknown
): Promise<Record<string, unknown>> {
  const target = TARGETS[kind]
  const data: Record<string, unknown> = {}
  const sections = cleanSectionKeys(source.sections)
  if (target.docsSections && sections.length > 0) data.docsSections = sections
  if (target.sectionUid) {
    const section = await journalSectionTarget(strapi, sections)
    if (section) data.section = { set: [section] }
  }
  if (Array.isArray(source.tags)) {
    const tags = cleanTags(source.tags)
    data.topics = { set: await topicTargets(strapi, tags) }
    data.libraries = { set: await libraryTargets(strapi, tags) }
  }
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

export async function applyArticleSubmission(
  strapi: any,
  submission: any,
  kind: ArticleKind
): Promise<ApplyArticleOutcome> {
  const target = TARGETS[kind]
  const draftData = (submission.draftData ?? {}) as Record<string, unknown>
  const fields = (submission.fields ?? {}) as Record<string, unknown>
  const owned = await ownedUploadIds(
    strapi,
    submission.submittedByUserId,
    claimedImageIds(draftData.body ?? draftData.proposedBody)
  )
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
      submission.submittedByUserId
    )
    const contributors = relations.contributors as
      | { connect: { documentId: string }[] }
      | undefined
    delete relations.contributors

    const created = await strapi.documents(target.uid).create({
      locale,
      status: canPublish ? "published" : "draft",
      data: {
        title,
        slug,
        summary: summary ?? undefined,
        body,
        author:
          typeof submission.submittedByName === "string" &&
          submission.submittedByName.trim()
            ? submission.submittedByName.trim().slice(0, 120)
            : undefined,
        ...relations,
        ...(contributors ? { contributors } : {}),
      },
    })
    strapi.log.info(
      `[content-moderation] ${kind} ${submission.documentId}: created ${canPublish ? "published" : "draft"} article ${created?.documentId ?? slug}`
    )

    return canPublish ? "created_published" : "created_draft"
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
    if (!canPublish) {
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
    if (summary) data.summary = summary
    const body = cleanBody(draftData.body)
    if (body) data.body = body
    Object.assign(
      data,
      await relationData(strapi, kind, draftData, submission.submittedByUserId)
    )
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
    if (summary) data.summary = summary
    const body = cleanBody(draftData.proposedBody)
    if (body) data.body = body
    if (Object.keys(data).length === 0) return "noop"
    // Draft version only: an admin publishes from the Content Manager.
    await strapi.documents(target.uid).update({
      documentId: article.documentId,
      locale,
      status: "draft",
      data,
    })
    const profileId = await submitterProfileId(
      strapi,
      submission.submittedByUserId
    )
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
