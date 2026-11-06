// @vitest-environment happy-dom
import { cleanup, render, screen, within } from "@testing-library/react"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, expect, it, vi } from "vitest"

const { translate } = vi.hoisted(() => ({ translate: (key: string) => key }))
vi.mock("next-intl", () => ({ useTranslations: () => translate }))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalHeader", () => ({ default: () => null }))
vi.mock("@/components/dashboard/InformationPage", () => ({
  InformationPage: ({ children }: { children: ReactNode }) => children,
}))
vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
vi.mock("@/components/ds/PageHero", () => ({
  PageHero: ({ title, lead }: { title: string; lead: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{lead}</p>
    </header>
  ),
}))
vi.mock("@/components/page-builder/components/utilities/StrapiLink", () => ({
  getStrapiLinkHref: (link?: { href?: string }) => link?.href ?? null,
}))

import { LegalIndexPage } from "@/components/legal/LegalIndexPage"

import { buildFooterNavigation, type FooterData } from "../footer-navigation"
import { GlobalFooter } from "../GlobalFooter"

const documents = [
  "terms",
  "privacy",
  "cookies",
  "membership",
  "cancellation-refunds",
  "data-licence",
  "ai-statement",
  "accessibility",
  "independence",
  "future-policy",
].map((slug) => ({ documentId: slug, slug, title: slug, navLabel: slug }))
afterEach(cleanup)

it("keeps the footer compact with direct published privacy and accessibility links", () => {
  render(<GlobalFooter locale="en" footer={null} legalDocuments={documents} />)
  const nav = within(
    screen.getByRole("navigation", { name: "legal_documents" })
  )
  expect(
    nav.getAllByRole("link").map((link) => link.getAttribute("href"))
  ).toEqual(["/legal", "/legal/privacy", "/legal/accessibility", "/sponsor"])
  expect(nav.getByRole("link", { name: "sponsor" })).toBeTruthy()
})

it("keeps the fixed sponsor link without CMS footer data or legal documents", () => {
  render(<GlobalFooter locale="en" footer={null} legalDocuments={[]} />)
  expect(
    screen.getByRole("link", { name: "sponsor" }).getAttribute("href")
  ).toBe("/sponsor")
})

it("keeps every published policy reachable from the index, including new CMS documents", () => {
  render(<LegalIndexPage locale="en" documents={documents} />)
  expect(
    screen.getAllByRole("link").map((link) => link.getAttribute("href"))
  ).toEqual(
    expect.arrayContaining(documents.map((doc) => `/legal/${doc.slug}`))
  )
  expect(screen.getByRole("region", { name: "legal_other" })).toBeTruthy()
})

it("never adds a direct footer destination for an unpublished document", () => {
  render(
    <GlobalFooter
      locale="en"
      footer={null}
      legalDocuments={documents.filter((doc) => doc.slug !== "privacy")}
    />
  )
  expect(screen.queryByRole("link", { name: "privacy" })).toBeNull()
  expect(screen.getByRole("link", { name: "legal_policies" })).toBeTruthy()
})

it("shares CMS section and supplemental links with the dashboard while retaining published legal rules", () => {
  const navigation = buildFooterNavigation(
    {
      sections: [
        {
          id: 1,
          title: "Explore",
          links: [{ id: 2, href: "/pro", label: "Membership" }],
        },
      ],
      links: [
        { id: 3, href: "/about", label: "About" },
        { id: 4, href: "/legal/unpublished", label: "Unpublished" },
      ],
    } as unknown as FooterData,
    documents,
    { legal: "Legal policies", plans: "Plans and pricing", sponsor: "Sponsor" }
  )
  expect(navigation.sections[0]?.links).toEqual([
    { key: "2", href: "/pro", label: "Plans and pricing" },
  ])
  expect(navigation.links.map((link) => link.href)).toEqual([
    "/legal",
    "/legal/privacy",
    "/legal/accessibility",
    "/about",
    "/sponsor",
  ])
})

it("does not repeat the sponsor link when the CMS footer already has one", () => {
  const navigation = buildFooterNavigation(
    {
      links: [{ id: 5, href: "/sponsor", label: "Sponsorship" }],
    } as unknown as FooterData,
    [],
    { legal: "Legal policies", plans: "Plans and pricing", sponsor: "Sponsor" }
  )
  expect(navigation.links).toEqual([
    { key: "5", href: "/sponsor", label: "Sponsorship" },
  ])
})
