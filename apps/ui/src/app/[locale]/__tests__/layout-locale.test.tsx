import { NextRequest } from "next/server"
import { createTranslator } from "next-intl"
import type { ReactNode } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { BETA_COOKIE, createBetaPass } from "@/lib/beta/access"
import { betaShellRequest } from "@/lib/proxies/betaGate"

import cs from "../../../../locales/cs.json"
import en from "../../../../locales/en.json"
import fr from "../../../../locales/fr.json"

const {
  requestConfig,
  getTranslations,
  setRequestLocale,
  requestHeaders,
  fetchFooter,
  fetchLegalDocuments,
} = vi.hoisted(() => ({
  requestConfig: {
    locale: undefined as string | undefined,
    cachedLocale: undefined as string | undefined,
  },
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
  requestHeaders: vi.fn(),
  fetchFooter: vi.fn(),
  fetchLegalDocuments: vi.fn(),
}))

vi.mock("next-intl/server", () => ({ getTranslations, setRequestLocale }))
vi.mock("next/headers", () => ({ headers: requestHeaders }))
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
vi.mock("@/lib/seo/metadata", () => ({
  DEFAULT_DESCRIPTION: "Libraries",
  DEFAULT_TITLE: "Libraries Global",
  SITE_NAME: "Libraries Global",
  getSiteUrl: () => "https://libraries.global",
}))
vi.mock("@/lib/strapi-api/content/server", () => ({
  fetchFooter,
  fetchLegalDocuments,
}))
vi.mock("@/components/beta/BetaFeedback", () => ({ BetaFeedback: () => null }))
vi.mock("@/components/beta/BetaWelcomeMount", () => ({
  BetaWelcomeMount: () => null,
}))
vi.mock("@/components/contact/ContactModalProvider", () => ({
  ContactModalProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/editorial/EditorialDrawerMount", () => ({
  EditorialDrawerMount: () => null,
}))
vi.mock("@/components/elementary/ErrorBoundary", () => ({
  ErrorBoundary: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/elementary/StrapiPreviewListener", () => ({
  default: () => null,
}))
vi.mock("@/components/elementary/TailwindIndicator", () => ({
  TailwindIndicator: () => null,
}))
vi.mock("@/components/events/EventModal", () => ({ EventModal: () => null }))
vi.mock("@/components/events/EventModalContext", () => ({
  EventModalProvider: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/global/GlobalFooter", () => ({
  default: ({
    legalDocuments,
  }: {
    legalDocuments: { slug: string; title: string }[]
  }) => (
    <footer data-site-footer="">
      {legalDocuments.map((doc) => (
        <a key={doc.slug} href={`/legal/${doc.slug}`}>
          {doc.title}
        </a>
      ))}
    </footer>
  ),
}))
vi.mock("@/components/providers/ClientProviders", () => ({
  ClientProviders: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/providers/ServerProviders", () => ({
  ServerProviders: ({ children }: { children: ReactNode }) => children,
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
  vi.stubEnv("BETA_GATE_ENABLED", "true")
  vi.stubEnv("BETA_PASSWORD", "beta-test")
  vi.stubEnv("BETA_ACCESS_SECRET", "s".repeat(32))
  requestHeaders.mockResolvedValue(new Headers())
  fetchFooter.mockResolvedValue(null)
  fetchLegalDocuments.mockResolvedValue({
    data: [{ slug: "membership", title: "Membership terms" }],
  })
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
afterEach(() => vi.unstubAllEnvs())

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

describe("legal layout after beta entry", () => {
  it("renders the site footer and standard legal links with a verified pass", async () => {
    requestHeaders.mockResolvedValue(
      betaShellRequest(
        new NextRequest("https://libraries.global/legal/membership", {
          headers: {
            cookie: `${BETA_COOKIE}=${createBetaPass({ invitationId: "i".repeat(24), expiresAt: Date.now() + 30 * 86400000 })}`,
          },
        }),
        true
      ).headers
    )
    const html = renderToStaticMarkup(
      await RootLayout({
        children: <main>Membership terms</main>,
        params: Promise.resolve({ locale: "en" }),
      })
    )
    expect(html).toContain('data-site-footer=""')
    expect(html).toContain('href="/legal/membership"')
    expect(fetchLegalDocuments).toHaveBeenCalledWith("en", "published")
  })
  it("keeps the anonymous notice independent of site footer reads", async () => {
    requestHeaders.mockResolvedValue(
      betaShellRequest(new NextRequest("https://libraries.global/legal/beta"))
        .headers
    )
    const html = renderToStaticMarkup(
      await RootLayout({
        children: <main>Beta notice</main>,
        params: Promise.resolve({ locale: "en" }),
      })
    )
    expect(html).toContain("Beta notice")
    expect(html).not.toContain('data-site-footer=""')
    expect(fetchFooter).not.toHaveBeenCalled()
    expect(fetchLegalDocuments).not.toHaveBeenCalled()
  })
})
