"use client"

import { useTranslations } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { authClient } from "@/lib/auth-client"
import type { NotifPrefs, UserProfile } from "@/lib/types/profile"

export function useProfile() {
  const t = useTranslations("profileFeedback")
  const [saving, setSaving] = useState(false)
  const { refetch } = authClient.useSession()

  async function updateProfile(data: Partial<UserProfile>): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        toast.error(
          t(
            res.status === 401
              ? "signIn"
              : res.status === 400
                ? "invalid"
                : "failed"
          )
        )

        return false
      }
      toast.success(t("saved"))
      // The profile route invalidates the bridge cache; update reactive form
      // defaults too. A failed refresh must not undo a successful profile save.
      try {
        await refetch()
      } catch {
        // The next session refresh can retry; the profile is already saved.
      }

      return true
    } catch {
      toast.error(t("failed"))

      return false
    } finally {
      setSaving(false)
    }
  }

  async function updateNotifications(
    prefs: Partial<NotifPrefs>
  ): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      })
      if (!res.ok) {
        toast.error(
          t(
            res.status === 401
              ? "signIn"
              : res.status === 400
                ? "invalid"
                : "notificationsFailed"
          )
        )

        return false
      }

      return true
    } catch {
      toast.error(t("notificationsFailed"))

      return false
    } finally {
      setSaving(false)
    }
  }

  return { saving, updateProfile, updateNotifications }
}
