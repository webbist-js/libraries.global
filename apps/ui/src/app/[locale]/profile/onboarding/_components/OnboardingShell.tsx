"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import { CODE_OF_CONDUCT_URL } from "@/components/legal/legal.helpers"
import { ProfileProgress } from "@/components/profile-form/ProfileProgress"
import {
  AffiliationSection,
  IdentitySection,
  InterestsSection,
  LinksSection,
  VisibilitySection,
} from "@/components/profile-form/ProfileSections"
import { useProfileForm } from "@/components/profile-form/useProfileForm"
import { useMounted } from "@/hooks/useMounted"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

type SessionUser = {
  id: string
  name: string
  email: string
  image: string | null
}

const linkClass = "underline underline-offset-[3px]"
const linkStyle: React.CSSProperties = { color: T.accent.primary }

export function OnboardingShell({
  sessionUser,
  initialProfile,
  avatarUrl,
}: {
  sessionUser: SessionUser
  initialProfile: UserProfile | null
  /** The browser-safe avatar URL (`avatarSrc`), or null. */
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  // The primary and "finish later" buttons stay disabled until mounted: see
  // useMounted. Typed any sooner, the values wouldn't reach React either.
  const mounted = useMounted()
  const form = useProfileForm({
    profile: initialProfile,
    sessionName: sessionUser.name ?? "",
    avatarUrl,
  })

  const handleSave = async (then: "profile" | "home") => {
    if (form.usernameStatus === "taken") {
      toast.error("Username is taken")

      return
    }
    setSaving(true)
    try {
      const body = form.payload()
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        toast.error("Failed to save — please try again")

        return
      }
      router.push(
        then === "profile"
          ? body.username
            ? `/profile/${body.username}`
            : "/profile"
          : "/"
      )
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  const primaryDisabled = !mounted || saving || form.usernameStatus === "taken"

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 pt-8 pb-20 sm:px-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <IdentitySection form={form} />
          <AffiliationSection form={form} />
          <InterestsSection form={form} />
          <LinksSection form={form} />
          <VisibilitySection form={form} />
        </div>

        {/* ── Aside: progress + actions (sticky) ── */}
        <aside
          aria-label="Profile setup"
          className="flex flex-col gap-4 self-start lg:sticky lg:top-24"
        >
          <ProfileProgress title="Profile setup" steps={form.steps()}>
            <button
              type="button"
              disabled={primaryDisabled}
              onClick={() => void handleSave("profile")}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-(--t-accent-primary) px-6 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover) disabled:cursor-not-allowed disabled:opacity-60"
              style={{ border: "none", fontFamily: T.font.sans }}
            >
              {saving ? (
                "Saving…"
              ) : (
                <>
                  Enter your profile
                  <Icon aria-hidden="true" icon="mdi:arrow-right" width={18} />
                </>
              )}
            </button>
            <button
              type="button"
              disabled={!mounted || saving}
              onClick={() => void handleSave("home")}
              className="inline-flex w-full items-center justify-center rounded-full px-6 py-3 text-[15px] font-semibold transition-colors hover:bg-(--t-bg-surface) disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                background: T.bg.deep,
                border: `1px solid ${T.border.hi}`,
                color: T.ink.base,
                fontFamily: T.font.sans,
              }}
            >
              Save &amp; finish later
            </button>
            <p
              className="m-0 mt-1 text-[13.5px] leading-[1.55]"
              style={{ color: T.ink.dim }}
            >
              By continuing, you agree to the{" "}
              <a
                href={CODE_OF_CONDUCT_URL}
                rel="noopener noreferrer"
                target="_blank"
                className={linkClass}
                style={linkStyle}
              >
                Contributor Covenant
                <span className="sr-only"> (opens in a new tab)</span>
              </a>{" "}
              and acknowledge that your profile data is processed as described
              in the{" "}
              <Link
                href="/legal/privacy"
                className={linkClass}
                style={linkStyle}
              >
                Privacy Policy
              </Link>
              . You can edit or delete your profile any time from{" "}
              <Link
                href="/profile/settings"
                className={linkClass}
                style={linkStyle}
              >
                Settings
              </Link>
              .
            </p>
          </ProfileProgress>
        </aside>
      </div>
    </div>
  )
}
