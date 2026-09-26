"use client"

import { useState } from "react"
import { toast } from "sonner"

import { ToggleSwitch } from "@/components/settings/ToggleSwitch"
import { T } from "@/lib/design-tokens"
import {
  resolvePublicPrefs,
  type PublicPrefs,
  type UserProfile,
} from "@/lib/types/profile"

type Visibility = "public" | "limited" | "private"

const VISIBILITY_OPTIONS: { value: Visibility; label: string; desc: string }[] =
  [
    {
      value: "public",
      label: "Public",
      desc: "Anyone can find and view your profile. Recommended for library staff.",
    },
    {
      value: "limited",
      label: "Limited",
      desc: "Only signed-in contributors can see your location and affiliation.",
    },
    {
      value: "private",
      label: "Private",
      desc: "Your profile page is hidden. Contributions show your username only.",
    },
  ]

async function patchProfile(body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch("/api/profile/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    return res.ok
  } catch {
    return false
  }
}

export function PrivacySection({ profile }: { profile: UserProfile | null }) {
  const [visibility, setVisibility] = useState<Visibility>(
    profile?.profileVisibility ?? "public"
  )
  const [prefs, setPrefs] = useState<PublicPrefs>(() =>
    resolvePublicPrefs(profile?.publicPrefs)
  )

  const changeVisibility = async (v: Visibility) => {
    const prev = visibility
    setVisibility(v)
    const ok = await patchProfile({ profileVisibility: v })
    if (!ok) {
      setVisibility(prev)
      toast.error("Couldn't save — please try again")
    }
  }

  const togglePref = async (key: keyof PublicPrefs) => {
    const prev = { ...prefs }
    const next = { ...prev, [key]: !prev[key] }
    setPrefs(next)
    const ok = await patchProfile({ publicPrefs: next })
    if (!ok) {
      setPrefs(prev)
      toast.error("Couldn't save — please try again")
    }
  }

  const location = [profile?.city, profile?.country].filter(Boolean).join(", ")
  const claimedName = profile?.claimedLibraries?.find((l) => l.name)?.name
  const affiliationName = claimedName ?? profile?.affiliation
  const firstFollow = profile?.followedLibraries?.[0]?.name

  const prefRows: {
    key: keyof PublicPrefs
    label: string
    desc: string
  }[] = [
    {
      key: "showLocation",
      label: "Location",
      desc: location || "Not set",
    },
    {
      key: "showAffiliation",
      label: "Verified affiliation",
      desc: affiliationName ?? "No affiliation yet",
    },
    {
      key: "showActivity",
      label: "Activity graph",
      desc: "Days you contributed",
    },
    {
      key: "showFollows",
      label: "Libraries you follow",
      desc: firstFollow ?? "Libraries you save",
    },
  ]

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
        Privacy
      </h2>
      <p className="mt-1 mb-6 text-[15px]" style={{ color: T.ink.dim }}>
        Your contributions stay attributed to your username either way.
      </p>

      {/* Who can see your profile */}
      <p
        className="m-0 mb-3 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Who can see your profile
      </p>
      <div
        role="radiogroup"
        aria-label="Who can see your profile"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {VISIBILITY_OPTIONS.map((opt) => {
          const selected = visibility === opt.value

          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => void changeVisibility(opt.value)}
              className="cursor-pointer rounded-[14px] border p-4 text-left transition-colors"
              style={{
                borderColor: selected ? T.accent.primary : T.border.line,
                background: selected ? T.accent.chip : T.bg.deep,
              }}
            >
              <span className="flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex size-[18px] shrink-0 items-center justify-center rounded-full border-2"
                  style={{
                    borderColor: selected ? T.accent.primary : T.border.hi,
                  }}
                >
                  {selected ? (
                    <span
                      className="size-2 rounded-full"
                      style={{ background: T.accent.primary }}
                    />
                  ) : null}
                </span>
                <span
                  className="text-[15px] font-semibold"
                  style={{ color: T.ink.base }}
                >
                  {opt.label}
                </span>
              </span>
              <span
                className="mt-2 block text-[14px] leading-[1.45]"
                style={{ color: T.ink.dim }}
              >
                {opt.desc}
              </span>
            </button>
          )
        })}
      </div>

      {/* Per-section toggles */}
      <p
        className="m-0 mt-7 mb-1 text-[15px] font-semibold"
        style={{ color: T.ink.base }}
      >
        Show on your public profile
      </p>
      <div>
        {prefRows.map((row, index) => (
          <div
            key={row.key}
            className="flex items-center justify-between gap-4 py-3.5"
            style={{
              borderBottom:
                index < prefRows.length - 1
                  ? `1px solid ${T.border.divider}`
                  : "none",
            }}
          >
            <div className="min-w-0">
              <p
                className="m-0 text-[15px] font-medium"
                style={{ color: T.ink.base }}
              >
                {row.label}
              </p>
              <p
                className="m-0 mt-0.5 truncate text-[14px]"
                style={{ color: T.ink.dim }}
              >
                {row.desc}
              </p>
            </div>
            <ToggleSwitch
              value={prefs[row.key]}
              onChange={() => void togglePref(row.key)}
              label={`Show ${row.label.toLowerCase()} on your public profile`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
