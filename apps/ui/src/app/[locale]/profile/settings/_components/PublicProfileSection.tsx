"use client"

import { Icon } from "@iconify/react"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AvatarUpload } from "@/components/settings/AvatarUpload"
import { CountryCombobox } from "@/components/settings/CountryCombobox"
import { InterestsChips } from "@/components/settings/InterestsChips"
import { TimezoneCombobox } from "@/components/settings/TimezoneCombobox"
import { useProfile } from "@/hooks/useProfile"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link, useRouter } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "12px",
  border: `1px solid ${T.border.line}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: "15px",
  fontFamily: T.font.sans,
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: T.font.sans,
  fontSize: "14px",
  fontWeight: 500 as const,
  color: T.ink.dim,
  display: "block",
  marginBottom: "6px",
}

const groupHeadingStyle = {
  margin: "6px 0 2px",
  fontSize: "15px",
  fontWeight: 600 as const,
  color: T.ink.base,
}

const PRONOUNS = [
  { value: "", label: "Not specified" },
  { value: "he_him", label: "He / him" },
  { value: "she_her", label: "She / her" },
  { value: "they_them", label: "They / them" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

type FormState = {
  firstName: string
  lastName: string
  username: string
  pronouns: string
  bio: string
  jobTitle: string
  city: string
  country: string
  timezone: string
  website: string
  orcid: string
  mastodon: string
  linkedin: string
  interests: string[]
  avatarUrl: string
}

/** Profile completeness — one point per meaningful field, per the design's banner. */
function completeness(form: FormState): {
  percent: number
  missing: string[]
} {
  const checks: { done: boolean; hint: string }[] = [
    { done: form.avatarUrl.length > 0, hint: "a photo" },
    { done: form.firstName.trim().length > 0, hint: "your name" },
    { done: form.username.trim().length > 0, hint: "a username" },
    { done: form.bio.trim().length > 0, hint: "a bio" },
    { done: form.jobTitle.trim().length > 0, hint: "a job title" },
    {
      done: form.city.trim().length > 0 || form.country.trim().length > 0,
      hint: "your location",
    },
    { done: form.timezone.trim().length > 0, hint: "a time zone" },
    {
      done:
        form.website.trim().length > 0 ||
        form.orcid.trim().length > 0 ||
        form.mastodon.trim().length > 0 ||
        form.linkedin.trim().length > 0,
      hint: "a link",
    },
    { done: form.interests.length > 0, hint: "interests" },
  ]
  const done = checks.filter((c) => c.done).length

  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((c) => !c.done).map((c) => c.hint),
  }
}

export function PublicProfileSection({
  profile,
  sessionUser,
}: {
  profile: UserProfile | null
  sessionUser: BetterAuthUser
}) {
  const { saving, updateProfile } = useProfile()
  const router = useRouter()

  const [form, setForm] = useState<FormState>({
    firstName: profile?.firstName ?? sessionUser.name.split(" ")[0] ?? "",
    lastName:
      profile?.lastName ?? sessionUser.name.split(" ").slice(1).join(" ") ?? "",
    username: profile?.username ?? "",
    pronouns: profile?.pronouns ?? "",
    bio: profile?.bio ?? "",
    jobTitle: profile?.jobTitle ?? "",
    city: profile?.city ?? "",
    country: profile?.country ?? "",
    timezone: profile?.timezone ?? "",
    website: profile?.website ?? "",
    orcid: profile?.orcid ?? "",
    mastodon: profile?.mastodon ?? "",
    linkedin: profile?.linkedin ?? "",
    interests: profile?.interests?.map((i) => i.documentId) ?? [],
    avatarUrl: profile?.avatar?.url ?? "",
  })

  const [checkedUsername, setCheckedUsername] = useState<string | null>(null)
  const [checkedResult, setCheckedResult] = useState<
    "available" | "taken" | null
  >(null)

  const field = useCallback(
    (key: keyof FormState) => ({
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

  const { percent, missing } = completeness(form)
  const claimed = profile?.claimedLibraries?.find((l) => l.name)

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
      jobTitle: form.jobTitle,
      city: form.city,
      country: form.country,
      timezone: form.timezone,
      website: form.website,
      orcid: form.orcid,
      mastodon: form.mastodon,
      linkedin: form.linkedin,
      interests: form.interests,
    }
    const ok = await updateProfile(payload)
    if (ok && usernameChanged) {
      router.push(`/profile/${newUsername}`)
    }
  }

  return (
    <div>
      <h2
        className="m-0"
        style={{
          fontFamily: T.font.serif,
          fontSize: "24px",
          fontWeight: 500,
          color: T.ink.base,
        }}
      >
        Your profile
      </h2>
      <p className="mt-1 mb-5 text-[15px]" style={{ color: T.ink.dim }}>
        Shown on your public profile. Your email is never shown.
      </p>

      {/* Completeness banner */}
      {percent < 100 ? (
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-[14px] px-4 py-3"
          style={{ background: T.accent.chip }}
        >
          <p className="m-0 text-[14px]" style={{ color: T.ink.base }}>
            <strong style={{ color: T.accent.primaryHover }}>
              Your profile is {percent}% complete.
            </strong>{" "}
            {missing.length > 0
              ? `Adding ${missing.slice(0, 2).join(" and ")} helps libraries recognise you.`
              : ""}
          </p>
          <span
            aria-hidden="true"
            className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full"
            style={{ background: "rgba(67,56,202,.18)" }}
          >
            <span
              className="block h-full rounded-full"
              style={{ width: `${percent}%`, background: T.accent.primary }}
            />
          </span>
        </div>
      ) : null}

      <div className="flex flex-col gap-5">
        {/* Avatar */}
        <AvatarUpload
          currentUrl={form.avatarUrl}
          initials={initials}
          onUpload={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
        />

        {/* Name + username */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label style={labelStyle}>First name</label>
            <input style={inputStyle} type="text" {...field("firstName")} />
          </div>
          <div>
            <label style={labelStyle}>Last name</label>
            <input style={inputStyle} type="text" {...field("lastName")} />
          </div>
          <div>
            <label
              style={{
                ...labelStyle,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Username</span>
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
            <div
              className="flex items-center overflow-hidden rounded-[12px] border"
              style={{
                borderColor:
                  usernameStatus === "taken"
                    ? "var(--t-danger-edge)"
                    : T.border.line,
                background: T.bg.deep,
              }}
            >
              <span
                aria-hidden="true"
                className="border-r py-[10px] pr-2.5 pl-3.5 text-[15px]"
                style={{ color: T.ink.low, borderColor: T.border.divider }}
              >
                @
              </span>
              <input
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-[10px] text-[15px] outline-none"
                style={{ color: T.ink.base, fontFamily: T.font.sans }}
                type="text"
                aria-label="Username"
                placeholder="yourhandle"
                value={form.username}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    username: e.target.value
                      .toLowerCase()
                      .replaceAll(/[^a-z0-9_]/g, ""),
                  }))
                }
              />
            </div>
          </div>
        </div>

        {/* Pronouns */}
        <div className="max-w-[280px]">
          <label style={labelStyle}>
            Pronouns{" "}
            <span style={{ color: T.ink.faint, fontWeight: 400 }}>
              · Optional
            </span>
          </label>
          <select
            style={{ ...inputStyle, cursor: "pointer" }}
            {...field("pronouns")}
          >
            {PRONOUNS.map((p) => (
              <option key={p.value} value={p.value}>
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
            <span style={{ color: T.ink.faint }}>{form.bio.length} / 400</span>
          </label>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: "84px" }}
            maxLength={400}
            {...field("bio")}
          />
        </div>

        {/* Library affiliation */}
        <div>
          <p style={groupHeadingStyle}>Library affiliation</p>
          <p className="m-0 mb-3 text-[14px]" style={{ color: T.ink.dim }}>
            A verified affiliation lets you steward your library&rsquo;s record.
            It&rsquo;s confirmed by the review team, not by points or level.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label style={labelStyle}>Library</label>
              {claimed ? (
                <input
                  style={{
                    ...inputStyle,
                    background: T.bg.surface,
                    color: T.ink.base,
                  }}
                  type="text"
                  value={claimed.name ?? ""}
                  readOnly
                  aria-describedby="affiliation-status"
                />
              ) : (
                <div
                  className="flex items-center justify-between gap-3 rounded-[12px] border border-dashed px-3.5 py-[10px]"
                  style={{ borderColor: T.border.hi }}
                >
                  <span className="text-[15px]" style={{ color: T.ink.low }}>
                    No library linked yet
                  </span>
                  <Link
                    href="/contribute/claim"
                    className="shrink-0 text-[14px] font-semibold underline underline-offset-[3px]"
                    style={{ color: T.accent.primary }}
                  >
                    Claim your library
                  </Link>
                </div>
              )}
            </div>
            <div>
              <label style={labelStyle}>
                Job title{" "}
                <span style={{ color: T.ink.faint, fontWeight: 400 }}>
                  · Optional
                </span>
              </label>
              <input
                style={inputStyle}
                type="text"
                {...field("jobTitle")}
                placeholder="e.g. Senior curator"
              />
            </div>
          </div>
          {claimed ? (
            <p
              id="affiliation-status"
              className="m-0 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px]"
            >
              {profile?.isVerifiedLibrarian ? (
                <span
                  className="inline-flex items-center gap-1.5 font-semibold"
                  style={{ color: "var(--tint-public-fg)" }}
                >
                  <Icon
                    icon="mdi:check-decagram-outline"
                    width={16}
                    height={16}
                    aria-hidden="true"
                  />
                  Verified affiliation
                </span>
              ) : (
                <span style={{ color: T.ink.dim }}>
                  Awaiting review-team confirmation
                </span>
              )}
              <Link
                href="/contribute/claim"
                className="underline underline-offset-[3px]"
                style={{ color: T.accent.primary }}
              >
                Change library
              </Link>
            </p>
          ) : null}
        </div>

        {/* Location */}
        <div>
          <p style={groupHeadingStyle}>Location</p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label style={labelStyle}>City</label>
              <input style={inputStyle} type="text" {...field("city")} />
            </div>
            <div>
              <label style={labelStyle}>Country</label>
              <CountryCombobox
                value={form.country}
                onChange={(code) => setForm((f) => ({ ...f, country: code }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Time zone</label>
              <TimezoneCombobox
                value={form.timezone}
                onChange={(tz) => setForm((f) => ({ ...f, timezone: tz }))}
              />
            </div>
          </div>
        </div>

        {/* Links */}
        <div>
          <p style={groupHeadingStyle}>
            Links{" "}
            <span style={{ color: T.ink.faint, fontWeight: 400 }}>
              · Optional
            </span>
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label style={labelStyle}>Website</label>
              <input
                style={inputStyle}
                type="url"
                {...field("website")}
                placeholder="https://"
              />
            </div>
            <div>
              <label style={labelStyle}>ORCID iD</label>
              <input
                style={inputStyle}
                type="text"
                {...field("orcid")}
                placeholder="0000-0000-0000-0000"
              />
            </div>
            <div>
              <label style={labelStyle}>Mastodon or Bluesky</label>
              <input
                style={inputStyle}
                type="text"
                {...field("mastodon")}
                placeholder="@you@instance"
              />
            </div>
          </div>
          <div className="mt-3 sm:max-w-[calc((100%-24px)/3)]">
            <label style={labelStyle}>LinkedIn</label>
            <input
              style={inputStyle}
              type="url"
              {...field("linkedin")}
              placeholder="https://linkedin.com/in/"
            />
          </div>
        </div>

        {/* Interests */}
        <div>
          <p style={groupHeadingStyle}>Interests</p>
          <p className="m-0 mb-3 text-[14px]" style={{ color: T.ink.dim }}>
            Used to suggest libraries and articles.{" "}
            {form.interests.length > 0
              ? `${form.interests.length} selected.`
              : ""}
          </p>
          <InterestsChips
            selected={form.interests}
            onChange={(ids) => setForm((f) => ({ ...f, interests: ids }))}
          />
        </div>

        {/* Actions */}
        <div
          className="flex justify-end gap-2.5 border-t pt-4"
          style={{ borderColor: T.border.divider }}
        >
          <button
            type="button"
            disabled={saving || usernameStatus === "taken"}
            onClick={() => void handleSave()}
            className="rounded-full border-0 px-6 py-2.5 text-[14px] font-semibold text-white transition-colors"
            style={{
              background: T.accent.primary,
              fontFamily: T.font.sans,
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
