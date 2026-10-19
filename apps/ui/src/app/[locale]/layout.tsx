import "@/styles/globals.css"

import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Script from "next/script"
import type { Locale } from "next-intl"
import {
  getTranslations as getUiTranslations,
  setRequestLocale,
} from "next-intl/server"

import { BetaFeedback } from "@/components/beta/BetaFeedback"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import { StickyPageLayout } from "@/components/ds/StickyPageLayout"
import { EditorialDrawerMount } from "@/components/editorial/EditorialDrawerMount"
import { ErrorBoundary } from "@/components/elementary/ErrorBoundary"
import StrapiPreviewListener from "@/components/elementary/StrapiPreviewListener"
import { TailwindIndicator } from "@/components/elementary/TailwindIndicator"
import { EventModal } from "@/components/events/EventModal"
import { EventModalProvider } from "@/components/events/EventModalContext"
import GlobalFooter from "@/components/global/GlobalFooter"
import { ClientProviders } from "@/components/providers/ClientProviders"
import { ServerProviders } from "@/components/providers/ServerProviders"
import TrackingScripts from "@/components/providers/TrackingScripts"
import { StaffDrawerMount } from "@/components/staff/StaffDrawerMount"
import { Toaster } from "@/components/ui/sonner"
import { betaEnabled } from "@/lib/beta/access"
import { debugStaticParams } from "@/lib/build"
import { fontFigtree, fontJetBrainsMono, fontNewsreader } from "@/lib/fonts"
import { isProduction } from "@/lib/general-helpers"
import { routing } from "@/lib/navigation"
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  getSiteUrl,
  SITE_NAME,
} from "@/lib/seo/metadata"
import {
  fetchFooter,
  fetchLegalDocuments,
} from "@/lib/strapi-api/content/server"
import { cn } from "@/lib/styles"

export function generateStaticParams() {
  const locales = routing.locales.map((locale) => ({ locale }))
  debugStaticParams(locales, "[locale]")

  return locales
}

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    template: `%s / ${SITE_NAME}`,
    default: DEFAULT_TITLE,
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: isProduction(), follow: true },
  icons: {
    icon: [
      {
        url: "/favicon.ico?v=globe-1",
        sizes: "16x16 32x32 48x48 64x64 256x256",
      },
      { url: "/favicon.svg?v=globe-1", type: "image/svg+xml" },
    ],
    apple: {
      url: "/apple-touch-icon.png?v=globe-1",
      sizes: "180x180",
      type: "image/png",
    },
  },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
  },
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale }
  if (!routing.locales.includes(locale)) notFound()

  // Static pages have no locale header. Set the route locale before any
  // translation read caches the config inherited by the client provider.
  setRequestLocale(locale)
  const tUi = await getUiTranslations("ui")

  const requestHeaders = await headers()
  const liveConsole = requestHeaders.get("x-live-console") === "true"
  const mobileApp = requestHeaders.get("x-mobile-app") === "true"
  const betaShell = requestHeaders.get("x-beta-public-shell") === "true"
  const nonce = requestHeaders.get("x-nonce") ?? undefined
  const contactAliases = [
    process.env.BETA_CONTACT_EMAIL ?? "info@libraries.global",
  ]
  const [footerRes, legalRes] = await Promise.all([
    liveConsole || betaShell ? Promise.resolve(null) : fetchFooter(locale),
    liveConsole || betaShell
      ? Promise.resolve(null)
      : fetchLegalDocuments(locale, "published"),
  ])
  const footer = footerRes?.data

  // Keep the public entrance independent of CMS reads and account/data providers.
  if (betaShell)
    return (
      <html lang={locale}>
        <head>
          <PublicRuntimeConfig nonce={nonce} />
        </head>
        <body
          className={cn(
            "min-h-screen antialiased",
            fontFigtree.variable,
            fontNewsreader.variable,
            fontJetBrainsMono.variable
          )}
        >
          <a href="#main" className="skip-link">
            {tUi("skip_to_main_content")}
          </a>
          <TrackingScripts nonce={nonce} locale={locale} />
          <ServerProviders>
            <ContactModalProvider aliases={contactAliases}>
              <StickyPageLayout id="main">{children}</StickyPageLayout>
              <BetaFeedback label={tUi("feedback")} />
            </ContactModalProvider>
          </ServerProviders>
        </body>
      </html>
    )

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      data-mobile-app={mobileApp ? "true" : undefined}
    >
      <head>
        <PublicRuntimeConfig nonce={nonce} />
      </head>
      <body
        className={cn(
          "min-h-screen antialiased",
          fontFigtree.variable,
          fontNewsreader.variable,
          fontJetBrainsMono.variable
        )}
      >
        <a href="#main" className="skip-link">
          {tUi("skip_to_main_content")}{" "}
        </a>
        {!liveConsole && <TrackingScripts nonce={nonce} locale={locale} />}
        <ServerProviders>
          <ContactModalProvider aliases={contactAliases}>
            {!liveConsole && <StrapiPreviewListener />}
            <ClientProviders nonce={nonce} liveConsole={liveConsole}>
              <EventModalProvider>
                <div className="relative flex min-h-screen flex-col">
                  <StickyPageLayout
                    id="main"
                    className="strapi-page-slot flex flex-1 flex-col"
                  >
                    {children}
                  </StickyPageLayout>

                  {!liveConsole && <TailwindIndicator />}

                  <Toaster />

                  {!liveConsole && (
                    <div className="strapi-layout-footer">
                      <ErrorBoundary hideFallback>
                        <GlobalFooter
                          locale={locale}
                          footer={footer}
                          legalDocuments={legalRes?.data ?? []}
                        />
                      </ErrorBoundary>
                    </div>
                  )}
                </div>
                {!liveConsole && <EventModal />}
                {!liveConsole && <StaffDrawerMount />}
                {!liveConsole && <EditorialDrawerMount />}
                {betaEnabled() && !liveConsole && (
                  <BetaFeedback label={tUi("feedback")} />
                )}
              </EventModalProvider>
            </ClientProviders>
          </ContactModalProvider>
        </ServerProviders>
      </body>
    </html>
  )
}

/** Keep public-shell links and content consistent between server render and hydration. */
function PublicRuntimeConfig({ nonce }: { nonce?: string }) {
  /**
   * This allows you to make following env variables RUNTIME.
   *
   * Following variables aren't going to be embedded during the build-time. To avoid embedding,
   * you must not use "NEXT_PUBLIC_" prefix for env variable that you want to keep
   * private and dynamic at runtime.
   *
   * Instead, use this method to pass only the required env variables to the client side.
   * To access them from CSR or SSR context, read them using `getEnvVar()` helper.
   *
   * Do not include "STRAPI_URL", we want to keep it private (hence why we use proxying).
   */
  const CSR_ENVs = [
    "NODE_ENV",
    "DEBUG_STRAPI_CLIENT_API_CALLS",
    "SHOW_NON_BLOCKING_ERRORS",
    "APP_PUBLIC_URL",
    "MOBILE_APP_URL",
  ]

  return (
    <Script id="csr-config" strategy="beforeInteractive" nonce={nonce}>
      {`
         window.CSR_CONFIG = window.CSR_CONFIG || {};
         window.CSR_CONFIG = ${JSON.stringify({
           ...CSR_ENVs.reduce(
             (acc, curr) => {
               acc[curr] = process.env?.[curr]

               return acc
             },
             {} as Record<string, string | undefined>
           ),
         })};
       `}
    </Script>
  )
}
