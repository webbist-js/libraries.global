// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import type { AnchorHTMLAttributes, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { HOMEPAGE_DEFAULTS } from "@/components/home/homepage.content"
import { ClosingSection } from "@/components/home/sections/ClosingSection"
import { FeaturedLibrariesSection } from "@/components/home/sections/FeaturedLibrariesSection"
import { LibraryStaffSection } from "@/components/home/sections/LibraryStaffSection"
import { installAnalyticsClickTracking } from "@/lib/analytics-events"
import { installGoogleAnalytics } from "@/lib/google-analytics"
import type { PopulatedFeaturedLibraryData } from "@/lib/strapi-api/content/server"

import messages from "../../../../locales/en.json"

vi.mock("@/lib/access-client", () => ({
  useHydratedSession: () => ({ data: null, isPending: false, error: null }),
}))

vi.mock("@/components/home/PillarCarousel", () => ({
  PillarCarousel: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))
vi.mock("@/components/ui/carousel", () => ({
  CarouselItem: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
}))

vi.mock("@/components/global/GlobalLink", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props} onClick={(event) => event.preventDefault()} />
  ),
}))

let remove: (() => void) | undefined
afterEach(() => {
  remove?.()
  cleanup()
  delete window.librariesGlobalAnalytics
  delete window.gtag
  delete window.dataLayer
  vi.restoreAllMocks()
})

describe("homepage plan links after the pricing section moves", () => {
  it("retains home_plans attribution exactly once per click, with consent and without private URL data", () => {
    window.location.href = "https://libraries.global/?q=PRIVATE_QUERY"
    vi.spyOn(document.head, "append").mockImplementation(() => {})
    const controller = installGoogleAnalytics(window)!
    remove = installAnalyticsClickTracking(window)
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <ClosingSection
          band={HOMEPAGE_DEFAULTS.finalCta}
          trustItems={[]}
          openLinks={[]}
          plansIntro={HOMEPAGE_DEFAULTS.plansIntro}
        />
        <LibraryStaffSection band={HOMEPAGE_DEFAULTS.libraryBand} tools={[]} />
      </NextIntlClientProvider>
    )
    const plans = screen.getByRole("link", { name: /^Plans$/ })
    const teams = screen.getByRole("link", {
      name: /^Explore Teams$/,
    })
    const interests = () =>
      window
        .dataLayer!.filter(
          (item) => (item as { event?: string }).event === "lg_analytics"
        )
        .map(
          (item) =>
            (
              item as {
                analytics: {
                  event_name: string
                  interaction_source: string
                  action_type: string
                }
              }
            ).analytics
        )
        .filter((event) => event.event_name === "membership_interest")
    fireEvent.click(plans)
    expect(interests()).toHaveLength(0)
    controller.setConsent(true)
    fireEvent.click(plans)
    fireEvent.click(teams)
    expect(interests()).toHaveLength(2)
    expect(
      interests().every(
        (event) =>
          event.interaction_source === "home_plans" &&
          event.action_type === "compare"
      )
    ).toBe(true)
    expect(JSON.stringify(interests())).not.toContain("PRIVATE_")
    controller.setConsent(false)
    fireEvent.click(plans)
    expect(interests()).toHaveLength(2)
  })
})

describe("restored pillar institution cards", () => {
  it("retains library selection attribution exactly once through the shared card", () => {
    const track = vi.fn()
    window.librariesGlobalAnalytics = {
      track,
    } as unknown as Window["librariesGlobalAnalytics"]
    remove = installAnalyticsClickTracking(window)
    render(
      <FeaturedLibrariesSection
        intro={{ title: "Libraries worth knowing" }}
        libraries={[
          {
            documentId: "published-library",
            name: "Example Library",
            summary: "A place to read.",
            slug: "example-library",
            continent: { slug: "europe" },
            country: { slug: "england" },
            region: { slug: "london" },
          } as PopulatedFeaturedLibraryData,
        ]}
      />
    )
    const card = screen
      .getByRole("heading", { name: "Example Library" })
      .closest("a")!
    expect(card.getAttribute("href")).toBe(
      "/europe/england/london/example-library"
    )
    fireEvent.click(card)
    expect(track.mock.calls).toEqual([
      [
        "select_content",
        {
          interaction_source: "home",
          content_type: "library",
          library_document_id: "published-library",
          view_mode: "grid",
        },
      ],
    ])
  })
})
