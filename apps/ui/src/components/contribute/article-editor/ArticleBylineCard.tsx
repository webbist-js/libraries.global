"use client"

import { useTranslations } from "next-intl"

import { SelectField } from "@/components/ds/SelectField"

export function ArticleBylineCard({
  byline,
  origin,
  allowIndex,
  disabled,
  onChange,
  embedded = false,
}: {
  readonly embedded?: boolean
  readonly byline: string
  readonly origin: "community" | "index"
  readonly allowIndex: boolean
  readonly disabled: boolean
  readonly onChange: (patch: {
    byline?: string
    origin?: "community" | "index"
  }) => void
}) {
  const t = useTranslations("articleAttribution")
  const p = useTranslations("publishing")
  const w = useTranslations("writeWorkspace")

  return (
    <section
      className={
        embedded
          ? "grid gap-3 border-t border-(--t-border-line) pt-5"
          : "grid gap-3 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-6"
      }
    >
      <h2 className="m-0 text-[17px] font-bold">{t("heading")}</h2>
      <label className="grid gap-1">
        {t("byline")}
        <input
          value={byline}
          maxLength={120}
          disabled={disabled}
          onChange={(event) => onChange({ byline: event.target.value })}
          className="min-h-[48px] w-full min-w-0 rounded-[14px] border border-(--t-border-hi) bg-(--t-bg-deep) px-3 py-2 text-[16px]"
        />
      </label>
      <p className="m-0 text-sm text-(--t-ink-dim)">
        {byline.trim() ? t("bylineHelp") : w("profileByline")}
      </p>
      {byline.trim() && (
        <p className="m-0 text-sm font-semibold">
          {p("bylinePreview", { name: byline.trim() })}
        </p>
      )}
      {allowIndex && (
        <label className="grid gap-1">
          {t("origin")}
          <SelectField
            value={origin}
            label={t("origin")}
            disabled={disabled}
            onValueChange={(value) =>
              onChange({ origin: value === "index" ? "index" : "community" })
            }
            options={[
              { value: "community", label: t("community") },
              { value: "index", label: t("index") },
            ]}
            className="min-h-[48px] min-w-0 text-[16px]"
          />
        </label>
      )}
    </section>
  )
}
