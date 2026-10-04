import type { LanguageEntry, UserProfile } from "@/lib/types/profile"

import type { SetupStep } from "./ProfileProgress"

// The profile form shared by onboarding and settings: its options, the
// progress rows and the body sent to `PUT /api/profile/me`. Pure, so the
// rules can be tested without rendering.

export type Visibility = UserProfile["profileVisibility"]
export type Proficiency = LanguageEntry["proficiency"]
export type UsernameStatus = "idle" | "checking" | "available" | "taken"

/** Strapi has no bio limit; this is the page's. */
export const BIO_MAX = 400

export const PRONOUNS = [
  { value: "", label: "Choose your pronouns" },
  { value: "he_him", label: "He / Him" },
  { value: "she_her", label: "She / Her" },
  { value: "they_them", label: "They / Them" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

export const AFFILIATION_TYPES = [
  {
    value: "reader",
    label: "Reader / enthusiast",
    desc: "I use libraries for personal learning.",
    icon: "mdi:book-open-page-variant-outline",
    tint: { bg: "var(--tint-public-bg)", fg: "var(--tint-public-fg)" },
    showClaim: false,
  },
  {
    value: "researcher",
    label: "Researcher / academic",
    desc: "I use libraries as a primary research tool.",
    icon: "mdi:magnify",
    tint: { bg: "var(--tint-academic-bg)", fg: "var(--tint-academic-fg)" },
    showClaim: true,
  },
  {
    value: "librarian",
    label: "Librarian / archivist",
    desc: "I work in a library, archive, or special collection.",
    icon: "mdi:bookshelf",
    tint: { bg: "var(--tint-national-bg)", fg: "var(--tint-national-fg)" },
    showClaim: true,
  },
  {
    value: "other",
    label: "Something else",
    desc: "Author, publisher, journalist, student.",
    icon: "mdi:dots-horizontal",
    tint: { bg: "var(--tint-neutral-bg)", fg: "var(--tint-neutral-fg)" },
    showClaim: false,
  },
] as const

/**
 * The card a stored affiliation type selects. Two older values have no card
 * of their own: an archivist is a librarian here, an educator something else.
 */
export function affiliationCard(
  value: UserProfile["affiliationType"] | string | undefined
): string {
  if (value === "archivist") return "librarian"
  if (value === "educator") return "other"

  return value ?? ""
}

export const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ar", name: "Arabic" },
  { code: "zh", name: "Chinese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "ru", name: "Russian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "sv", name: "Swedish" },
  { code: "la", name: "Latin" },
  { code: "el", name: "Greek" },
]

export const PROFICIENCY = ["native", "fluent", "conversational"] as const

export const PROFICIENCY_LABEL: Record<Proficiency, string> = {
  native: "Native",
  fluent: "Fluent",
  conversational: "Conversational",
}

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: "Public",
  limited: "Limited",
  private: "Private",
}

/** "a", "a and b", "a, b and c". */
export function listOf(items: string[]): string {
  if (items.length < 2) return items.join("")

  return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`

/** The Identity row: done once the required fields are in and free. */
function identityStep(f: {
  firstName: string
  username: string
  pronouns: string
  usernameTaken: boolean
}): SetupStep {
  const missing = [
    ...(f.firstName.trim() ? [] : ["a display name"]),
    ...(f.username.trim() ? [] : ["a username"]),
    ...(f.pronouns ? [] : ["pronouns"]),
  ]
  let detail = `@${f.username.trim()}`
  if (f.usernameTaken) detail = "That username is taken"
  else if (missing.length > 0) detail = `Add ${listOf(missing)}`

  return {
    id: "identity",
    label: "Identity",
    required: true,
    done: missing.length === 0 && !f.usernameTaken,
    detail,
  }
}

/** One row per section card, in page order, for the progress card. */
export function setupSteps(f: {
  identity: Parameters<typeof identityStep>[0]
  affiliationLabel: string | null
  topicCount: number
  languageCount: number
  linkCount: number
  visibility: Visibility
  /** Where the visibility row links: its own card, or settings' Privacy. */
  visibilityId?: string
}): SetupStep[] {
  const interests = [
    f.topicCount ? plural(f.topicCount, "topic", "topics") : "",
    f.languageCount ? plural(f.languageCount, "language", "languages") : "",
  ].filter(Boolean)

  return [
    identityStep(f.identity),
    {
      id: "affiliation",
      label: "Affiliation",
      required: true,
      done: f.affiliationLabel !== null,
      detail: f.affiliationLabel ?? "Choose one",
    },
    {
      id: "interests",
      label: "Interests & languages",
      required: false,
      done: interests.length > 0,
      detail: interests.join(" · ") || "Topics and languages",
    },
    {
      id: "links",
      label: "External links",
      required: false,
      done: f.linkCount > 0,
      detail: f.linkCount
        ? plural(f.linkCount, "link", "links")
        : "Website, ORCID, social",
    },
    {
      id: f.visibilityId ?? "visibility",
      label: "Profile visibility",
      required: false,
      // Always set: it defaults to Public.
      done: true,
      detail: VISIBILITY_LABEL[f.visibility],
    },
  ]
}
