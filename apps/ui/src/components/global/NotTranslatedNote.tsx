import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import { notTranslatedText } from "@/lib/locale-fallback"

/**
 * "Not yet translated into Czech." — shown under a title when the page is
 * the default-locale stand-in for a missing translation.
 */
export function NotTranslatedNote({ locale }: { readonly locale: string }) {
  return (
    <p
      className="mt-3 mb-0 flex items-center gap-1.5 text-[15px]"
      style={{ color: T.ink.dim, fontFamily: T.font.sans }}
    >
      <Icon aria-hidden="true" height={16} icon="mdi:translate" width={16} />
      {notTranslatedText(locale)}
    </p>
  )
}
