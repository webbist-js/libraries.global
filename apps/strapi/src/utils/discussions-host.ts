import { DEFAULT_LOCALE, isSupportedLocale } from "@repo/shared-data"
import type {
  Actor,
  DiscussionConfig,
  PublicAuthorBadge,
  Target,
  TargetResolver,
} from "strapi-plugin-discussions/types"

import { publicArticleProfile } from "./article-attribution"
import { isBoardMember } from "./board"
import { publicAuthorRoleBadges } from "./public-author-badges"
import { activeGrants } from "./role-grants"
import { loadStaffClaims } from "./staff"
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
  "react",
  "upload",
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
    capabilities: [
      ...ACTIONS,
      ...(moderator ? ["moderate" as const] : []),
      ...(grants.some(
        (grant) =>
          grant.role === "editorial_board" ||
          (grant.role === "moderator" &&
            ["all", "discussions"].includes(grant.queue) &&
            grant.locale === null)
      )
        ? ["sanction" as const]
        : []),
    ],
  }
}

export async function publicDiscussionAuthor(
  key: string,
  { strapi, target }: { strapi: any; target?: Target }
) {
  const profile = key.startsWith(PREFIX)
    ? await profileOf(strapi, key.slice(PREFIX.length))
    : null
  const visible = publicArticleProfile(profile)
  const username =
    typeof visible?.username === "string" ? visible.username : null
  const avatar = visible?.avatar as
    | { url?: string; alternativeText?: string }
    | undefined
  const badges: PublicAuthorBadge[] = username
    ? await publicAuthorRoleBadges(strapi, key.slice(PREFIX.length))
    : []
  if (
    username &&
    target?.uid === "plugin::content-moderation.option-suggestion"
  ) {
    const suggestion = await strapi.documents(target.uid).findOne({
      documentId: target.documentId,
      fields: ["suggestedBy", "publicationStatus", "status"],
    })
    if (
      suggestion?.publicationStatus === "published" &&
      suggestion.status !== "removed" &&
      suggestion.suggestedBy === key.slice(PREFIX.length)
    )
      badges.push("suggested_this")
  }

  return {
    name: username ? `@${username}` : "Community member",
    ...(badges.length ? { badges } : {}),
    ...(username
      ? { slug: username, url: `/profile/${encodeURIComponent(username)}` }
      : {}),
    ...(avatar?.url
      ? {
          avatar: {
            url: avatar.url,
            alternativeText: avatar.alternativeText ?? "",
          },
        }
      : {}),
    ...(visible &&
    ["violet", "coral", "mint", "amber", "blue", "rose"].includes(
      profile.profileBackground
    )
      ? { background: profile.profileBackground }
      : {}),
  }
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
  mediaDirectory: process.env.DISCUSSIONS_MEDIA_DIRECTORY || undefined,
  contextKinds: {
    libraries: {
      uid: "api::library.library",
      label: "Libraries",
      defaultEnabled: true,
    },
    drives: { uid: "api::drive.drive", label: "Drives", defaultEnabled: false },
  },
  authorizeContext: async ({ strapi, actor, target }) => {
    if (!actor?.key.startsWith(PREFIX)) return false
    if (!["api::drive.drive", "api::library.library"].includes(target.uid))
      return false
    const userId = actor.key.slice(PREFIX.length)
    if (await isBoardMember(strapi, userId)) return "manage"
    if (
      target.uid === "api::library.library" &&
      (await loadStaffClaims(strapi, userId)).some(
        (claim) => claim.libraryDocumentId === target.documentId
      )
    )
      return "propose"

    return false
  },
  identity: async (ctx, { strapi }) => {
    if (!isValidServiceSecret(ctx.request.headers["x-service-secret"]))
      return null
    const id = ctx.request.headers["x-ba-user-id"]

    return typeof id === "string" ? discussionActor(strapi, id) : null
  },
  publicAuthor: publicDiscussionAuthor,
  profanityTerms: {
    en: ["fuck", "shit", "cunt", "motherfucker"],
    es: ["mierda", "joder", "puta"],
  },
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
      !["moderate", "sanction"].includes(action) &&
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
            (action !== "sanction" &&
              grant.locale === (recordLanguage ?? thread?.language))))
    )
  },
  notificationActor: async (key, { strapi }) =>
    key.startsWith(PREFIX)
      ? discussionActor(strapi, key.slice(PREFIX.length))
      : null,
  targets: {
    "api::drive.drive": async (target, { strapi, actor }) => {
      const locale =
        target.locale && isSupportedLocale(target.locale)
          ? target.locale
          : DEFAULT_LOCALE
      let drive = await strapi.documents(target.uid).findOne({
        documentId: target.documentId,
        locale,
        fields: ["title", "slug", "status"],
      })
      if (!drive && locale !== DEFAULT_LOCALE)
        drive = await strapi.documents(target.uid).findOne({
          documentId: target.documentId,
          locale: DEFAULT_LOCALE,
          fields: ["title", "slug", "status"],
        })
      if (!drive?.slug) return null
      if (
        !["scheduled", "open", "closed"].includes(drive.status) &&
        !(
          actor?.key.startsWith(PREFIX) &&
          (await isBoardMember(strapi, actor.key.slice(PREFIX.length)))
        )
      )
        return null

      return {
        title: drive.title,
        url: `/community/drives/${encodeURIComponent(drive.slug)}`,
        active: drive.status === "open",
      }
    },
    "plugin::content-moderation.option-suggestion": async (
      target,
      { strapi }
    ) => {
      const item = await strapi
        .documents(target.uid)
        .findOne({ documentId: target.documentId })
      if (
        !item ||
        item.status === "removed" ||
        item.publicationStatus !== "published"
      )
        return null

      return {
        title: item.name,
        url: `/community/suggestions?suggestion=${encodeURIComponent(target.documentId)}#suggestion-${encodeURIComponent(target.documentId)}`,
      }
    },
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

      return {
        title: library.name,
        url: `/${path}`,
        links: [
          {
            label: "Read stories",
            url: `/journal?collection=all&country=all&lang=all&library=${encodeURIComponent(target.documentId)}#all-articles`,
          },
        ],
      }
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
      "drives",
      "Drive coordination",
      "Questions, advice and updates about community drives.",
    ],
    [
      "suggestions",
      "Suggestions",
      "Discuss proposed additions to library checklists.",
    ],
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
