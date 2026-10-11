import { createTranslator, NextIntlClientProvider } from "next-intl"
import type { AnchorHTMLAttributes } from "react"
import { renderToString } from "react-dom/server"
import { beforeEach, expect, it, vi } from "vitest"

import { GlobalHeader } from "../GlobalHeader"

import cs from "../../../../locales/cs.json"
import en from "../../../../locales/en.json"
import fr from "../../../../locales/fr.json"

vi.mock("next-intl/server", () => ({
  getTranslations: async ({
    locale,
    namespace,
  }: {
    locale: "en" | "cs" | "fr"
    namespace: "ui"
  }) =>
    createTranslator({ locale, namespace, messages: { en, cs, fr }[locale] }),
}))

const { requestHeaders, session, profile } = vi.hoisted(() => ({
  requestHeaders: vi.fn(),
  session: vi.fn(),
  profile: vi.fn(),
}))
vi.mock("next/headers", () => ({ headers: requestHeaders }))
vi.mock("@/lib/auth-server", () => ({ getSessionSSR: session }))
vi.mock("@/lib/own-profile-server", () => ({ fetchOwnProfileSnippet: profile }))
vi.mock("@/components/elementary/LocaleSwitcher", () => ({
  default: () => <button>Language</button>,
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
vi.mock("@/components/global/GlobalContributeMenu", () => ({
  default: () => {
    throw new Error("App query providers required")
  },
}))
vi.mock("@/components/global/GlobalContributorShortcuts", () => ({
  default: () => null,
}))
vi.mock("@/components/global/GlobalMobileMenu", () => ({ default: () => null }))
vi.mock("@/components/global/GlobalNavbarAuthSection", () => ({
  GlobalNavbarAuthSection: () => null,
}))
vi.mock("@/components/global/GlobalNavLinks", () => ({ default: () => null }))

beforeEach(() => {
  vi.clearAllMocks()
  session.mockResolvedValue(null)
})
it.each(["en", "cs", "fr"] as const)(
  "renders the %s public beta header without app session queries or menus",
  async (locale) => {
    requestHeaders.mockResolvedValue(
      new Headers({ "x-beta-public-shell": "true" })
    )
    const html = renderToString(
      <NextIntlClientProvider
        locale={locale}
        messages={{ en, cs, fr }[locale]}
        timeZone="Europe/Prague"
      >
        {await GlobalHeader({ locale })}
      </NextIntlClientProvider>
    )
    expect(html).toContain('href="/beta"')
    expect(html).toContain({ en, cs, fr }[locale].ui.back_to_the_beta)
    expect(session).not.toHaveBeenCalled()
    expect(profile).not.toHaveBeenCalled()
  }
)
it("keeps normal application session handling outside the public shell", async () => {
  const headers = new Headers()
  requestHeaders.mockResolvedValue(headers)
  await GlobalHeader({ locale: "en" })
  expect(session).toHaveBeenCalledWith(headers)
})
