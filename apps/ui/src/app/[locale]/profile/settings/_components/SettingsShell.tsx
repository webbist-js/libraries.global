"use client"

import { toast } from "sonner"

import { ProfileProgress } from "@/components/profile-form/ProfileProgress"
import {
  AffiliationSection,
  IdentitySection,
  InterestsSection,
  LinksSection,
} from "@/components/profile-form/ProfileSections"
import { useProfileForm } from "@/components/profile-form/useProfileForm"
import { useMounted } from "@/hooks/useMounted"
import { useProfile } from "@/hooks/useProfile"
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
}: {
  profile: UserProfile | null
  sessionUser: BetterAuthUser
  /** The browser-safe avatar URL (`avatarSrc`), or null. */
  avatarUrl: string | null
}) {
  const router = useRouter()
  const mounted = useMounted()
  const { saving, updateProfile } = useProfile()
  const form = useProfileForm({
    profile,
    sessionName: sessionUser.name ?? "",
    avatarUrl,
  })

  const handleSave = async () => {
    if (form.usernameStatus === "taken") {
      toast.error("That username is taken")

      return
    }
    // Visibility saves from the Privacy card as soon as it changes.
    const body: Record<string, unknown> = form.payload({ visibility: false })
    const ok = await updateProfile(body)
    if (!ok) return
    if (body.username && body.username !== profile?.username)
      router.push(`/profile/${body.username as string}`)
    else router.refresh()
  }

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <IdentitySection form={form} />
          <AffiliationSection
            form={form}
            claimedLibraries={profile?.claimedLibraries ?? []}
            isVerifiedLibrarian={profile?.isVerifiedLibrarian === true}
          />
          <InterestsSection form={form} />
          <LinksSection form={form} />
          <PrivacySection
            profile={profile}
            visibility={form.visibility}
            onVisibilityChange={form.setVisibility}
          />
          <NotificationsSection profile={profile} />
          <SignInSecuritySection />
          <DataAccountSection sessionUser={sessionUser} />
        </div>

        {/* ── Aside: progress, save, other sections (sticky) ── */}
        <aside
          aria-label="Your profile"
          className="flex flex-col gap-4 self-start lg:sticky lg:top-24"
        >
          <ProfileProgress
            title="Your profile"
            steps={form.steps("privacy")}
            links={ACCOUNT_LINKS}
          >
            <button
              type="button"
              disabled={!mounted || saving || form.usernameStatus === "taken"}
              onClick={() => void handleSave()}
              className="inline-flex w-full items-center justify-center rounded-full bg-(--t-accent-primary) px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
              style={{ border: "none", fontFamily: T.font.sans }}
            >
              {saving ? "Saving…" : "Save profile"}
            </button>
            <p
              className="m-0 text-[13.5px] leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              Saves the profile cards. Privacy and notification changes save as
              you make them.
            </p>
          </ProfileProgress>
        </aside>
      </div>
    </div>
  )
}
