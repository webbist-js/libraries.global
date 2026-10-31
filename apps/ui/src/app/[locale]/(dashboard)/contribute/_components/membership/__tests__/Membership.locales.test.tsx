// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { afterEach, expect, it, vi } from "vitest"

import { FreePlansCard } from "../FreePlansCard"
import { LibraryStaffSection } from "../LibraryStaffSection"
import { MembershipPlans } from "../MembershipPlans"
import { PlanCompareTable } from "../PlanCompareTable"
import { ProFaq } from "../ProFaq"
import { ProFreeRoutes } from "../ProFreeRoutes"

import cs from "../../../../../../../../locales/cs.json"
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
    free: "Compte gratuit",
    question: "Puis-je annuler ?",
  },
  {
    locale: "cs" as const,
    messages: cs,
    free: "Bezplatný účet",
    question: "Mohu členství zrušit?",
  },
])(
  "renders membership content and plan lists in $locale without missing messages",
  ({ locale, messages, free, question }) => {
    const errors: Error[] = []
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        timeZone="UTC"
        onError={(error) => errors.push(error)}
      >
        <FreePlansCard signedIn={false} />
        <LibraryStaffSection isStaff />
        <MembershipPlans currentPlan="free" />
        <PlanCompareTable />
        <ProFreeRoutes />
        <ProFaq />
      </NextIntlClientProvider>
    )
    expect(errors).toEqual([])
    expect(screen.getByRole("heading", { name: free })).toBeTruthy()
    expect(screen.getByText(question)).toBeTruthy()
    expect(screen.queryByText("Included now")).toBeNull()
    if (locale === "cs") expect(screen.queryByText("Questions")).toBeNull()
    expect(screen.queryByText("Free Pro automatically")).toBeNull()
  }
)
