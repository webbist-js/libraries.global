"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AvatarUpload } from "@/components/settings/AvatarUpload"
import { CountryCombobox } from "@/components/settings/CountryCombobox"
import { InterestsChips } from "@/components/settings/InterestsChips"
import { TimezoneCombobox } from "@/components/settings/TimezoneCombobox"
import { VisibilityCards } from "@/components/settings/VisibilityCards"
import { useProfile } from "@/hooks/useProfile"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "8px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.surface,
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: T.font.sans,
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: T.font.mono,
  fontSize: "9px",
  letterSpacing: ".16em",
  textTransform: "uppercase" as const,
  color: T.ink.faint,
  display: "block",
  marginBottom: "6px",
}

const PRONOUNS = [
  { value: "", label: "Not specified" },
  { value: "he_him", label: "He / Him" },
  { value: "she_her", label: "She / Her" },
  { value: "they_them", label: "They / Them" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

export function PublicProfileSection({
  profile,
  sessionUser,
}: {
  profile: UserProfile | null
  sessionUser: BetterAuthUser
}) {
  const { saving, updateProfile } = useProfile()
  const router = useRouter()
  const isIncomplete = !profile?.firstName || !profile?.affiliationType

  const [form, setForm] = useState({
    firstName: profile?.firstName ?? sessionUser.name.split(" ")[0] ?? "",
    lastName:
      profile?.lastName ?? sessionUser.name.split(" ").slice(1).join(" ") ?? "",
    username: profile?.username ?? "",
    pronouns: profile?.pronouns ?? "",
    bio: profile?.bio ?? "",
    affiliation: profile?.affiliation ?? "",
    affiliationType: profile?.affiliationType ?? "",
    jobTitle: profile?.jobTitle ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? "",
    timezone: profile?.timezone ?? "",
    website: profile?.website ?? "",
    orcid: profile?.orcid ?? "",
    mastodon: profile?.mastodon ?? "",
    linkedin: profile?.linkedin ?? "",
    profileVisibility: (profile?.profileVisibility ?? "public") as
      | "public"
      | "limited"
      | "private",
    interests: profile?.interests?.map((i) => i.documentId) ?? [],
    avatarUrl: profile?.avatar?.url ?? "",
  })

  const [checkedUsername, setCheckedUsername] = useState<string | null>(null)
  const [checkedResult, setCheckedResult] = useState<
    "available" | "taken" | null
  >(null)

  const field = useCallback(
    (key: keyof typeof form) => ({
      value: form[key] as string,
      onChange: (
        e: React.ChangeEvent<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
      ) => setForm((f) => ({ ...f, [key]: e.target.value })),
    }),
    [form]
  )

  useEffect(() => {
    const username = form.username.trim()
    if (!username || username === profile?.username) return
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/profile/check-username?username=${encodeURIComponent(username)}`
        )
        const json = (await res.json()) as { available: boolean | null }
        setCheckedUsername(username)
        setCheckedResult(
          json.available === true
            ? "available"
            : json.available === false
              ? "taken"
              : null
        )
      } catch {
        setCheckedUsername(null)
        setCheckedResult(null)
      }
    }, 400)

    return () => clearTimeout(t)
  }, [form.username, profile?.username])

  const usernameStatus = (() => {
    const username = form.username.trim()
    if (!username || username === profile?.username) return "idle" as const
    if (checkedUsername === username)
      return checkedResult ?? ("checking" as const)

    return "checking" as const
  })()

  const initials =
    ((form.firstName[0] ?? "") + (form.lastName[0] ?? "")).toUpperCase() || "?"

  const handleSave = async () => {
    if (usernameStatus === "taken") {
      toast.error("That username is taken")

      return
    }
    const newUsername = form.username.trim()
    const usernameChanged = newUsername && newUsername !== profile?.username
    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      username: newUsername,
      pronouns: form.pronouns,
      bio: form.bio,
      affiliation: form.affiliation,
      affiliationType: form.affiliationType,
      jobTitle: form.jobTitle,
      city: form.city,
      country: form.country,
      timezone: form.timezone,
      website: form.website,
      orcid: form.orcid,
      mastodon: form.mastodon,
      linkedin: form.linkedin,
      profileVisibility: form.profileVisibility,
      interests: form.interests,
    }
    const ok = await updateProfile(payload)
    if (ok && usernameChanged) {
      router.push(`/profile/${newUsername}`)
    }
  }

  const handleDiscard = () => {
    setForm({
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      username: profile?.username ?? "",
      pronouns: profile?.pronouns ?? "",
      bio: profile?.bio ?? "",
      affiliation: profile?.affiliation ?? "",
      affiliationType: profile?.affiliationType ?? "",
      jobTitle: profile?.jobTitle ?? "",
      city: profile?.city ?? "",
      country: profile?.country ?? "",
      timezone: profile?.timezone ?? "",
      website: profile?.website ?? "",
      orcid: profile?.orcid ?? "",
      mastodon: profile?.mastodon ?? "",
      linkedin: profile?.linkedin ?? "",
      profileVisibility: profile?.profileVisibility ?? "public",
      interests: profile?.interests?.map((i) => i.documentId) ?? [],
      avatarUrl: profile?.avatar?.url ?? "",
    })
    setCheckedUsername(null)
    setCheckedResult(null)
  }

  return (
    <div
      style={{
        border: `1px solid ${T.border.line}`,
        borderRadius: "12px",
        overflow: "hidden",
      }}
    >
      {/* Section header */}
      <div
        style={{
          padding: "20px 24px",
          borderBottom: `1px solid ${T.border.line}`,
          background: T.bg.surface,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 600,
            color: T.ink.base,
          }}
        >
          Your profile
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: "13px", color: T.ink.faint }}>
          {form.profileVisibility === "private"
            ? "Your profile is private — only visible to you. Your email is never shown."
            : form.profileVisibility === "limited"
              ? "Your profile is limited — contact details are hidden from others. Your email is never shown."
              : "Visible to all contributors. Your email is never shown."}
        </p>
      </div>

      <div
        style={{
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Incomplete profile CTA */}
        {isIncomplete && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "8px",
              background: "rgba(127,223,255,0.06)",
              border: "1px solid rgba(127,223,255,0.2)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <p style={{ margin: 0, fontSize: "13px", color: T.ink.dim }}>
              Complete your profile to connect with libraries and the community.
            </p>
            <Link
              href="/onboarding"
              style={{
                fontSize: "12px",
                fontFamily: T.font.mono,
                letterSpacing: "0.06em",
                color: T.accent.aurora,
                textDecoration: "none",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              Complete profile →
            </Link>
          </div>
        )}

        {/* Avatar */}
        <AvatarUpload
          currentUrl={form.avatarUrl}
          initials={initials}
          onUpload={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
        />

        {/* Name row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>First name</label>
            <input
              style={inputStyle}
              type="text"
              {...field("firstName")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input
              style={inputStyle}
              type="text"
              {...field("lastName")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
        </div>

        {/* Username */}
        <div>
          <label
            style={{
              ...labelStyle,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Username · libraries.global/@username</span>
            {usernameStatus === "checking" && (
              <span style={{ color: T.ink.faint }}>Checking…</span>
            )}
            {usernameStatus === "available" && (
              <span style={{ color: T.accent.ok }}>Available</span>
            )}
            {usernameStatus === "taken" && (
              <span style={{ color: T.accent.danger }}>Taken</span>
            )}
          </label>
          <input
            style={{
              ...inputStyle,
              borderColor:
                usernameStatus === "taken"
                  ? "rgba(255,138,138,0.4)"
                  : undefined,
            }}
            type="text"
            {...field("username")}
            className="focus:border-[rgba(127,223,255,.4)]"
            placeholder="yourhandle"
          />
        </div>

        {/* Pronouns */}
        <div>
          <label style={labelStyle}>Pronouns</label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            {...field("pronouns")}
            className="focus:border-[rgba(127,223,255,.4)]"
          >
            {PRONOUNS.map((p) => (
              <option
                key={p.value}
                value={p.value}
                style={{ background: "var(--t-bg-deep)" }}
              >
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Bio */}
        <div>
          <label
            style={{
              ...labelStyle,
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Bio</span>
            <span style={{ color: T.ink.faint }}>{form.bio.length}/400</span>
          </label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: "80px" }}
            maxLength={400}
            {...field("bio")}
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>

        {/* Affiliation + Role */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>Affiliation</label>
            <input
              style={inputStyle}
              type="text"
              {...field("affiliation")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Bibliothèque nationale de France"
            />
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <input
              style={inputStyle}
              type="text"
              {...field("jobTitle")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Senior curator"
            />
          </div>
        </div>

        {/* City + Country */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
          }}
        >
          <div>
            <label style={labelStyle}>City</label>
            <input
              style={inputStyle}
              type="text"
              {...field("city")}
              className="focus:border-[rgba(127,223,255,.4)]"
            />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <CountryCombobox
              value={form.country}
              onChange={(code) => setForm((f) => ({ ...f, country: code }))}
            />
          </div>
        </div>

        {/* Timezone */}
        <div>
          <label style={labelStyle}>Timezone</label>
          <TimezoneCombobox
            value={form.timezone}
            onChange={(tz) => setForm((f) => ({ ...f, timezone: tz }))}
          />
        </div>

        {/* Website */}
        <div>
          <label style={labelStyle}>Website</label>
          <input
            style={inputStyle}
            type="url"
            {...field("website")}
            className="focus:border-[rgba(127,223,255,.4)]"
            placeholder="https://yoursite.net"
          />
        </div>

        {/* Social links */}
        <div>
          <label style={labelStyle}>External links</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <input
              style={inputStyle}
              type="text"
              {...field("orcid")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="ORCID (https://orcid.org/0000-0000-0000-0000)"
            />
            <input
              style={inputStyle}
              type="text"
              {...field("mastodon")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="Mastodon / Bluesky handle"
            />
            <input
              style={inputStyle}
              type="url"
              {...field("linkedin")}
              className="focus:border-[rgba(127,223,255,.4)]"
              placeholder="LinkedIn URL"
            />
          </div>
        </div>

        {/* Profile visibility */}
        <div>
          <label style={labelStyle}>Profile visibility</label>
          <VisibilityCards
            value={form.profileVisibility}
            onChange={(v) => setForm((f) => ({ ...f, profileVisibility: v }))}
          />
        </div>

        {/* Interests */}
        <div>
          <label style={labelStyle}>Interests</label>
          <InterestsChips
            selected={form.interests}
            onChange={(ids) => setForm((f) => ({ ...f, interests: ids }))}
          />
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "flex-end",
            paddingTop: "8px",
            borderTop: `1px solid ${T.border.line}`,
          }}
        >
          <button
            type="button"
            onClick={handleDiscard}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: `1px solid ${T.border.line}`,
              background: "transparent",
              color: T.ink.dim,
              fontSize: "13px",
              fontFamily: T.font.sans,
              cursor: "pointer",
            }}
          >
            Discard
          </button>
          <button
            type="button"
            disabled={saving || usernameStatus === "taken"}
            onClick={() => void handleSave()}
            style={{
              padding: "9px 18px",
              borderRadius: "8px",
              border: "none",
              background: T.ink.base,
              color: T.bg.void,
              fontSize: "13px",
              fontFamily: T.font.sans,
              fontWeight: 600,
              cursor:
                saving || usernameStatus === "taken"
                  ? "not-allowed"
                  : "pointer",
              opacity: saving || usernameStatus === "taken" ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
