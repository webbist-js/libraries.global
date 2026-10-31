import { useLocale, useTranslations } from "next-intl"

export function EntriesAdded({
  value,
  origin,
}: {
  readonly value?: number | null
  readonly origin?: string | null
}) {
  const t = useTranslations("editorial")
  const locale = useLocale()

  return origin === "index" &&
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 ? (
    <span className="entries-added">
      <strong>{value.toLocaleString(locale)}</strong>
      <span>{t("entriesAdded")}</span>
    </span>
  ) : null
}
