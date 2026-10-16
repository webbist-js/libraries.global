"use client"

import { useTranslations } from "next-intl"

export function ArticleBylineCard({
  byline,
  origin,
  allowIndex,
  disabled,
  onChange,
}: {
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

  return (
    <section className="grid gap-3 rounded-3xl border border-(--t-border-line) bg-(--t-bg-deep) p-6">
      <h2 className="m-0 text-lg font-bold">{t("heading")}</h2>
      <label className="grid gap-1">
        {t("byline")}
        <input
          value={byline}
          maxLength={120}
          disabled={disabled}
          onChange={(event) => onChange({ byline: event.target.value })}
          className="rounded-lg border border-(--t-border-line) p-2"
        />
      </label>
      <p className="m-0 text-sm text-(--t-ink-dim)">{t("bylineHelp")}</p>
      {allowIndex && (
        <label className="grid gap-1">
          {t("origin")}
          <select
            value={origin}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                origin: event.target.value === "index" ? "index" : "community",
              })
            }
            className="rounded-lg border border-(--t-border-line) p-2"
          >
            <option value="community">{t("community")}</option>
            <option value="index">{t("index")}</option>
          </select>
        </label>
      )}
    </section>
  )
}
