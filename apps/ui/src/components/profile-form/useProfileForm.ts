"use client"

import { profilePalette, type ProfileBackground } from "@repo/shared-data"
import { useEffect, useState } from "react"

import { avatarSrc } from "@/lib/avatar"
import type { LanguageEntry, UserProfile } from "@/lib/types/profile"

import type { ClaimResult } from "./LibraryClaimSearch"
import {
  AFFILIATION_TYPES,
  affiliationCard,
  setupSteps,
  type UsernameStatus,
  type Visibility,
} from "./profile-form.model"

export type ClaimOutcome = ClaimResult & {
  libraryName: string
  entityRef: string
}

/**
 * The profile form's state, shared by onboarding and settings: every field,
 * the live username check, the progress rows and the save body. The caller
 * decides when to save and where to go after.
 */
export function useProfileForm({
  profile,
  sessionName,
  avatarUrl: initialAvatarUrl,
  imageUploadsEnabled = true,
}: {
  profile: UserProfile | null
  /** The session's name, to start the name fields before a profile exists. */
  sessionName: string
  /** The browser-safe avatar URL (`avatarSrc`), or null. */
  avatarUrl: string | null
  imageUploadsEnabled?: boolean
}) {
  // ── Identity ─────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState(
    profile?.firstName ?? sessionName.split(" ")[0] ?? ""
  )
  const [lastName, setLastName] = useState(
    profile?.lastName ?? sessionName.split(" ").slice(1).join(" ")
  )
  const [username, setUsername] = useState(profile?.username ?? "")
  const [pronouns, setPronouns] = useState<string>(profile?.pronouns ?? "")
  const [bio, setBio] = useState(profile?.bio ?? "")
  const [city, setCity] = useState(profile?.city ?? "")
  const [country, setCountry] = useState(profile?.country ?? "")
  const [timezone, setTimezone] = useState(profile?.timezone ?? "")
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "")
  const [profileBackground, setProfileBackground] = useState<ProfileBackground>(
    profilePalette(profile?.profileBackground).key
  )
  const [coverUrl, setCoverUrl] = useState(
    avatarSrc(profile?.coverImage, "lg") ?? ""
  )
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle")

  useEffect(() => {
    const u = username.trim()
    const t = setTimeout(async () => {
      if (!u || u === profile?.username) {
        setUsernameStatus("idle")

        return
      }
      setUsernameStatus("checking")
      try {
        const res = await fetch(
          `/api/profile/check-username?username=${encodeURIComponent(u)}`
        )
        const json = (await res.json()) as { available: boolean | null }
        setUsernameStatus(
          json.available === true
            ? "available"
            : json.available === false
              ? "taken"
              : "idle"
        )
      } catch {
        setUsernameStatus("idle")
      }
    }, 400)

    return () => clearTimeout(t)
  }, [username, profile?.username])

  // ── Affiliation ──────────────────────────────────────────────────
  const [affiliationType, setAffiliationType] = useState(
    affiliationCard(profile?.affiliationType)
  )
  const [jobTitle, setJobTitle] = useState(profile?.jobTitle ?? "")
  const [claimResult, setClaimResult] = useState<ClaimOutcome | null>(null)
  const selectedAffiliation = AFFILIATION_TYPES.find(
    (a) => a.value === affiliationType
  )

  // ── Interests & languages ────────────────────────────────────────
  const [interests, setInterests] = useState<string[]>(
    profile?.interests?.map((i) => i.documentId) ?? []
  )
  const [languages, setLanguages] = useState<LanguageEntry[]>(
    profile?.languages ?? []
  )

  // ── External links ───────────────────────────────────────────────
  const [website, setWebsite] = useState(profile?.website ?? "")
  const [orcid, setOrcid] = useState(profile?.orcid ?? "")
  const [mastodon, setMastodon] = useState(profile?.mastodon ?? "")
  const [linkedin, setLinkedin] = useState(profile?.linkedin ?? "")

  // ── Visibility ───────────────────────────────────────────────────
  const [visibility, setVisibility] = useState<Visibility>(
    profile?.profileVisibility ?? "public"
  )

  const initials =
    ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "?"

  const steps = (visibilityId?: string) =>
    setupSteps({
      identity: {
        firstName,
        username,
        pronouns,
        usernameTaken: usernameStatus === "taken",
      },
      affiliationLabel: selectedAffiliation?.label ?? null,
      topicCount: interests.length,
      languageCount: languages.length,
      linkCount: [website, orcid, mastodon, linkedin].filter((v) => v.trim())
        .length,
      visibility,
      visibilityId,
    })

  /**
   * The `PUT /api/profile/me` body. Settings saves visibility on its own,
   * as soon as it changes, so it leaves it out.
   */
  const payload = ({ visibility: withVisibility = true } = {}) => ({
    firstName,
    lastName,
    username: username.trim(),
    pronouns: pronouns || null,
    bio,
    city,
    country,
    timezone,
    profileBackground,
    affiliationType:
      (affiliationType as UserProfile["affiliationType"]) || null,
    jobTitle,
    interests,
    languages,
    website,
    orcid,
    mastodon,
    linkedin,
    ...(withVisibility ? { profileVisibility: visibility } : {}),
  })

  return {
    firstName,
    setFirstName,
    lastName,
    setLastName,
    username,
    setUsername,
    usernameStatus,
    pronouns,
    setPronouns,
    bio,
    setBio,
    city,
    setCity,
    country,
    setCountry,
    timezone,
    setTimezone,
    avatarUrl,
    setAvatarUrl,
    imageUploadsEnabled,
    initials,
    profileBackground,
    setProfileBackground,
    coverUrl,
    setCoverUrl,
    affiliationType,
    setAffiliationType,
    selectedAffiliation,
    jobTitle,
    setJobTitle,
    claimResult,
    setClaimResult,
    interests,
    setInterests,
    languages,
    setLanguages,
    website,
    setWebsite,
    orcid,
    setOrcid,
    mastodon,
    setMastodon,
    linkedin,
    setLinkedin,
    visibility,
    setVisibility,
    steps,
    payload,
  }
}

export type ProfileForm = ReturnType<typeof useProfileForm>
