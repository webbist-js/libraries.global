"use client"

import { useState } from "react"
import { toast } from "sonner"

import { SectionCard } from "@/components/profile-form/FormParts"
import { VisibilityChoice } from "@/components/profile-form/ProfileSections"
import { ToggleSwitch } from "@/components/settings/ToggleSwitch"
import { T } from "@/lib/design-tokens"
import {
  resolvePublicPrefs,
  type PublicPrefs,
  type UserProfile,
} from "@/lib/types/profile"

type Visibility = "public" | "limited" | "private"

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

/**
 * Who can see the profile and what shows on it. Each change saves at once;
 * the visibility value is the settings form's, so its side card stays in step.
 */
export function PrivacySection({
  profile,
  visibility,
  onVisibilityChange,
}: {
  profile: UserProfile | null
  visibility: Visibility
  onVisibilityChange: (v: Visibility) => void
}) {
  const [prefs, setPrefs] = useState<PublicPrefs>(() =>
    resolvePublicPrefs(profile?.publicPrefs)
  )

  const changeVisibility = async (v: Visibility) => {
    const prev = visibility
    onVisibilityChange(v)
    const ok = await patchProfile({ profileVisibility: v })
    if (!ok) {
      onVisibilityChange(prev)
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
      label: "Libraries and drives you follow",
      desc: firstFollow ?? "Libraries and drives you keep an eye on",
    },
  ]

  return (
    <SectionCard
      id="privacy"
      title="Privacy"
      lead="Your contributions stay attributed to your username either way. Changes here save straight away."
    >
      <div>
        <p
          id="privacy-visibility"
          className="m-0 mb-3 text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          Who can see your profile
        </p>
        <VisibilityChoice
          value={visibility}
          onChange={(v) => void changeVisibility(v)}
          labelledBy="privacy-visibility"
        />
      </div>

      <div>
        <p
          className="m-0 mb-1 text-[15px] font-semibold"
          style={{ color: T.ink.base }}
        >
          Show on your public profile
        </p>
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
    </SectionCard>
  )
}
