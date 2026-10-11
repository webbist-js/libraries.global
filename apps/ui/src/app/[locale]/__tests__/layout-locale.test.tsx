import { createTranslator } from "next-intl"
import { beforeEach, describe, expect, it, vi } from "vitest"

import cs from "../../../../locales/cs.json"
import en from "../../../../locales/en.json"
import fr from "../../../../locales/fr.json"

const { requestConfig, getTranslations, setRequestLocale } = vi.hoisted(() => ({
  requestConfig: {
    locale: undefined as string | undefined,
    cachedLocale: undefined as string | undefined,
  },
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}))

vi.mock("next-intl/server", () => ({ getTranslations, setRequestLocale }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("Not found")
  },
}))
vi.mock("@/lib/navigation", () => ({
  routing: { locales: ["cs", "en", "fr"], defaultLocale: "en" },
}))
vi.mock("@/lib/fonts", () => ({
  fontFigtree: { variable: "figtree" },
  fontJetBrainsMono: { variable: "mono" },
  fontNewsreader: { variable: "newsreader" },
}))
vi.mock("@/lib/build", () => ({ debugStaticParams: vi.fn() }))
vi.mock("@/lib/general-helpers", () => ({ isProduction: () => false }))
vi.mock("@/lib/beta/access", () => ({ betaEnabled: () => false }))
vi.mock("@/lib/seo/metadata", () => ({
  DEFAULT_DESCRIPTION: "Libraries",
  DEFAULT_TITLE: "Libraries Global",
  SITE_NAME: "Libraries Global",
  getSiteUrl: () => "https://libraries.global",
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchFooter: async () => null,
  fetchLegalDocuments: async () => null,
}))
vi.mock("@/components/beta/BetaFeedback", () => ({ BetaFeedback: () => null }))
vi.mock("@/components/contact/ContactModalProvider", () => ({
  ContactModalProvider: () => null,
}))
vi.mock("@/components/editorial/EditorialDrawerMount", () => ({
  EditorialDrawerMount: () => null,
}))
vi.mock("@/components/elementary/ErrorBoundary", () => ({
  ErrorBoundary: () => null,
}))
vi.mock("@/components/elementary/StrapiPreviewListener", () => ({
  default: () => null,
}))
vi.mock("@/components/elementary/TailwindIndicator", () => ({
  TailwindIndicator: () => null,
}))
vi.mock("@/components/events/EventModal", () => ({ EventModal: () => null }))
vi.mock("@/components/events/EventModalContext", () => ({
  EventModalProvider: () => null,
}))
vi.mock("@/components/global/GlobalFooter", () => ({ default: () => null }))
vi.mock("@/components/providers/ClientProviders", () => ({
  ClientProviders: () => null,
}))
vi.mock("@/components/providers/ServerProviders", () => ({
  ServerProviders: () => null,
}))
vi.mock("@/components/providers/TrackingScripts", () => ({
  default: () => null,
}))
vi.mock("@/components/staff/StaffDrawerMount", () => ({
  StaffDrawerMount: () => null,
}))
vi.mock("@/components/ui/sonner", () => ({ Toaster: () => null }))

const { default: RootLayout } = await import("../layout")

beforeEach(() => {
  vi.clearAllMocks()
  requestConfig.locale = undefined
  requestConfig.cachedLocale = undefined
  setRequestLocale.mockImplementation((locale: string) => {
    requestConfig.locale = locale
  })
  // Static pages have no locale request header. next-intl caches the config
  // on its first read, including an English fallback if the route isn't set yet.
  getTranslations.mockImplementation(async () => {
    requestConfig.cachedLocale ??= requestConfig.locale ?? "en"
    const locale = requestConfig.cachedLocale as "en" | "cs" | "fr"

    return createTranslator({
      locale,
      messages: { en, cs, fr }[locale],
      namespace: "ui",
    })
  })
})

describe("root layout language context for static pages", () => {
  it.each(["en", "cs", "fr"] as const)(
    "initializes %s before the first translation config read",
    async (locale) => {
      await RootLayout({ children: null, params: Promise.resolve({ locale }) })

      expect(requestConfig.cachedLocale).toBe(locale)
      expect(setRequestLocale.mock.invocationCallOrder[0]).toBeLessThan(
        getTranslations.mock.invocationCallOrder[0]!
      )
    }
  )

  it("rejects an unknown language before initializing translations", async () => {
    await expect(
      RootLayout({
        children: null,
        params: Promise.resolve({ locale: "unknown" }),
      })
    ).rejects.toThrow("Not found")
    expect(getTranslations).not.toHaveBeenCalled()
    expect(setRequestLocale).not.toHaveBeenCalled()
  })
})
