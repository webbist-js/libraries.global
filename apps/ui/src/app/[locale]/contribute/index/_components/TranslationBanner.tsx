import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"

/** The Index editor's translation-mode notice. */
export function translationBannerText(languageName: string): string {
  return `Translating into ${languageName}. Only text that differs by language can be changed here.`
}

/**
 * Shown above the form in translation mode: which language the edit goes
 * into, and that shared fields (type, coordinates, links, hours) are locked.
 */
export function TranslationBanner({
  languageName,
}: {
  readonly languageName: string
}) {
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
      <p className="m-0">{translationBannerText(languageName)}</p>
    </div>
  )
}
