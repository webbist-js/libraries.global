"use client"

import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"
import { type ReactNode, useState } from "react"

import { T } from "@/lib/design-tokens"
import { type PublicPrefs, resolvePublicPrefs } from "@/lib/types/profile"

/** Owner-only banner: visibility message, "Manage what's public" toggle panel, and trailing actions. */
export function ProfilePrivacyControls({
  initialPrefs,
  message,
  actions,
}: {
  initialPrefs: PublicPrefs | null | undefined
  message: ReactNode
  actions?: ReactNode
}) {
  const tStatic = useTranslations("staticUi")
  const PREF_ITEMS: { key: keyof PublicPrefs; label: string }[] = [
    { key: "showLocation", label: tStatic("profileRoute.location") },
    {
      key: "showAffiliation",
      label: tStatic("profileRoute.verified_affiliation"),
    },
    { key: "showActivity", label: tStatic("profileRoute.activity_graph") },
    {
      key: "showFollows",
      label: tStatic("profileRoute.libraries_and_drives_i_follow"),
    },
  ]

  const [open, setOpen] = useState(false)
  const [prefs, setPrefs] = useState<PublicPrefs>(() =>
    resolvePublicPrefs(initialPrefs)
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  async function toggle(key: keyof PublicPrefs) {
    const next = { ...prefs, [key]: !prefs[key] }
    setPrefs(next)
    setSaving(true)
    setError(false)
    try {
      const res = await fetch("/api/profile/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicPrefs: next }),
      })
      if (!res.ok) throw new Error("save failed")
    } catch {
      setPrefs((cur) => ({ ...cur, [key]: !next[key] }))
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="mb-6 rounded-[18px] px-5 py-3"
      style={{ background: T.accent.chip }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <p
          className="m-0 flex items-center gap-3 text-base"
          style={{ color: T.ink.dim }}
        >
          <Icon
            icon="mdi:eye-outline"
            width={20}
            height={20}
            aria-hidden="true"
            className="shrink-0"
            style={{ color: T.accent.primary }}
          />
          <span>{message}</span>
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="rounded-full px-4 py-2 text-sm font-semibold transition-colors hover:bg-(--t-bg-surface)"
            style={{ color: T.ink.base, background: T.bg.deep }}
          >
            {tStatic("profileRoute.manage_what_rsquo_s_public")}
          </button>
          {actions}
        </div>
      </div>

      {open ? (
        <fieldset
          className="mt-3 mb-2 w-full rounded-[14px] border p-4"
          style={{ borderColor: T.border.line, background: T.bg.deep }}
        >
          <legend className="px-1 text-sm font-semibold">
            {tStatic("profileRoute.shown_on_your_public_profile")}
          </legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
            {PREF_ITEMS.map(({ key, label }) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 text-base"
                style={{ color: T.ink.base }}
              >
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={() => toggle(key)}
                  disabled={saving}
                  className="size-5 cursor-pointer"
                  style={{ accentColor: T.accent.primary }}
                />
                {label}
              </label>
            ))}
          </div>
          {error ? (
            <p
              role="alert"
              className="m-0 mt-2 text-sm font-semibold"
              style={{ color: T.accent.danger }}
            >
              {tStatic("profileRoute.couldn_rsquo_t_save_please_try_again")}
            </p>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  )
}
