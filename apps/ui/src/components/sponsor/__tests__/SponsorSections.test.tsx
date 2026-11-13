// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import cs from "../../../../locales/cs"
import en from "../../../../locales/en"
import es from "../../../../locales/es"
import fr from "../../../../locales/fr"
import {
  SponsorAcknowledgementList,
  SponsorEnquiry,
  SponsorProgrammes,
  SponsorRecognition,
} from "../SponsorSections"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Test stand-in for next/image.
    <img alt={alt} src={src} />
  ),
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))
afterEach(cleanup)

function renderIn(
  locale: "en" | "fr" | "cs" | "es",
  messages: Record<string, unknown>,
  children: ReactNode
) {
  const errors: Error[] = []
  render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
      onError={(error) => errors.push(error)}
    >
      {children}
    </NextIntlClientProvider>
  )

  return errors
}

describe("sponsor page sections", () => {
  it.each([
    { locale: "en" as const, messages: en },
    { locale: "fr" as const, messages: fr },
    { locale: "cs" as const, messages: cs },
    { locale: "es" as const, messages: es },
  ])("render in $locale without missing messages", ({ locale, messages }) => {
    const errors = renderIn(
      locale,
      messages,
      <>
        <SponsorProgrammes />
        <SponsorRecognition />
        <SponsorAcknowledgementList
          acknowledgements={{ status: "ok", sponsors: [] }}
        />
        <SponsorEnquiry />
      </>
    )
    expect(errors).toEqual([])
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(5)
  })

  it("invites a conversation instead of listing amounts, and keeps the API offer separate", () => {
    renderIn(
      "en",
      en,
      <>
        <SponsorRecognition />
        <SponsorEnquiry />
      </>
    )
    expect(document.body.textContent).not.toMatch(/£2,500|£5,000|£10,000/)
    expect(
      screen
        .getByRole("link", { name: "info@libraries.global" })
        .getAttribute("href")
    ).toBe("mailto:info@libraries.global")
    expect(
      screen.getByRole("link", { name: "developers page" }).getAttribute("href")
    ).toBe("/developers")
    expect(screen.getByText(/£100 a month/)).toBeTruthy()
    const enquiry = screen.getByRole("link", {
      name: "Talk to us about sponsorship",
    })
    expect(enquiry.dataset.contactType).toBe("sponsorship")
    expect(enquiry.getAttribute("href")).toBe(
      "mailto:info@libraries.global?subject=Sponsorship%20enquiry"
    )
  })

  it("lists consented sponsors with logo alt text and sponsored links", () => {
    renderIn(
      "en",
      en,
      <SponsorAcknowledgementList
        acknowledgements={{
          status: "ok",
          sponsors: [
            {
              name: "Northfield Trust",
              tier: "founding",
              website: "https://example.org/",
              acknowledgement: "Funds translation.",
              logo: {
                url: "https://cdn.example.org/n.png",
                alternativeText: "Logo",
                width: 320,
                height: 120,
              },
            },
          ],
        }}
      />
    )
    const list = within(screen.getByRole("list"))
    expect(list.getByRole("img", { name: "Northfield Trust" })).toBeTruthy()
    expect(
      list.getByRole("link", { name: "Northfield Trust" }).getAttribute("rel")
    ).toContain("nofollow")
    expect(list.getByText("Founding Sponsor")).toBeTruthy()
  })

  it("keeps the page usable when the list is empty or unavailable", () => {
    renderIn(
      "en",
      en,
      <SponsorAcknowledgementList
        acknowledgements={{ status: "ok", sponsors: [] }}
      />
    )
    expect(screen.getByText("No sponsors are listed yet.")).toBeTruthy()
    cleanup()
    renderIn(
      "en",
      en,
      <SponsorAcknowledgementList
        acknowledgements={{ status: "unavailable", sponsors: [] }}
      />
    )
    expect(screen.getByRole("status").textContent).toContain(
      "The sponsor list isn’t available right now."
    )
  })
})
