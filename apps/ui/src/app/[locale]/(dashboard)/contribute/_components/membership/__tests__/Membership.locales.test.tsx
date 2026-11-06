// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, expect, it, vi } from "vitest"

import { LibraryStaffSection } from "../LibraryStaffSection"
import { OfferCards } from "../OfferCards"
import { PlanCompareTable } from "../PlanCompareTable"
import { ProFaq } from "../ProFaq"
import { SupporterMilestone } from "../SupporterMilestone"

import cs from "../../../../../../../../locales/cs.json"
import es from "../../../../../../../../locales/es.json"
import fr from "../../../../../../../../locales/fr.json"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/contact/ContactModalProvider", () => ({
  useContactModal: () => ({ openContact: vi.fn() }),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))
afterEach(cleanup)
it.each([
  {
    locale: "fr" as const,
    messages: fr,
    explorer: "Explorateur",
    api: "Accès API",
  },
  {
    locale: "cs" as const,
    messages: cs,
    explorer: "Průzkumník",
    api: "Přístup k API",
  },
  {
    locale: "es" as const,
    messages: es,
    explorer: "Explorador",
    api: "Acceso a la API",
  },
])(
  "renders the offers, comparison and FAQ in $locale without missing messages",
  ({ locale, messages, explorer, api }) => {
    const errors: Error[] = []
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="UTC"
        onError={(error) => errors.push(error)}
      >
        <OfferCards
          viewer={{
            signedIn: true,
            standing: "contributor",
            isStaff: true,
            hasApi: true,
          }}
        />
        <SupporterMilestone />
        <LibraryStaffSection isStaff />
        <PlanCompareTable />
        <ProFaq />
      </NextIntlClientProvider>
    )
    expect(errors).toEqual([])
    expect(screen.getByRole("heading", { name: explorer })).toBeTruthy()
    expect(screen.getByRole("heading", { name: api })).toBeTruthy()
    expect(screen.queryByText("What’s included")).toBeNull()
    expect(document.body.textContent).not.toMatch(/\bTeam\b|£600/)
  }
)
