"use client"

import { CircleDot, Save } from "lucide-react"
import { useTranslations } from "next-intl"
import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

import { AppearanceSettings } from "@/components/appearance/AppearanceSettings"
import { MembershipSettingsLink } from "@/components/membership/MembershipSettingsLink"
import { ProfileProgress } from "@/components/profile-form/ProfileProgress"
import {
  AffiliationSection,
  IdentitySection,
  InterestsSection,
  LinksSection,
} from "@/components/profile-form/ProfileSections"
import { useProfileForm } from "@/components/profile-form/useProfileForm"
import { Button } from "@/components/ui/button"
import { useMounted } from "@/hooks/useMounted"
import { useProfile } from "@/hooks/useProfile"
import { sessionTeamsOf } from "@/lib/access-server"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

import { DataAccountSection } from "./DataAccountSection"
import { NotificationsSection } from "./NotificationsSection"
import { PrivacySection } from "./PrivacySection"
import { SignInSecuritySection } from "./SignInSecuritySection"

/** The account cards under the profile ones, listed in the side card. */
const ACCOUNT_LINKS = [
  {
    id: "membership",
    label: "Membership & billing",
    icon: "mdi:credit-card-outline",
  },
  { id: "notifications", label: "Notifications", icon: "mdi:bell-outline" },
  { id: "security", label: "Sign-in & security", icon: "mdi:lock-outline" },
  { id: "data", label: "Your data & account", icon: "mdi:tray-arrow-down" },
]

/**
 * Settings, laid out like onboarding: the same profile cards in the main
 * column, then Privacy, Notifications, Sign-in & security and Your data.
 * The profile cards save together from the side card; the account cards
 * save each change as it's made.
 */
export function SettingsShell({
  profile,
  sessionUser,
  avatarUrl,
  imageUploadsEnabled = true,
  embedded = false,
  onDirtyChange,
  onSaved,
  saveActionsTarget,
}: {
  profile: UserProfile | null
  sessionUser: BetterAuthUser
  /** The browser-safe avatar URL (`avatarSrc`), or null. */
  avatarUrl: string | null
  imageUploadsEnabled?: boolean
  embedded?: boolean
  onDirtyChange?: (dirty: boolean) => void
  onSaved?: () => void
  /** Keeps the live save handler and status in the drawer's fixed footer. */
  saveActionsTarget?: HTMLElement | null
}) {
  const tUi = useTranslations("ui")
  const settings = useTranslations("profileSettingsToolbar")

  const router = useRouter()
  const mounted = useMounted()
  // The eligibility check uses the opening time; this value never needs updating.
  // eslint-disable-next-line react/hook-use-state
  const [settingsOpenedAt] = useState(Date.now)
  const { saving, updateProfile } = useProfile()
  const form = useProfileForm({
    profile,
    sessionName: sessionUser.name ?? "",
    avatarUrl,
    imageUploadsEnabled,
  })
  const payload = JSON.stringify(form.payload({ visibility: false }))
  const [savedPayload, setSavedPayload] = useState(payload)
  const dirty = payload !== savedPayload
  useEffect(() => {
    onDirtyChange?.(payload !== savedPayload)
  }, [onDirtyChange, payload, savedPayload])

  const handleSave = async () => {
    if (form.usernameStatus === "taken") {
      toast.error("That username is taken")

      return
    }
    // Visibility saves from the Privacy card as soon as it changes.
    const body: Record<string, unknown> = form.payload({ visibility: false })
    const ok = await updateProfile(body)
    if (!ok) return
    setSavedPayload(payload)
    onSaved?.()
    if (embedded) return
    if (body.username && body.username !== profile?.username)
      router.push(`/profile/${body.username as string}`)
    else router.refresh()
  }

  return (
    <div
      className={
        embedded
          ? "profile-settings-embedded"
          : "mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8"
      }
    >
      {embedded && saveActionsTarget
        ? createPortal(
            <div className="profile-settings-save-actions">
              <span
                className={dirty ? "profile-settings-save-status" : "sr-only"}
                role="status"
              >
                {dirty ? <CircleDot size={16} aria-hidden="true" /> : null}
                <span className="sr-only md:not-sr-only">
                  {settings(dirty ? "unsaved" : "saved")}
                </span>
              </span>
              <Button
                type="button"
                variant="primary"
                size="pill"
                disabled={
                  !mounted ||
                  saving ||
                  !dirty ||
                  form.usernameStatus === "taken"
                }
                onClick={() => void handleSave()}
              >
                <Save aria-hidden="true" />
                {saving ? tUi("saving") : settings("save")}
              </Button>
            </div>,
            saveActionsTarget
          )
        : null}
      <div
        className={
          embedded
            ? "grid min-w-0 grid-cols-1 gap-6"
            : "grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"
        }
      >
        <div className="flex min-w-0 flex-col gap-5">
          <IdentitySection form={form} />
          <AffiliationSection
            form={form}
            claimedLibraries={profile?.claimedLibraries ?? []}
            isVerifiedLibrarian={profile?.isVerifiedLibrarian === true}
          />
          <InterestsSection form={form} />
          <LinksSection form={form} />
          <MembershipSettingsLink
            plan={sessionUser.plan ?? "free"}
            source={sessionUser.planSource}
          />
          <PrivacySection
            profile={profile}
            visibility={form.visibility}
            onVisibilityChange={form.setVisibility}
          />
          <AppearanceSettings />
          <NotificationsSection
            profile={profile}
            hasTeam={sessionTeamsOf(sessionUser).some(
              (team) =>
                team.status === "active" &&
                (!team.expiresAt ||
                  Date.parse(team.expiresAt) > settingsOpenedAt)
            )}
          />
          <SignInSecuritySection />
          <DataAccountSection sessionUser={sessionUser} />
        </div>

        {/* ── Aside: progress, save, other sections (sticky) ── */}
        {!embedded ? (
          <aside
            aria-label={tUi("your_profile")}
            className="flex flex-col gap-4 self-start lg:sticky lg:top-(--sticky-content-top) lg:max-h-(--sticky-content-max-height) lg:overflow-y-auto lg:overscroll-contain"
          >
            <ProfileProgress
              title={tUi("your_profile")}
              steps={form.steps("privacy")}
              links={[
                {
                  id: "appearance",
                  label: settings("appearance"),
                  icon: "mdi:theme-light-dark",
                },
                ...ACCOUNT_LINKS,
              ]}
            >
              <Button
                type="button"
                variant="primary"
                size="pill"
                disabled={!mounted || saving || form.usernameStatus === "taken"}
                onClick={() => void handleSave()}
                className="w-full border-0 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ fontFamily: T.font.sans }}
              >
                {saving ? tUi("saving") : "Save profile"}
              </Button>
              <p
                className="m-0 text-sm leading-[1.55]"
                style={{ color: T.ink.dim }}
              >
                Saves the profile cards. Privacy and notification changes save
                as you make them.
              </p>
            </ProfileProgress>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
