"use client"

import { useEffect, useState } from "react"

import { AvatarUpload } from "@/components/settings/AvatarUpload"
import { CountryCombobox } from "@/components/settings/CountryCombobox"
import { T } from "@/lib/design-tokens"
import type { UserProfile } from "@/lib/types/profile"

type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
}

const inputStyle = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: "10px",
  border: `1px solid ${T.border.hi}`,
  background: T.bg.surface,
  color: T.ink.base,
  fontSize: "13px",
  fontFamily: "Roboto, sans-serif",
  outline: "none",
  boxSizing: "border-box" as const,
}

const labelStyle = {
  fontFamily: "JetBrains Mono, monospace",
  fontSize: "10px",
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

export function OnboardingIdentity({
  sessionUser,
  initialProfile,
  saving,
  onNext,
  onSkip,
}: {
  sessionUser: SessionUser
  initialProfile: UserProfile | null
  saving: boolean
  onNext: (data: Partial<UserProfile>) => void
  onSkip: () => void
}) {
  const [form, setForm] = useState({
    firstName:
      initialProfile?.firstName ?? sessionUser.name?.split(" ")[0] ?? "",
    lastName:
      initialProfile?.lastName ??
      sessionUser.name?.split(" ").slice(1).join(" ") ??
      "",
    username: initialProfile?.username ?? "",
    pronouns: initialProfile?.pronouns ?? "",
    city: initialProfile?.city ?? "",
    country: initialProfile?.country ?? "",
    avatarUrl: initialProfile?.avatar?.url ?? "",
  })
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle")

  useEffect(() => {
    const username = form.username.trim()
    const t = setTimeout(async () => {
      if (!username || username === initialProfile?.username) {
        setUsernameStatus("idle")

        return
      }
      setUsernameStatus("checking")
      const res = await fetch(
        `/api/profile/check-username?username=${encodeURIComponent(username)}`
      )
      const json = (await res.json()) as { available: boolean }
      setUsernameStatus(json.available ? "available" : "taken")
    }, 400)

    return () => clearTimeout(t)
  }, [form.username, initialProfile?.username])

  const initials =
    ((form.firstName[0] ?? "") + (form.lastName[0] ?? "")).toUpperCase() || "?"

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1
          style={{
            margin: "0 0 8px",
            fontSize: "28px",
            fontWeight: 700,
            fontFamily: "Fraunces, serif",
            color: T.ink.base,
          }}
        >
          Let&apos;s set up your identity
        </h1>
        <p style={{ margin: 0, fontSize: "14px", color: T.ink.faint }}>
          How you appear to other contributors. You can change this any time in
          settings.
        </p>
      </div>

      <AvatarUpload
        currentUrl={form.avatarUrl}
        initials={initials}
        onUpload={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
      />

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div>
          <label style={labelStyle}>First name</label>
          <input
            style={inputStyle}
            type="text"
            value={form.firstName}
            onChange={(e) =>
              setForm((f) => ({ ...f, firstName: e.target.value }))
            }
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>
        <div>
          <label style={labelStyle}>Last name</label>
          <input
            style={inputStyle}
            type="text"
            value={form.lastName}
            onChange={(e) =>
              setForm((f) => ({ ...f, lastName: e.target.value }))
            }
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>
      </div>

      <div>
        <label
          style={{
            ...labelStyle,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>Username · @handle</span>
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
              usernameStatus === "taken" ? "rgba(255,138,138,0.4)" : undefined,
          }}
          type="text"
          value={form.username}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              username: e.target.value
                .toLowerCase()
                .replaceAll(/[^a-z0-9_]/g, ""),
            }))
          }
          placeholder="yourhandle"
          className="focus:border-[rgba(127,223,255,.4)]"
        />
      </div>

      <div>
        <label style={labelStyle}>Pronouns</label>
        <select
          style={{ ...inputStyle, cursor: "pointer" }}
          value={form.pronouns ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, pronouns: e.target.value }))}
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

      <div
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}
      >
        <div>
          <label style={labelStyle}>City</label>
          <input
            style={inputStyle}
            type="text"
            value={form.city ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            className="focus:border-[rgba(127,223,255,.4)]"
          />
        </div>
        <div>
          <label style={labelStyle}>Country</label>
          <CountryCombobox
            value={form.country ?? ""}
            onChange={(code) => setForm((f) => ({ ...f, country: code }))}
          />
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          paddingTop: "10px",
        }}
      >
        <button
          type="button"
          onClick={onSkip}
          style={{
            background: "none",
            border: "none",
            color: T.ink.faint,
            fontSize: "13px",
            cursor: "pointer",
            fontFamily: "Roboto, sans-serif",
          }}
        >
          Skip for now
        </button>
        <button
          type="button"
          disabled={saving || usernameStatus === "taken"}
          onClick={() =>
            onNext({
              firstName: form.firstName,
              lastName: form.lastName,
              username: form.username,
              pronouns: (form.pronouns || null) as UserProfile["pronouns"],
              city: form.city,
              country: form.country,
            })
          }
          style={{
            padding: "10px 24px",
            borderRadius: "10px",
            border: "none",
            background: T.ink.base,
            color: T.bg.void,
            fontSize: "13px",
            fontFamily: "Roboto, sans-serif",
            fontWeight: 600,
            cursor:
              saving || usernameStatus === "taken" ? "not-allowed" : "pointer",
            opacity: saving || usernameStatus === "taken" ? 0.7 : 1,
          }}
        >
          {saving ? "Saving…" : "Continue →"}
        </button>
      </div>
    </div>
  )
}
