import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"
import type {
  Actor,
  DiscussionConfig,
  TargetResolver,
} from "strapi-plugin-discussions/types"

import { publicArticleProfile } from "./article-attribution"
import { activeGrants } from "./role-grants"
import { isValidServiceSecret } from "../plugins/content-moderation/server/utils/service-secret"

const PROFILE = "api::user-profile.user-profile"
const PREFIX = "ba:"
const ACTIONS = [
  "read",
  "createThread",
  "reply",
  "editOwn",
  "report",
  "subscribe",
] as const

async function profileOf(strapi: any, userId: string) {
  if (!userId || userId.length > 128) return null

  return strapi.db
    .query(PROFILE)
    .findOne({ where: { baUserId: userId }, populate: { avatar: true } })
}

export async function discussionActor(
  strapi: any,
  userId: string
): Promise<Actor | null> {
  const profile = await profileOf(strapi, userId)
  if (!profile) return null
  const grants = await activeGrants(strapi, userId)
  const moderator = grants.some(
    (grant) =>
      grant.role === "editorial_board" ||
      (grant.role === "moderator" &&
        ["all", "discussions"].includes(grant.queue))
  )
  const publicProfile = publicArticleProfile(profile)
  const username =
    typeof publicProfile?.username === "string" ? publicProfile.username : null

  return {
    key: `${PREFIX}${userId}`,
    name: username ? `@${username}` : "Community member",
    ...(username
      ? {
          profile: {
            slug: username,
            url: `/profile/${encodeURIComponent(username)}`,
          },
        }
      : {}),
    capabilities: [...ACTIONS, ...(moderator ? ["moderate" as const] : [])],
  }
}

export async function publicDiscussionAuthor(
  key: string,
  { strapi }: { strapi: any }
) {
  const actor = key.startsWith(PREFIX)
    ? await discussionActor(strapi, key.slice(PREFIX.length))
    : null

  return { name: actor?.name ?? "Community member", ...actor?.profile }
}

const articleTarget: TargetResolver = async (target, { strapi }) => {
  const journal = target.uid === "api::blog-article.blog-article"
  const article = await strapi.documents(target.uid).findOne({
    documentId: target.documentId,
    status: "published",
    ...(target.locale ? { locale: target.locale } : {}),
    fields: ["title", "slug", "locale", ...(!journal ? ["docsSections"] : [])],
    populate: { section: { fields: ["slug"] } },
  })
  if (!article?.slug) return null
  const section =
    article.section?.slug ||
    (!journal && article.docsSections?.[0]) ||
    (journal ? "news" : "getting-started")
  const language = article.locale || DEFAULT_LOCALE
  const interfaceLocale = isSupportedLocale(language)
    ? language
    : DEFAULT_LOCALE
  const languageQuery =
    language === interfaceLocale
      ? ""
      : `?contentLang=${encodeURIComponent(language)}`

  return {
    title: article.title,
    url: `/${interfaceLocale}/${journal ? "journal" : "knowledge"}/${encodeURIComponent(section)}/${encodeURIComponent(article.slug)}${languageQuery}`,
  }
}

/** Host-specific adapters stay outside the independently installable plugin. */
export const discussionsHostConfig: Partial<DiscussionConfig> & {
  publicAuthor: typeof publicDiscussionAuthor
} = {
  identity: async (ctx, { strapi }) => {
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
      return null
    const id = ctx.request.headers["x-ba-user-id"]

    return typeof id === "string" ? discussionActor(strapi, id) : null
  },
  publicAuthor: publicDiscussionAuthor,
  authorize: async ({
    strapi,
    actor,
    action,
    subject,
    thread,
    recordLanguage,
  }) => {
    if (actor?.admin) return true
    if (
      action !== "moderate" &&
      subject.visibility !== "private" &&
      !(subject.createPolicy === "moderators" && action === "createThread")
    )
      return true
    if (!actor?.key.startsWith(PREFIX)) return false
    const grants = await activeGrants(strapi, actor.key.slice(PREFIX.length))

    return grants.some(
      (grant) =>
        grant.role === "editorial_board" ||
        (grant.role === "moderator" &&
          ["all", "discussions"].includes(grant.queue) &&
          (grant.locale === null ||
            grant.locale === (recordLanguage ?? thread?.language)))
    )
  },
  notificationActor: async (key, { strapi }) =>
    key.startsWith(PREFIX)
      ? discussionActor(strapi, key.slice(PREFIX.length))
      : null,
  targets: {
    "api::blog-article.blog-article": articleTarget,
    "api::wiki-article.wiki-article": articleTarget,
    "api::library.library": async (target, { strapi }) => {
      const library = await strapi.documents(target.uid).findOne({
        documentId: target.documentId,
        status: "published",
        fields: ["name", "slug"],
        populate: {
          continent: { fields: ["slug"] },
          country: { fields: ["slug"] },
          region: { fields: ["slug"] },
        },
      })
      if (
        !library?.slug ||
        !library.country?.slug ||
        !library.continent?.slug ||
        !library.region?.slug
      )
        return null
      const path = [
        library.continent.slug,
        library.country.slug,
        library.region?.slug,
        library.slug,
      ]
        .filter(Boolean)
        .map(encodeURIComponent)
        .join("/")

      return { title: library.name, url: `/${path}` }
    },
  },
  notify: async ({ idempotencyKey, actorKey, event }) => {
    if (!actorKey.startsWith(PREFIX)) return
    // Outbox delivery has already rechecked the recipient and target. Keep
    // private discussion text out of durable notification previews and emails.
    await strapi.service("api::notification.notification").enqueue({
      baUserId: actorKey.slice(PREFIX.length),
      kind: "discussion_update",
      eventKey: idempotencyKey,
      title: "A discussion you follow has an update",
      body: "Open the discussion to read the latest approved contribution.",
      href: `/community/discussions/${encodeURIComponent(event.threadId)}`,
    })
  },
}

export async function seedDiscussionSubjects(strapi: any) {
  const subjects = [
    [
      "library-life",
      "Library life",
      "Stories, visits and questions about libraries.",
    ],
    [
      "practice",
      "Library practice",
      "Share professional experience and ideas.",
    ],
    ["journal", "Journal", "Discuss library stories and reporting."],
    [
      "knowledge",
      "Knowledge",
      "Discuss the knowledge collection; propose article revisions through Contribute.",
    ],
  ]
  for (const [slug, name, description] of subjects) {
    const query = strapi.db.query("plugin::discussions.subject")
    if (!(await query.findOne({ where: { slug } })))
      await query.create({
        data: {
          slug,
          name,
          description,
          languages: [],
          visibility: "public",
          createPolicy: "members",
          version: 0,
        },
      })
  }
}
