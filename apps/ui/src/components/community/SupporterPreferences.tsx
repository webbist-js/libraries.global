"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Switch } from "@/components/ds/Switch"
import GlobalLink from "@/components/global/GlobalLink"
import { T } from "@/lib/design-tokens"
import { useRouter } from "@/lib/navigation"

/** Shared controls on the directory and in Settings. Each field saves alone. */
export function SupporterPreferences({
  listed = true,
  badgeVisible = true,
  visibility,
  compact = false,
}: {
  readonly listed?: boolean
  readonly badgeVisible?: boolean
  readonly visibility: string
  readonly compact?: boolean
}) {
  const router = useRouter()
  const [prefs, setPrefs] = useState({
    supporterListed: listed,
    supporterBadgeVisible: badgeVisible,
  })
  const [saving, setSaving] = useState(false)
  const publicProfile = visibility === "public"

  async function save(key: keyof typeof prefs, value: boolean) {
    setSaving(true)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      })
      if (!res.ok) throw new Error("Save failed")
      setPrefs((previous) => ({ ...previous, [key]: value }))
      toast.success("Supporter preference saved")
      router.refresh()
    } catch {
      toast.error("Couldn't save your preference. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      id={compact ? undefined : "supporter-settings"}
      className={
        compact
          ? "flex max-w-[440px] flex-wrap items-center gap-2"
          : "flex flex-col gap-2"
      }
    >
      <Switch
        label={
          compact ? "Show me on this page" : "Show me on the supporters page"
        }
        checked={publicProfile && prefs.supporterListed}
        disabled={saving || !publicProfile}
        inline={compact}
        controlFirst={compact}
        className={
          compact
            ? "rounded-full border border-(--t-border-hi) bg-(--t-bg-deep) py-1 pr-4 pl-2 font-semibold"
            : undefined
        }
        onChange={(next) => void save("supporterListed", next)}
        description={
          compact
            ? undefined
            : "Your name and public location. You can opt out at any time."
        }
      />
      {compact ? (
        <GlobalLink
          href="/profile/settings#supporter-settings"
          className="inline-flex min-h-13 items-center rounded-full border px-5 py-2.5 text-[14px] font-semibold no-underline"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          Supporter mark settings
        </GlobalLink>
      ) : (
        <Switch
          label="Show the Supporter mark on my profile"
          checked={prefs.supporterBadgeVisible}
          disabled={saving}
          onChange={(next) => void save("supporterBadgeVisible", next)}
          description="The mark never shows your plan, payment amount or contributor role."
        />
      )}
      {!publicProfile ? (
        <p className="m-0 basis-full text-[14px]" style={{ color: T.ink.dim }}>
          Private and limited profiles are not listed. Make your profile public
          in Settings, then choose whether to be listed.
        </p>
      ) : null}
    </div>
  )
}
