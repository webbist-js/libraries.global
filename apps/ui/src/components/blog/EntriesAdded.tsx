import { useLocale, useTranslations } from "next-intl"

import { cn } from "@/lib/styles"

export function EntriesAdded({
  value,
  origin,
  variant = "stat",
  className = "",
}: {
  readonly value?: number | null
  readonly origin?: string | null
  readonly variant?: "stat" | "pill"
  readonly className?: string
}) {
  const t = useTranslations("editorial")
  const locale = useLocale()

  return origin === "index" &&
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 ? (
    <span
      className={cn(
        "entries-added",
        variant === "pill" && "entries-added--pill",
        className
      )}
    >
      <strong>{value.toLocaleString(locale)}</strong>
      <span>{t("entriesAdded")}</span>
    </span>
  ) : null
}
