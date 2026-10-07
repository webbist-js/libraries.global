export type FollowedLibrary = {
  id: number
  documentId: string
  name: string
  slug: string
  libraryType?: string | null
  heroImageUrl?: string | null
  /** Atlas path (/continent/country/region/slug); null when the hierarchy is incomplete */
  path?: string | null
}

/** A drive the profile holder follows: its page is `/community/drives/{slug}`. */
export type FollowedDrive = {
  documentId: string
  slug: string
}

export type FollowedUser = {
  username: string
  displayName: string
  avatarUrl?: string | null
  bio?: string | null
}

export type ClaimedLibrary = {
  entityRef: string | null
  documentId: string | null
  name: string | null
  slug: string | null
  libraryType: string | null
  heroImageUrl?: string | null
  /** Atlas path (/continent/country/region/slug); null when the hierarchy is incomplete */
  path?: string | null
}

export type AvatarMedia = {
  id: number
  url: string
  formats?: Record<string, { url: string }>
}

export type InterestTopic = {
  documentId: string
  name: string
  slug: string
}

export type UserProfile = {
  id: number
  username: string
  firstName: string
  lastName: string
  bio?: string | null
  pronouns?:
    | "he_him"
    | "she_her"
    | "they_them"
    | "other"
    | "prefer_not_to_say"
    | null
  affiliation?: string | null
  affiliationType?:
    | "reader"
    | "librarian"
    | "researcher"
    | "archivist"
    | "educator"
    | "other"
    | null
  jobTitle?: string | null
  city?: string | null
  country?: string | null
  timezone?: string | null
  website?: string | null
  orcid?: string | null
  mastodon?: string | null
  linkedin?: string | null
  avatar?: AvatarMedia | null
  profileVisibility: "public" | "limited" | "private"
  isVerifiedLibrarian: boolean
  contributorNumber?: number | null
  languages?: LanguageEntry[]
  interests?: InterestTopic[]
  notifPrefs: NotifPrefs
  publicPrefs?: PublicPrefs | null
  /** Owner view only: prompts hidden in Settings (`lib/dismissed-prompts.ts`). */
  dismissedPrompts?: string[] | null
  followedLibraries?: FollowedLibrary[]
  /** Drives past draft, when `publicPrefs.showFollows` lets the viewer see them. */
  followedDrives?: FollowedDrive[]
  followedProfiles?: FollowedUser[]
  claimedLibraries?: ClaimedLibrary[]
  points?: number | null
  pointsThisMonth?: number | null
  tier?: string | null
  streak?: number | null
  theme?: "dark" | "light" | null
  earnedBadges?: { badgeId: string; awardedAt: string }[]
  createdAt: string
  updatedAt: string
}

export type LanguageEntry = {
  code: string
  proficiency: "native" | "fluent" | "conversational"
}

export type NotifPrefs = {
  weeklyDigest: boolean
  editsReviewed: boolean
  drives?: boolean
  newFollowers: boolean
  editorialMessages: boolean
  soundOn: boolean
  marketing: boolean
}

/** Per-section public visibility toggles ("Manage what's public"). Defaults: all true. */
export type PublicPrefs = {
  showLocation: boolean
  showAffiliation: boolean
  showActivity: boolean
  /** Followed libraries and drives (and the people followed). */
  showFollows: boolean
}

export const DEFAULT_PUBLIC_PREFS: PublicPrefs = {
  showLocation: true,
  showAffiliation: true,
  showActivity: true,
  showFollows: true,
}

export function resolvePublicPrefs(
  prefs: PublicPrefs | null | undefined
): PublicPrefs {
  return { ...DEFAULT_PUBLIC_PREFS, ...prefs }
}

export type PublicProfile = Omit<UserProfile, "notifPrefs" | "dismissedPrompts">

export type Topic = {
  documentId: string
  name: string
  slug: string
  status: "approved" | "pending" | "rejected"
}

export type TierInfo = {
  level: number
  name: string
  nextName: string | null
  nextThreshold: number | null
  progressPercent: number
}

export type ContributingStanding = {
  firstName: string
  streak: number
  globalRank: number | null
  countryRank: number | null
  country: string | null
  tier: TierInfo
  totalPoints: number
  pointsToNext: number | null
  nextTierName: string | null
  pendingSubmissions: number
}
