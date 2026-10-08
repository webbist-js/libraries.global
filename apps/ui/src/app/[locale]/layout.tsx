import "@/styles/globals.css"

import type { Metadata } from "next"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import Script from "next/script"
import type { Locale } from "next-intl"
import { setRequestLocale } from "next-intl/server"

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
import { debugStaticParams } from "@/lib/build"
import { fontFigtree, fontJetBrainsMono, fontNewsreader } from "@/lib/fonts"
import { routing } from "@/lib/navigation"
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  getSiteUrl,
  SITE_NAME,
  TWITTER_SITE,
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
  robots: { index: true, follow: true },
  openGraph: {
    siteName: SITE_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    site: TWITTER_SITE,
  },
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale }
  const requestHeaders = await headers()
  const liveConsole = requestHeaders.get("x-live-console") === "true"
  const nonce = requestHeaders.get("x-nonce") ?? undefined
  const [footerRes, legalRes] = await Promise.all([
    liveConsole ? Promise.resolve(null) : fetchFooter(locale),
    liveConsole
      ? Promise.resolve(null)
      : fetchLegalDocuments(locale, "published"),
  ])
  const footer = footerRes?.data

  // Enable static rendering
  // https://next-intl-docs.vercel.app/docs/getting-started/app-router/with-i18n-routing#static-rendering
  setRequestLocale(locale)

  if (!routing.locales.includes(locale)) {
    notFound()
  }

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
  ]

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
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
          Skip to main content
        </a>
        {!liveConsole && <TrackingScripts />}
        <ServerProviders>
          {!liveConsole && <StrapiPreviewListener />}
          <ClientProviders nonce={nonce}>
            <EventModalProvider>
              <div className="relative flex min-h-screen flex-col">
                <div
                  id="main"
                  className="strapi-page-slot flex flex-1 flex-col"
                >
                  {children}
                </div>

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
            </EventModalProvider>
          </ClientProviders>
        </ServerProviders>
      </body>
    </html>
  )
}
