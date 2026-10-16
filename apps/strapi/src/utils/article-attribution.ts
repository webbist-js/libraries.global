import { isActivityPublic } from "./activity-visibility"

export const ARTICLE_PROFILE_FIELDS = [
  "username",
  "firstName",
  "lastName",
  "profileVisibility",
  "publicPrefs",
]

/** Always decide visibility before projecting identity from populated relations. */
export function publicArticleProfile(
  value: unknown
): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null
  const profile = value as Record<string, any>
  if (profile.profileVisibility !== "public" || !isActivityPublic(profile))
    return null
  const out: Record<string, unknown> = {}
  for (const field of ["documentId", "username", "firstName", "lastName"])
    if (profile[field] != null) out[field] = profile[field]
  if (profile.avatar && typeof profile.avatar === "object") {
    const avatar = profile.avatar
    out.avatar = {
      ...(avatar.url ? { url: avatar.url } : {}),
      ...(avatar.formats ? { formats: avatar.formats } : {}),
      ...(avatar.alternativeText
        ? { alternativeText: avatar.alternativeText }
        : {}),
    }
  }

  return out
}

export function projectArticleAttribution<T extends Record<string, any>>(
  article: T
): T {
  const out = { ...article }
  if ("authorProfile" in article)
    (out as Record<string, any>).authorProfile = publicArticleProfile(
      article.authorProfile
    )
  if (Array.isArray(article.contributors))
    (out as Record<string, any>).contributors = article.contributors.flatMap(
      (p: unknown) => {
        const publicProfile = publicArticleProfile(p)

        return publicProfile ? [publicProfile] : []
      }
    )
  if (Array.isArray(article.relatedArticles))
    (out as Record<string, any>).relatedArticles = article.relatedArticles.map(
      projectArticleAttribution
    )

  return out
}
