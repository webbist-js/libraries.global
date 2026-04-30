"use client"

import { useState } from "react"
import { toast } from "sonner"

import type { NotifPrefs, UserProfile } from "@/lib/types/profile"

export function useProfile() {
  const [saving, setSaving] = useState(false)

  async function updateProfile(data: Partial<UserProfile>): Promise<boolean> {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save profile")

        return false
      }
      toast.success("Profile saved")

      return true
    } catch {
      toast.error("Failed to save profile")

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
      const json = (await res.json()) as { error?: string }
      if (!res.ok) {
        toast.error(json.error ?? "Failed to save notifications")

        return false
      }

      return true
    } catch {
      toast.error("Failed to save notifications")

      return false
    } finally {
      setSaving(false)
    }
  }

  return { saving, updateProfile, updateNotifications }
}
