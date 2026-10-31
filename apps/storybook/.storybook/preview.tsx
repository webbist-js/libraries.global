import "./preview.css"
import { AppearanceProvider } from "@/components/appearance/AppearanceProvider"
import { ContactModalProvider } from "@/components/contact/ContactModalProvider"
import {
  isAppearancePreference,
  type AppearancePreference,
} from "@/lib/appearance"
import { addCollection, disableCache } from "@iconify/react"
import icons from "@iconify-json/mdi/icons.json"
import {
  DocsContainer,
  type DocsContainerProps,
} from "@storybook/addon-docs/blocks"
import type { Preview } from "@storybook/nextjs-vite"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { NextIntlClientProvider } from "next-intl"
import { useState, useSyncExternalStore, type ReactNode } from "react"
import { useGlobals } from "storybook/preview-api"
import { themes } from "storybook/theming"

import { resetAsyncStories } from "./AsyncStory"
import { setFixtureLocale } from "./fixture-locale"
import { respondToFixture, type FixtureResponses } from "./fixture-responses"
import { FixtureSessionProvider, type FixtureSession } from "./FixtureSession"
import { resetServerFixtures } from "./server-fixtures"

import cs from "../../ui/locales/cs.json"
import en from "../../ui/locales/en.json"
import fr from "../../ui/locales/fr.json"

disableCache("all")
addCollection(icons)
const messages = { en, cs, fr }
function embeddedDocsRoot(): HTMLElement | null {
  // Only preset Doc-block iframes inherit their host's theme. Canvas keeps globals.
  if (!window.frameElement?.id.startsWith("iframe--")) return null

  return window.parent.document.querySelector("#storybook-docs")
    ? window.parent.document.documentElement
    : null
}
function Providers({
  children,
  locale,
  appearance,
  onAppearanceChange,
  session,
}: {
  children: ReactNode
  session?: FixtureSession
  locale: keyof typeof messages
  appearance: AppearancePreference
  onAppearanceChange: (value: AppearancePreference) => void
}) {
  const docsRoot = embeddedDocsRoot()
  const inheritedDark = useSyncExternalStore(
    (listener) => {
      if (!docsRoot) return () => {}
      const observer = new MutationObserver(listener)
      observer.observe(docsRoot, {
        attributes: true,
        attributeFilter: ["class"],
      })

      return () => observer.disconnect()
    },
    () => docsRoot?.classList.contains("dark") ?? false,
    () => false
  )
  // One query client belongs to this mounted story and is never replaced.
  // eslint-disable-next-line react/hook-use-state
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: Infinity,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      })
  )

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      timeZone="Europe/London"
      now={new Date("2026-01-15T12:00:00Z")}
    >
      <AppearanceProvider
        storageKey="storybook-appearance-v1"
        preference={
          docsRoot && appearance !== "system"
            ? inheritedDark
              ? "dark"
              : "light"
            : appearance
        }
        onPreferenceChange={onAppearanceChange}
      >
        <FixtureSessionProvider session={session}>
          <QueryClientProvider client={client}>
            <ContactModalProvider>{children}</ContactModalProvider>
          </QueryClientProvider>
        </FixtureSessionProvider>
      </AppearanceProvider>
    </NextIntlClientProvider>
  )
}
function subscribeAppearance(listener: () => void) {
  const observer = new MutationObserver(listener)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  })

  return () => observer.disconnect()
}
function AppearanceDocs(props: DocsContainerProps) {
  const dark = useSyncExternalStore(
    subscribeAppearance,
    () => document.documentElement.classList.contains("dark"),
    () => false
  )

  return <DocsContainer {...props} theme={dark ? themes.dark : themes.light} />
}
const preview: Preview = {
  tags: ["autodocs"],
  beforeEach: (context) => {
    resetAsyncStories()
    resetServerFixtures()
    const serverResponses = Object.fromEntries(
      Object.entries({
        "auth.getSessionSSR": context.parameters.fixtureSession ?? null,
        "auth.hasPasswordSignIn": false,
        "profile.fetchOwnProfile": context.parameters.fixtureProfile ?? null,
        "profile.readOwnProfile": context.parameters.fixtureProfile
          ? { ok: true, profile: context.parameters.fixtureProfile }
          : { ok: false, reason: "not_found" },
        "profile.fetchOwnProfileSnippet":
          context.parameters.fixtureProfileSnippet ?? null,
        ...context.parameters.serverFixtures,
      }).map(([name, body]) => [
        `POST /__storybook/server/${encodeURIComponent(name)}`,
        { body },
      ])
    )

    const originalFetch = globalThis.fetch
    globalThis.fetch = async (input, init) => {
      const response = await respondToFixture(input, init, {
        ...serverResponses,
        ...context.parameters.fixtureResponses,
      } as FixtureResponses)
      if (response) return response
      const url = new URL(
        input instanceof Request ? input.url : String(input),
        window.location.href
      )
      if (
        [
          "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
          "https://basemaps.cartocdn.com/gl/voyager-nolabels-gl-style/style.json",
        ].includes(url.href)
      )
        return originalFetch(
          new URL("/maps/synthetic-style.json", window.location.href)
        )
      if (
        url.origin !== window.location.origin ||
        /^\/(?:api|__storybook)(?:\/|$)/.test(url.pathname)
      ) {
        throw new Error(
          `Storybook blocked an unmocked service request: ${url.pathname}`
        )
      }

      return originalFetch(input, init)
    }

    return () => {
      globalThis.fetch = originalFetch
    }
  },
  initialGlobals: {
    locale: "en",
    appearance:
      import.meta.env.STORYBOOK_APPEARANCE === "dark" ? "dark" : "light",
  },
  globalTypes: {
    appearance: {
      description: "Interface appearance (real app tokens)",
      toolbar: {
        icon: "paintbrush",
        dynamicTitle: true,
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "system", title: "System" },
        ],
      },
    },
    locale: {
      description: "UI language",
      toolbar: {
        icon: "globe",
        items: [
          { value: "en", title: "English" },
          { value: "cs", title: "Čeština" },
          { value: "fr", title: "Français" },
        ],
      },
    },
  },
  decorators: [
    (Story, context) => {
      const [, updateGlobals] = useGlobals()
      const appearance = isAppearancePreference(context.globals.appearance)
        ? context.globals.appearance
        : "light"
      const selected = context.globals.locale as keyof typeof messages
      const locale = selected in messages ? selected : "en"
      setFixtureLocale(locale)

      return (
        <Providers
          key={`${context.id}:${locale}`}
          locale={locale}
          session={
            context.parameters.fixtureSession as FixtureSession | undefined
          }
          appearance={appearance}
          onAppearanceChange={(value) => updateGlobals({ appearance: value })}
        >
          <Story />
        </Providers>
      )
    },
  ],
  parameters: {
    docs: { container: AppearanceDocs },
    react: { rsc: false },
    layout: "padded",
    nextjs: { appDirectory: true },
    controls: {
      expanded: true,
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    a11y: { test: "error" },
    options: {
      storySort: {
        order: [
          "Start here",
          "Foundations",
          "Primitives",
          "Patterns",
          "Features",
        ],
      },
    },
  },
}

export default preview
