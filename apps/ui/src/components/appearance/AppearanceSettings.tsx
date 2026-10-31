"use client"

import { useTranslations } from "next-intl"
import { useId } from "react"

import { APPEARANCE_ICONS } from "@/components/appearance/AppearanceControl"
import { useAppearance } from "@/components/appearance/AppearanceProvider"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  APPEARANCE_PREFERENCES,
  isAppearancePreference,
} from "@/lib/appearance"

function appearanceStatus(
  appearance: NonNullable<ReturnType<typeof useAppearance>>
) {
  if (!appearance.enabled) return "unavailable"
  const status = {
    error: "syncError",
    loading: "loading",
    saving: "saving",
    saved: "saved",
  } as const
  if (appearance.status in status)
    return status[appearance.status as keyof typeof status]
  if (!appearance.storageAvailable) return "memoryOnly"

  return appearance.actor ? "accountHint" : "browserHint"
}

/** Saves independently from profile identity/avatar changes. */
export function AppearanceSettings({
  id: sectionId = "appearance",
}: {
  readonly id?: string
}) {
  const appearance = useAppearance()
  const t = useTranslations("appearance")
  const id = useId()
  if (!appearance) return null
  const status = appearanceStatus(appearance)
  const handleRetry = appearance.retry

  return (
    <section
      id={sectionId}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-5 sm:p-7"
    >
      <h2 id={`${id}-title`} className="type-panel-title m-0">
        {t("settingsTitle")}
      </h2>
      <p id={`${id}-hint`} className="mt-2 mb-5 text-sm text-(--t-ink-dim)">
        {t("settingsHint")}
      </p>
      <RadioGroup
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-hint`}
        value={appearance.preference}
        disabled={!appearance.ready || !appearance.enabled}
        onValueChange={(value) => {
          if (isAppearancePreference(value)) appearance.choose(value)
        }}
        className="grid gap-3 sm:grid-cols-3"
      >
        {APPEARANCE_PREFERENCES.map((value) => {
          const Icon = APPEARANCE_ICONS[value]

          return (
            <label
              key={value}
              htmlFor={`${id}-${value}`}
              data-selected={appearance.preference === value}
              className="flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border border-(--t-control-border) bg-(--t-bg-surface) p-4 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-(--t-accent-primary) data-[selected=true]:border-(--t-accent-primary) data-[selected=true]:bg-(--t-bg-selected)"
            >
              <RadioGroupItem
                id={`${id}-${value}`}
                value={value}
                aria-describedby={`${id}-${value}-hint`}
                className="mt-1 shrink-0"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2 font-semibold">
                  <Icon size={18} aria-hidden="true" />
                  {t(value)}
                </span>
                <span
                  id={`${id}-${value}-hint`}
                  className="mt-1 block text-sm text-(--t-ink-dim)"
                >
                  {t(`${value}Hint`)}
                </span>
              </span>
            </label>
          )
        })}
      </RadioGroup>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        <p role="status" aria-live="polite" className="m-0 text-(--t-ink-dim)">
          {t(status)}
        </p>
        {appearance.status === "error" && appearance.enabled ? (
          <Button
            type="button"
            variant="surface"
            size="pill-sm"
            onClick={handleRetry}
          >
            {t("retry")}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
