"use client"

import { useTranslations as useUiTranslations } from "next-intl"
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
  const t = useUiTranslations("membershipPreferences")
  const tUi = useUiTranslations("ui")

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
      toast.success(t("saved"))
      router.refresh()
    } catch {
      toast.error(t("failed"))
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
        label={compact ? t("listedCompact") : t("listed")}
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
        description={compact ? undefined : t("listedDescription")}
      />
      {compact ? (
        <GlobalLink
          href="/profile/membership#recognition"
          className="inline-flex min-h-13 items-center rounded-full border px-5 py-2.5 text-sm font-semibold no-underline"
          style={{ borderColor: T.border.hi, color: T.ink.base }}
        >
          {t("settings")}
        </GlobalLink>
      ) : (
        <Switch
          label={tUi("show_the_supporter_mark_on_my_profile")}
          checked={prefs.supporterBadgeVisible}
          disabled={saving}
          onChange={(next) => void save("supporterBadgeVisible", next)}
          description={t("badgeDescription")}
        />
      )}
      {!publicProfile ? (
        <p className="m-0 basis-full text-sm" style={{ color: T.ink.dim }}>
          {t("privateProfile")}
        </p>
      ) : null}
    </div>
  )
}
