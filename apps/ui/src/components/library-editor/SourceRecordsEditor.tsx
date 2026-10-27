"use client"

import type { LibrarySourceRecord } from "@repo/shared-data"
import { useTranslations } from "next-intl"

export function SourceRecordsEditor({
  value,
  onChange,
}: {
  value: LibrarySourceRecord[]
  onChange: (value: LibrarySourceRecord[]) => void
}) {
  const t = useTranslations("ui")
  const update = (index: number, patch: Partial<LibrarySourceRecord>) =>
    onChange(value.map((r, i) => (i === index ? { ...r, ...patch } : r)))

  return (
    <div className="grid gap-3">
      <h3 className="type-h3 m-0">{t("public_source_references")}</h3>
      <p className="m-0 text-sm">{t("public_source_references_help")}</p>
      {value.map((record, index) => (
        <fieldset key={index} className="grid gap-3 rounded-xl border p-4">
          <legend>{t("source_reference_number", { number: index + 1 })}</legend>
          <label className="grid gap-1" htmlFor={`reference-url-${index}`}>
            {t("source_url")}
            <input
              id={`reference-url-${index}`}
              type="url"
              value={record.url ?? ""}
              onChange={(e) => update(index, { url: e.target.value })}
              className="rounded border p-2"
            />
          </label>
          <label className="grid gap-1" htmlFor={`reference-label-${index}`}>
            {t("source_reference_label")}
            <input
              id={`reference-label-${index}`}
              value={record.label ?? ""}
              maxLength={255}
              onChange={(e) => update(index, { label: e.target.value })}
              className="rounded border p-2"
            />
          </label>
          <button
            type="button"
            onClick={() => onChange(value.filter((_, i) => i !== index))}
            className="justify-self-start underline"
          >
            {t("remove_source_reference")}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        disabled={value.length >= 20}
        onClick={() =>
          onChange([...value, { url: "", label: "", role: "reference" }])
        }
        className="justify-self-start rounded border px-4 py-2"
      >
        {t("add_source_reference")}
      </button>
    </div>
  )
}
