"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { SupporterPreferences } from "@/components/community/SupporterPreferences"
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
  const tExisting = useTranslations()

  const tStatic = useTranslations("staticUi")

  const tUi = useTranslations("ui")

  const [prefs, setPrefs] = useState<PublicPrefs>(() =>
    resolvePublicPrefs(profile?.publicPrefs)
  )

  const changeVisibility = async (v: Visibility) => {
    const prev = visibility
    onVisibilityChange(v)
    const ok = await patchProfile({ profileVisibility: v })
    if (!ok) {
      onVisibilityChange(prev)
      toast.error(tStatic("common.saveFailed"))
    }
  }

  const togglePref = async (key: keyof PublicPrefs) => {
    const prev = { ...prefs }
    const next = { ...prev, [key]: !prev[key] }
    setPrefs(next)
    const ok = await patchProfile({ publicPrefs: next })
    if (!ok) {
      setPrefs(prev)
      toast.error(tStatic("common.saveFailed"))
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
      label: tUi("location"),
      desc: location || tExisting("widgetSettings.notSet"),
    },
    {
      key: "showAffiliation",
      label: tStatic("profileRoute.verified_affiliation"),
      desc: affiliationName ?? "No affiliation yet",
    },
    {
      key: "showActivity",
      label: tStatic("profileRoute.activity_graph"),
      desc: "Days you contributed",
    },
    {
      key: "showFollows",
      label: tStatic("profileRoute.libraries_and_drives_you_follow"),
      desc: firstFollow ?? "Libraries and drives you keep an eye on",
    },
  ]

  return (
    <SectionCard
      id="privacy"
      title={tUi("privacy")}
      lead={tStatic(
        "profileRoute.your_contributions_stay_attributed_to_your_username_either_way_changes_here_save_straight_away"
      )}
    >
      <div>
        <p
          id="privacy-visibility"
          className="m-0 mb-3 text-base font-semibold"
          style={{ color: T.ink.base }}
        >
          {tStatic("profileRoute.who_can_see_your_profile")}
        </p>
        <VisibilityChoice
          value={visibility}
          onChange={(v) => void changeVisibility(v)}
          labelledBy="privacy-visibility"
        />
      </div>

      <div>
        <p
          className="m-0 mb-1 text-base font-semibold"
          style={{ color: T.ink.base }}
        >
          {tStatic("profileRoute.show_on_your_public_profile")}
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
                className="m-0 text-base font-medium"
                style={{ color: T.ink.base }}
              >
                {row.label}
              </p>
              <p
                className="m-0 mt-0.5 truncate text-sm"
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

      {profile?.isSupporter ? (
        <div>
          <p
            className="m-0 mb-2 text-base font-semibold"
            style={{ color: T.ink.base }}
          >
            {tStatic("profileRoute.supporter_recognition")}
          </p>
          <SupporterPreferences
            key={`${profile.supporterListed}-${profile.supporterBadgeVisible}-${visibility}`}
            listed={profile.supporterListed}
            badgeVisible={profile.supporterBadgeVisible}
            visibility={visibility}
          />
        </div>
      ) : null}
    </SectionCard>
  )
}
