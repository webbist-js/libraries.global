"use client"

import { parseArticleSources, type ArticleSource } from "@repo/shared-data"
import { useTranslations } from "next-intl"
import { useId } from "react"

/** Optional structured citations remain in the article draft until reviewed. */
export function ArticleSourcesEditor({
  sources,
  onChange,
  disabled,
}: {
  readonly sources: readonly ArticleSource[]
  readonly onChange: (sources: ArticleSource[]) => void
  readonly disabled?: boolean
}) {
  const t = useTranslations("articleSources")
  const id = useId()
  const update = (index: number, key: keyof ArticleSource, value: string) =>
    onChange(
      sources.map((source, row) =>
        row === index ? { ...source, [key]: value } : source
      )
    )
  let invalid = false
  try {
    parseArticleSources(
      sources.filter((source) =>
        Object.values(source).some(
          (value) => typeof value === "string" && value.trim()
        )
      )
    )
  } catch {
    invalid = true
  }

  return (
    <div className="article-sources-editor">
      <p>{t("hint")}</p>
      {sources.map((source, index) => (
        // eslint-disable-next-line react/no-array-index-key -- Draft citations have no persisted IDs; every field is controlled by its ordinal position.
        <fieldset key={index} disabled={disabled}>
          <legend>{t("sourceNumber", { count: index + 1 })}</legend>
          {(
            [
              ["title", "titleLabel", "text", 180],
              ["url", "urlLabel", "url", 2048],
              ["publisher", "publisherLabel", "text", 180],
              ["accessedAt", "accessedLabel", "date", 10],
            ] as const
          ).map(([key, label, type, max]) => (
            <label key={key} htmlFor={`${id}-${index}-${key}`}>
              {t(label)}
              <input
                id={`${id}-${index}-${key}`}
                type={type}
                maxLength={max}
                value={source[key] ?? ""}
                onChange={(event) => update(index, key, event.target.value)}
              />
            </label>
          ))}
          <label htmlFor={`${id}-${index}-notes`}>
            {t("notesLabel")}
            <textarea
              id={`${id}-${index}-notes`}
              maxLength={1000}
              value={source.notes ?? ""}
              onChange={(event) => update(index, "notes", event.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                const next = [...sources]
                ;[next[index - 1], next[index]] = [
                  next[index]!,
                  next[index - 1]!,
                ]
                onChange(next)
              }}
            >
              {t("moveUp")}
            </button>
            <button
              type="button"
              onClick={() =>
                onChange(sources.filter((_, row) => row !== index))
              }
            >
              {t("remove")}
            </button>
          </div>
        </fieldset>
      ))}
      {invalid ? <p role="status">{t("invalid")}</p> : null}
      <button
        type="button"
        disabled={disabled || sources.length >= 30}
        onClick={() => onChange([...sources, { title: "", url: "" }])}
      >
        {t("add")}
      </button>
    </div>
  )
}
