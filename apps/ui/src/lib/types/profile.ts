export type FollowedLibrary = {
  id: number
  documentId: string
  name: string
  slug: string
  libraryType?: string | null
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
  role?: string | null
  city?: string | null
  country?: string | null
  timezone?: string | null
  website?: string | null
  orcid?: string | null
  mastodon?: string | null
  linkedin?: string | null
  avatarUrl?: string | null
  avatarStrapiId?: string | null
  profileVisibility: "public" | "limited" | "private"
  isVerifiedLibrarian: boolean
  contributorNumber?: number | null
  languages?: LanguageEntry[]
  interests?: string[]
  notifPrefs: NotifPrefs
  followedLibraries?: FollowedLibrary[]
  points?: number | null
  pointsThisMonth?: number | null
  tier?: string | null
  streak?: number | null
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
  newFollowers: boolean
  editorialMessages: boolean
  soundOn: boolean
  marketing: boolean
}

export type PublicProfile = Omit<UserProfile, "notifPrefs">

export type Topic = {
  documentId: string
  name: string
  slug: string
  status: "approved" | "pending" | "rejected"
}
