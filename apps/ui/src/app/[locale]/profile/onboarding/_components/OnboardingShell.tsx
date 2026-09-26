"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { AvatarUpload } from "@/components/settings/AvatarUpload"
import { CountryCombobox } from "@/components/settings/CountryCombobox"
import { InterestsChips } from "@/components/settings/InterestsChips"
import { TimezoneCombobox } from "@/components/settings/TimezoneCombobox"
import { VisibilityCards } from "@/components/settings/VisibilityCards"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

import { LibraryClaimSearch } from "./LibraryClaimSearch"

// ── Types ─────────────────────────────────────────────────────────────────────

type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
}

type LanguageEntry = {
  code: string
  proficiency: "native" | "fluent" | "conversational"
}

// ── Style helpers ─────────────────────────────────────────────────────────────

const input: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "12px",
  border: `1px solid ${T.border.line}`,
  background: T.bg.deep,
  color: T.ink.base,
  fontSize: "15px",
  fontFamily: T.font.sans,
  boxSizing: "border-box",
}

const label: React.CSSProperties = {
  fontFamily: T.font.sans,
  fontSize: "14px",
  fontWeight: 500,
  color: T.ink.dim,
  display: "block",
  marginBottom: "6px",
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PRONOUNS = [
  { value: "", label: "Not specified" },
  { value: "he_him", label: "He / Him" },
  { value: "she_her", label: "She / Her" },
  { value: "they_them", label: "They / Them" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
]

const AFFILIATION_TYPES = [
  {
    value: "reader",
    label: "Reader / enthusiast",
    desc: "I use libraries for personal learning.",
    icon: "mdi:book-open-page-variant-outline",
    showClaim: false,
  },
  {
    value: "researcher",
    label: "Researcher / academic",
    desc: "I use libraries as a primary research tool.",
    icon: "mdi:magnify",
    showClaim: true,
  },
  {
    value: "librarian",
    label: "Librarian / archivist",
    desc: "I work in a library, archive, or special collection.",
    icon: "mdi:bookshelf",
    showClaim: true,
  },
  {
    value: "other",
    label: "Something else",
    desc: "Author, publisher, journalist, student.",
    icon: "mdi:dots-horizontal",
    showClaim: false,
  },
]

const LANGUAGE_OPTIONS = [
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

const PROFICIENCY = ["native", "fluent", "conversational"] as const

// ── Section header component ──────────────────────────────────────────────────

function SectionHeading({
  icon,
  title,
  subtitle,
  required,
  optional,
}: {
  icon: string
  title: string
  subtitle?: string
  required?: boolean
  optional?: boolean
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            aria-hidden="true"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: T.accent.chip,
              color: T.accent.primary,
              flexShrink: 0,
            }}
          >
            <Icon icon={icon} width={16} height={16} />
          </span>
          <h2
            style={{
              fontFamily: T.font.serif,
              fontSize: "22px",
              fontWeight: 500,
              color: T.ink.base,
              margin: 0,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h2>
        </div>
        {required && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: "999px",
              background: T.accent.chip,
              color: T.accent.primaryHover,
            }}
          >
            Required
          </span>
        )}
        {optional && (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: "999px",
              background: T.bg.muted,
              color: T.ink.dim,
            }}
          >
            Optional · Public
          </span>
        )}
      </div>
      {subtitle && (
        <p
          style={{
            margin: "8px 0 0 42px",
            fontSize: "15px",
            color: T.ink.dim,
            lineHeight: 1.55,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  )
}

// ── Main shell ────────────────────────────────────────────────────────────────

export function OnboardingShell({
  sessionUser,
  initialProfile,
}: {
  sessionUser: SessionUser
  initialProfile: UserProfile | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // ── Identity state ───────────────────────────────────────────────
  const [firstName, setFirstName] = useState(
    initialProfile?.firstName ?? sessionUser.name?.split(" ")[0] ?? ""
  )
  const [lastName, setLastName] = useState(
    initialProfile?.lastName ??
      sessionUser.name?.split(" ").slice(1).join(" ") ??
      ""
  )
  const [username, setUsername] = useState(initialProfile?.username ?? "")
  const [pronouns, setPronouns] = useState(initialProfile?.pronouns ?? "")
  const [bio, setBio] = useState(initialProfile?.bio ?? "")
  const [city, setCity] = useState(initialProfile?.city ?? "")
  const [country, setCountry] = useState(initialProfile?.country ?? "")
  const [timezone, setTimezone] = useState(initialProfile?.timezone ?? "")
  const [avatarUrl, setAvatarUrl] = useState(initialProfile?.avatar?.url ?? "")

  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle")

  useEffect(() => {
    const u = username.trim()
    const t = setTimeout(async () => {
      if (!u || u === initialProfile?.username) {
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
  }, [username, initialProfile?.username])

  // ── Affiliation state ────────────────────────────────────────────
  const [affiliationType, setAffiliationType] = useState<string>(
    initialProfile?.affiliationType ?? ""
  )
  const [claimResult, setClaimResult] = useState<{
    libraryName: string
    entityRef: string
    status: string
  } | null>(null)

  const selectedAff = AFFILIATION_TYPES.find((a) => a.value === affiliationType)

  // ── Interests & languages state ──────────────────────────────────
  const [interests, setInterests] = useState<string[]>(
    initialProfile?.interests?.map((i) => i.documentId) ?? []
  )
  const [languages, setLanguages] = useState<LanguageEntry[]>(
    (initialProfile?.languages as LanguageEntry[] | undefined) ?? []
  )
  const [addingLang, setAddingLang] = useState("")
  const [addingProf, setAddingProf] = useState<
    "native" | "fluent" | "conversational"
  >("fluent")

  const addLanguage = () => {
    if (!addingLang || languages.some((l) => l.code === addingLang)) return
    setLanguages((prev) => [
      ...prev,
      { code: addingLang, proficiency: addingProf },
    ])
    setAddingLang("")
  }

  // ── External links state ─────────────────────────────────────────
  const [website, setWebsite] = useState(initialProfile?.website ?? "")
  const [orcid, setOrcid] = useState(initialProfile?.orcid ?? "")
  const [mastodon, setMastodon] = useState(initialProfile?.mastodon ?? "")
  const [linkedin, setLinkedin] = useState(initialProfile?.linkedin ?? "")

  // ── Visibility state ─────────────────────────────────────────────
  const [visibility, setVisibility] = useState<
    "public" | "limited" | "private"
  >(initialProfile?.profileVisibility ?? "public")

  // ── Save logic ───────────────────────────────────────────────────

  const initials =
    ((firstName[0] ?? "") + (lastName[0] ?? "")).toUpperCase() || "?"

  const handleSave = async (then: "profile" | "home") => {
    if (usernameStatus === "taken") {
      toast.error("Username is taken")

      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          username,
          pronouns: pronouns || null,
          bio,
          city,
          country,
          timezone,
          avatarUrl,
          affiliationType:
            (affiliationType as UserProfile["affiliationType"]) || null,
          interests,
          languages,
          website,
          orcid,
          mastodon,
          linkedin,
          profileVisibility: visibility,
        }),
      })
      if (!res.ok) {
        toast.error("Failed to save — please try again")

        return
      }
      router.push(
        then === "profile"
          ? username
            ? `/profile/${username}`
            : "/profile"
          : "/"
      )
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <>
      {/* Body: two-column layout */}
      <div style={{ flex: 1, display: "flex" }}>
        {/* ── Left sidebar (sticky) ── */}
        <div
          className="hidden lg:flex"
          style={{
            width: "340px",
            flexShrink: 0,
            position: "sticky",
            top: "56px",
            height: "calc(100vh - 56px)",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "48px 40px",
            borderRight: `1px solid ${T.border.line}`,
            background: T.bg.void,
            overflow: "hidden",
          }}
        >
          {/* Glow decoration */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse 70% 55% at 60% 35%, rgba(67,56,202,0.05), transparent 60%), radial-gradient(ellipse 50% 70% at 50% 50%, rgba(242,200,121,0.06), transparent 55%)",
              pointerEvents: "none",
            }}
          />
          {/* Globe ring hints */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: "-140px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "480px",
              height: "480px",
              borderRadius: "50%",
              border: "1px solid rgba(67,56,202,0.10)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              right: "-80px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "340px",
              height: "340px",
              borderRadius: "50%",
              border: "1px solid rgba(67,56,202,0.06)",
              pointerEvents: "none",
            }}
          />

          {/* Top eyebrow */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontFamily: T.font.sans,
              fontSize: "14px",
              fontWeight: 600,
              color: T.ink.dim,
            }}
          >
            <span
              style={{
                width: "22px",
                height: "2px",
                borderRadius: "2px",
                background: T.accent.primary,
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            Before you continue
          </div>

          {/* Main content */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "24px",
            }}
          >
            <div>
              <h1
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(2rem, 3.5vw, 3rem)",
                  fontWeight: 500,
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  color: T.ink.base,
                  margin: "0 0 18px",
                }}
              >
                One last thing —{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: T.accent.primary,
                  }}
                >
                  introduce yourself.
                </em>
              </h1>
              <p
                style={{
                  fontSize: "15px",
                  lineHeight: "1.65",
                  color: T.ink.dim,
                  maxWidth: "38ch",
                }}
              >
                We hold a public profile for every contributor on the atlas.
                It&apos;s how readers, editors, and reviewers know who&apos;s
                behind a record.
              </p>
              <p
                style={{
                  marginTop: "12px",
                  fontSize: "15px",
                  lineHeight: "1.65",
                  color: T.ink.dim,
                  maxWidth: "38ch",
                }}
              >
                You can keep it spare or fill it out fully — but a name and
                pronouns are the floor. Take a minute; you only do this once.
              </p>
            </div>

            {/* Pull-quote */}
            <div
              style={{
                borderLeft: `2px solid ${T.accent.primary}`,
                paddingLeft: "16px",
                maxWidth: "34ch",
              }}
            >
              <p
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "15px",
                  fontStyle: "italic",
                  color: T.ink.dim,
                  lineHeight: "1.6",
                  margin: "0 0 8px",
                }}
              >
                &ldquo;A name on an entry is a small act of trust between a
                librarian and a reader.&rdquo;
              </p>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: T.ink.low,
                  margin: 0,
                }}
              >
                Editorial covenant
              </p>
            </div>
          </div>

          {/* Progress segments */}
          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <span
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                fontWeight: 600,
                color: T.ink.dim,
              }}
            >
              Profile setup
            </span>
            <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
              {[
                "Identity",
                "Affiliation",
                "Interests",
                "Links",
                "Visibility",
              ].map((s, i) => (
                <div
                  key={s}
                  title={s}
                  style={{
                    flex: 1,
                    height: "3px",
                    borderRadius: "2px",
                    background:
                      i === 0
                        ? T.accent.primary
                        : i < 4
                          ? "var(--t-aurora-edge)"
                          : T.border.line,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: scrollable form ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div
            style={{
              flex: 1,
              maxWidth: "1080px",
              margin: "0 auto",
              width: "100%",
              padding: "48px 56px 48px",
            }}
          >
            {/* Page heading */}
            <div style={{ marginBottom: "40px" }}>
              <h2
                style={{
                  fontFamily: T.font.serif,
                  fontSize: "clamp(1.8rem, 3vw, 2.4rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.02em",
                  color: T.ink.base,
                  margin: "0 0 6px",
                }}
              >
                Your{" "}
                <em
                  style={{
                    fontStyle: "italic",
                    fontWeight: 400,
                    color: T.accent.primary,
                  }}
                >
                  public
                </em>{" "}
                profile.
              </h2>
              <p
                style={{
                  fontSize: "15px",
                  color: T.ink.dim,
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                Visible on every record you contribute to and on your profile
                page. Required fields marked with *; everything else is yours to
                shape.
              </p>
            </div>

            {/* ───────────── § Identity ───────────── */}
            <section
              id="section-identity"
              style={{
                marginBottom: "40px",
                padding: "28px",
                borderRadius: "20px",
                border: `1px solid ${T.border.line}`,
                background: T.bg.deep,
              }}
            >
              <SectionHeading
                icon="mdi:account-circle-outline"
                title="Identity"
                required
              />

              <AvatarUpload
                currentUrl={avatarUrl}
                initials={initials}
                onUpload={setAvatarUrl}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginTop: "20px",
                }}
              >
                <div>
                  <label style={label}>Display name *</label>
                  <input
                    style={input}
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Amélie"
                  />
                </div>
                <div>
                  <label style={label}>Last name</label>
                  <input
                    style={input}
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Rault"
                  />
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label
                  style={{
                    ...label,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>
                    Username *{" "}
                    <span style={{ color: T.ink.faint }}>
                      → libraries.global/@handle
                    </span>
                  </span>
                  {usernameStatus === "checking" && (
                    <span style={{ color: T.ink.faint }}>Checking…</span>
                  )}
                  {usernameStatus === "available" && (
                    <span style={{ color: T.accent.ok }}>Available ✓</span>
                  )}
                  {usernameStatus === "taken" && (
                    <span style={{ color: T.accent.danger }}>Taken</span>
                  )}
                </label>
                <input
                  style={{
                    ...input,
                    borderColor:
                      usernameStatus === "taken"
                        ? "var(--t-danger-edge)"
                        : undefined,
                  }}
                  type="text"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value.toLowerCase().replaceAll(/[^a-z0-9_]/g, "")
                    )
                  }
                  placeholder="amelie.rault"
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                <div>
                  <label style={label}>Pronouns *</label>
                  <select
                    style={{ ...input, cursor: "pointer" }}
                    value={pronouns ?? ""}
                    onChange={(e) => setPronouns(e.target.value)}
                  >
                    {PRONOUNS.map((p) => (
                      <option
                        key={p.value}
                        value={p.value}
                        style={{ background: T.bg.deep }}
                      >
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={label}>City · optional</label>
                  <input
                    style={input}
                    type="text"
                    value={city ?? ""}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginTop: "12px",
                }}
              >
                <div>
                  <label style={label}>Country · optional</label>
                  <CountryCombobox value={country} onChange={setCountry} />
                </div>
                <div>
                  <label style={label}>Timezone · optional</label>
                  <TimezoneCombobox value={timezone} onChange={setTimezone} />
                </div>
              </div>

              <div style={{ marginTop: "12px" }}>
                <label
                  style={{
                    ...label,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Short bio · optional</span>
                  <span style={{ color: T.ink.faint }}>{bio.length} / 320</span>
                </label>
                <textarea
                  style={{
                    ...input,
                    resize: "vertical",
                    minHeight: "80px",
                    fontFamily: T.font.sans,
                    lineHeight: "1.5",
                  }}
                  value={bio}
                  maxLength={320}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Shown at the top of your profile. Plain text, no markdown."
                />
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "13px",
                    color: T.ink.low,
                  }}
                >
                  Shown at the top of your profile. Plain text; no markdown.
                </p>
              </div>
            </section>

            {/* ───────────── § Affiliation ───────────── */}
            <section
              id="section-affiliation"
              style={{
                marginBottom: "40px",
                padding: "28px",
                borderRadius: "20px",
                border: `1px solid ${T.border.line}`,
                background: T.bg.deep,
              }}
            >
              <SectionHeading
                icon="mdi:domain"
                title="Affiliation"
                required
                subtitle="How are you connected to libraries? This shapes which review queues you fast-track and what badges you can earn."
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                {AFFILIATION_TYPES.map((type) => {
                  const active = affiliationType === type.value

                  return (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => setAffiliationType(type.value)}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "10px",
                        border: `1px solid ${active ? "var(--t-aurora-edge)" : T.border.line}`,
                        background: active ? T.accent.chip : T.bg.surface,
                        cursor: "pointer",
                        textAlign: "left",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        transition: "border-color 150ms, background 150ms",
                      }}
                    >
                      <Icon
                        icon={type.icon}
                        width={16}
                        height={16}
                        style={{
                          color: active ? T.accent.primary : T.ink.low,
                          marginTop: "2px",
                          flexShrink: 0,
                        }}
                      />
                      <div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: "15px",
                            fontWeight: 600,
                            color: T.ink.base,
                          }}
                        >
                          {type.label}
                        </p>
                        <p
                          style={{
                            margin: "2px 0 0",
                            fontSize: "13px",
                            color: T.ink.dim,
                          }}
                        >
                          {type.desc}
                        </p>
                      </div>
                      <div style={{ marginLeft: "auto", flexShrink: 0 }}>
                        <div
                          style={{
                            width: "14px",
                            height: "14px",
                            borderRadius: "50%",
                            border: `1px solid ${active ? T.accent.primary : T.border.hi}`,
                            background: active
                              ? T.accent.primary
                              : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {active && (
                            <Icon
                              icon="mdi:check"
                              width={9}
                              height={9}
                              style={{ color: "#fff" }}
                            />
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Library claim */}
              {selectedAff?.showClaim && !claimResult && (
                <div
                  style={{
                    marginTop: "20px",
                    padding: "20px",
                    borderRadius: "10px",
                    border: `1px solid ${T.border.line}`,
                    background: T.bg.surface,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginBottom: "6px",
                    }}
                  >
                    <Icon
                      icon="mdi:check-decagram-outline"
                      width={15}
                      height={15}
                      style={{ color: T.accent.primary }}
                    />
                    <p
                      style={{
                        margin: 0,
                        fontSize: "15px",
                        fontWeight: 600,
                        color: T.ink.base,
                      }}
                    >
                      Are you affiliated with a library on the atlas?
                    </p>
                  </div>
                  <p
                    style={{
                      margin: "0 0 16px 25px",
                      fontSize: "14px",
                      color: T.ink.dim,
                      lineHeight: 1.55,
                    }}
                  >
                    Search libraries by name, city, or entity ref. Verified
                    affiliations get a green tick on every contribution record
                    and unlock the Verified Librarian badge.
                  </p>
                  <LibraryClaimSearch
                    onClaimed={(result) => setClaimResult(result)}
                  />
                </div>
              )}

              {claimResult && (
                <div
                  style={{
                    marginTop: "16px",
                    padding: "14px 18px",
                    borderRadius: "10px",
                    border: `1px solid ${claimResult.status === "verified" ? "var(--tint-public-bg)" : "#EADFC4"}`,
                    background:
                      claimResult.status === "verified"
                        ? "var(--tint-public-bg)"
                        : "#F5EEDC",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  <Icon
                    icon={
                      claimResult.status === "verified"
                        ? "mdi:check-circle-outline"
                        : "mdi:clock-outline"
                    }
                    width={16}
                    height={16}
                    style={{
                      color:
                        claimResult.status === "verified"
                          ? T.accent.ok
                          : T.accent.warn,
                      flexShrink: 0,
                    }}
                  />
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      fontWeight: 600,
                      color:
                        claimResult.status === "verified"
                          ? "var(--tint-public-fg)"
                          : T.accent.warn,
                    }}
                  >
                    {claimResult.status === "verified"
                      ? `Verified at ${claimResult.libraryName}`
                      : `Claim pending for ${claimResult.libraryName}`}
                  </p>
                </div>
              )}
            </section>

            {/* ───────────── § Interests & languages ───────────── */}
            <section
              id="section-interests"
              style={{
                marginBottom: "40px",
                padding: "28px",
                borderRadius: "20px",
                border: `1px solid ${T.border.line}`,
                background: T.bg.deep,
              }}
            >
              <SectionHeading
                icon="mdi:tag-heart-outline"
                title="Interests & languages"
                subtitle="We use these to suggest contribution paths and route translation requests in your direction."
              />

              <p
                style={{
                  margin: "0 0 10px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: T.ink.dim,
                }}
              >
                Topics you care about
              </p>
              <InterestsChips selected={interests} onChange={setInterests} />

              <p
                style={{
                  margin: "20px 0 10px",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: T.ink.dim,
                }}
              >
                Languages you can review in
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginBottom: "12px",
                }}
              >
                {languages.map((lang) => {
                  const name =
                    LANGUAGE_OPTIONS.find((l) => l.code === lang.code)?.name ??
                    lang.code

                  return (
                    <span
                      key={lang.code}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "4px 10px",
                        borderRadius: "999px",
                        border: "1px solid transparent",
                        background: T.accent.chip,
                        color: T.accent.primaryHover,
                        fontSize: "14px",
                        fontWeight: 600,
                        fontFamily: T.font.sans,
                      }}
                    >
                      {name} · {lang.proficiency}
                      <button
                        type="button"
                        onClick={() =>
                          setLanguages((prev) =>
                            prev.filter((l) => l.code !== lang.code)
                          )
                        }
                        style={{
                          background: "none",
                          border: "none",
                          color: T.ink.faint,
                          cursor: "pointer",
                          padding: 0,
                          fontSize: "14px",
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>

              <div
                style={{ display: "flex", gap: "10px", alignItems: "center" }}
              >
                <select
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.surface,
                    color: T.ink.base,
                    fontSize: "13px",
                    fontFamily: T.font.sans,
                    outline: "none",
                  }}
                  value={addingLang}
                  onChange={(e) => setAddingLang(e.target.value)}
                >
                  <option value="" style={{ background: T.bg.deep }}>
                    + Add a language
                  </option>
                  {LANGUAGE_OPTIONS.filter(
                    (l) => !languages.some((ll) => ll.code === l.code)
                  ).map((l) => (
                    <option
                      key={l.code}
                      value={l.code}
                      style={{ background: T.bg.deep }}
                    >
                      {l.name}
                    </option>
                  ))}
                </select>
                <select
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.surface,
                    color: T.ink.base,
                    fontSize: "13px",
                    fontFamily: T.font.sans,
                    outline: "none",
                  }}
                  value={addingProf}
                  onChange={(e) =>
                    setAddingProf(e.target.value as typeof addingProf)
                  }
                >
                  {PROFICIENCY.map((p) => (
                    <option key={p} value={p} style={{ background: T.bg.deep }}>
                      {p}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addLanguage}
                  disabled={!addingLang}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "6px",
                    border: `1px solid ${T.border.hi}`,
                    background: T.bg.deep,
                    color: T.ink.dim,
                    fontSize: "14px",
                    cursor: addingLang ? "pointer" : "not-allowed",
                    opacity: addingLang ? 1 : 0.5,
                  }}
                >
                  Add
                </button>
              </div>
            </section>

            {/* ───────────── § External links ───────────── */}
            <section
              id="section-links"
              style={{
                marginBottom: "40px",
                padding: "28px",
                borderRadius: "20px",
                border: `1px solid ${T.border.line}`,
                background: T.bg.deep,
              }}
            >
              <SectionHeading
                icon="mdi:link-variant"
                title="External links"
                optional
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <div>
                  <label style={label}>Website</label>
                  <input
                    style={input}
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    placeholder="https://"
                  />
                </div>
                <div>
                  <label style={label}>ORCID</label>
                  <input
                    style={input}
                    type="text"
                    value={orcid}
                    onChange={(e) => setOrcid(e.target.value)}
                    placeholder="0000-0000-0000-0000"
                  />
                </div>
                <div>
                  <label style={label}>Mastodon / Bluesky</label>
                  <input
                    style={input}
                    type="text"
                    value={mastodon}
                    onChange={(e) => setMastodon(e.target.value)}
                    placeholder="@you@mastodon.social"
                  />
                </div>
                <div>
                  <label style={label}>LinkedIn</label>
                  <input
                    style={input}
                    type="url"
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                    placeholder="linkedin.com/in/"
                  />
                </div>
              </div>
            </section>

            {/* ───────────── § Profile visibility ───────────── */}
            <section
              id="section-visibility"
              style={{
                marginBottom: "40px",
                padding: "28px",
                borderRadius: "20px",
                border: `1px solid ${T.border.line}`,
                background: T.bg.deep,
              }}
            >
              <SectionHeading
                icon="mdi:eye-outline"
                title="Profile visibility"
                subtitle="You can change this any time from settings. Affiliation badge shows up regardless once verified."
              />

              <VisibilityCards value={visibility} onChange={setVisibility} />
            </section>

            {/* Fine print */}
            <p
              style={{
                fontSize: "13px",
                color: T.ink.low,
                lineHeight: 1.6,
                marginBottom: "10px",
              }}
            >
              By continuing, you agree to the{" "}
              <Link
                href="/legal/contributor-covenant"
                style={{ color: T.ink.faint, textDecoration: "underline" }}
              >
                Contributor Covenant
              </Link>{" "}
              and acknowledge that your profile data will be processed as
              described in the{" "}
              <Link
                href="/legal/privacy"
                style={{ color: T.ink.faint, textDecoration: "underline" }}
              >
                Privacy Policy
              </Link>
              . You can edit or delete your profile at any time from{" "}
              <Link
                href="/profile/settings"
                style={{ color: T.ink.faint, textDecoration: "underline" }}
              >
                Settings
              </Link>
              .
            </p>
          </div>

          {/* ── Sticky footer bar ── */}
          <div
            style={{
              position: "sticky",
              bottom: 0,
              zIndex: 40,
              background: "var(--t-header-bg)",
              backdropFilter: "blur(16px)",
              borderTop: "1px solid var(--t-border-line)",
              padding: "14px 56px",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              type="button"
              onClick={() => void handleSave("home")}
              style={{
                padding: "9px 20px",
                borderRadius: "999px",
                border: `1px solid ${T.border.hi}`,
                background: T.bg.deep,
                color: T.ink.base,
                fontSize: "14px",
                fontFamily: T.font.sans,
                cursor: "pointer",
              }}
            >
              Save &amp; finish later
            </button>
            <button
              type="button"
              disabled={saving || usernameStatus === "taken"}
              onClick={() => void handleSave("profile")}
              style={{
                padding: "10px 24px",
                borderRadius: "999px",
                border: "none",
                background: T.accent.primary,
                color: "#fff",
                fontSize: "14px",
                fontFamily: T.font.sans,
                fontWeight: 600,
                cursor:
                  saving || usernameStatus === "taken"
                    ? "not-allowed"
                    : "pointer",
                opacity: saving || usernameStatus === "taken" ? 0.6 : 1,
                display: "flex",
                alignItems: "center",
                gap: "7px",
              }}
            >
              {saving ? (
                "Saving…"
              ) : (
                <>
                  Enter your profile
                  <Icon icon="mdi:arrow-right" width={14} height={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
