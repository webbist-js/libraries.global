import { Icon } from "@iconify/react"
import { useLocale, useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"
import { languageName } from "@/lib/locale-fallback"

/**
 * "Not yet translated into Czech." — shown under a title when the page is
 * the default-locale stand-in for a missing translation.
 */
export function NotTranslatedNote({ locale }: { readonly locale: string }) {
  const uiLocale = useLocale()
  const t = useTranslations("translation")

  return (
    <p
      className="mt-3 mb-0 flex items-center gap-1.5 text-[15px]"
      style={{ color: T.ink.dim, fontFamily: T.font.sans }}
    >
      <Icon aria-hidden="true" height={16} icon="mdi:translate" width={16} />
      {t("notTranslated", { language: languageName(locale, [], uiLocale) })}
    </p>
  )
}
