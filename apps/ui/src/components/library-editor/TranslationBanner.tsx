import { Icon } from "@iconify/react"
import { useTranslations } from "next-intl"

import { T } from "@/lib/design-tokens"

/** The Index editor's translation-mode notice. */
export function translationBannerText(
  languageName: string,
  missing = false
): string {
  const text = `Translating into ${languageName}. Only text that differs by language can be changed here.`

  return missing
    ? `${text} No ${languageName} version yet; the original is shown.`
    : text
}

/**
 * Shown above the form in translation mode: which language the edit goes
 * into, and that shared fields (type, coordinates, links, hours) are locked.
 */
export function TranslationBanner({
  languageName,
  missing = false,
}: {
  readonly languageName: string
  /** No version in this language yet: the form shows the original. */
  readonly missing?: boolean
}) {
  const t = useTranslations("translation")

  return (
    <div
      role="note"
      className="mb-8 flex items-start gap-3 rounded-[20px] p-5 text-[15px] leading-[1.5]"
      style={{
        background: T.accent.chip,
        border: `1px solid ${T.border.line}`,
        color: T.ink.base,
      }}
    >
      <Icon
        icon="mdi:translate"
        width={18}
        aria-hidden="true"
        style={{ color: T.accent.primary, flexShrink: 0, marginTop: 2 }}
      />
      <p className="m-0">
        {t("translating", { language: languageName })}
        {missing && <> {t("missingVersion", { language: languageName })}</>}
      </p>
    </div>
  )
}
