import { createTranslator } from "next-intl"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"

import cs from "../../../../locales/cs.json"
import en from "../../../../locales/en.json"
import fr from "../../../../locales/fr.json"

vi.mock("next-intl/server", () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: "en" | "cs" | "fr"
    namespace: "beta"
  }) =>
    createTranslator({ locale, namespace, messages: { en, cs, fr }[locale] }),
}))
const { BetaFooter } = await import("../BetaFooter")

it.each(["en", "cs", "fr"] as const)(
  "links the %s entrance to the beta notice and its privacy section",
  async (locale) => {
    const html = renderToStaticMarkup(await BetaFooter({ locale }))
    const prefix = locale === "en" ? "" : `/${locale}`
    expect(html).toContain(`href="${prefix}/legal/beta"`)
    expect(html).toContain(`href="${prefix}/legal/beta#privacy"`)
    expect(html).toContain({ en, cs, fr }[locale].beta.legal)
    expect(html).not.toContain('href="/legal/membership"')
  }
)
