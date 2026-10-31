// @vitest-environment happy-dom
import * as React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ContributionJourney } from "@/app/[locale]/(dashboard)/contribute/_components/hub/ContributionJourney"
import { DrivesYouCanHelpWith } from "@/app/[locale]/(dashboard)/contribute/_components/hub/DrivesYouCanHelpWith"
import type { DriveView } from "@/lib/drives/drive-view"
import { cleanup, render, screen, within } from "@/test/render"

Object.assign(globalThis, { React })

vi.mock("@iconify/react", () => ({
  Icon: () => <span aria-hidden />,
}))

vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => (
    <a {...props}>{children}</a>
  ),
}))

afterEach(cleanup)

describe("ContributionJourney", () => {
  it.each([
    { hasClaim: false, isEditor: false, isModerator: false },
    { hasClaim: true, isEditor: false, isModerator: false },
    { hasClaim: false, isEditor: true, isModerator: false },
    { hasClaim: false, isEditor: false, isModerator: true },
    { hasClaim: true, isEditor: true, isModerator: false },
    { hasClaim: true, isEditor: false, isModerator: true },
    { hasClaim: false, isEditor: true, isModerator: true },
    { hasClaim: true, isEditor: true, isModerator: true },
  ])("only offers unheld roles for %j", (roles) => {
    render(<ContributionJourney signedIn {...roles} />)

    expect(
      screen.queryByRole("heading", { name: "Claim your library" }) !== null
    ).toBe(!roles.hasClaim)
    expect(
      screen.queryByRole("heading", { name: "Become an editor" }) !== null
    ).toBe(!roles.isEditor)
    expect(
      screen.queryByRole("heading", { name: "Help moderate" }) !== null
    ).toBe(!roles.isModerator)
    const allHeld = roles.hasClaim && roles.isEditor && roles.isModerator
    expect(
      screen.queryByRole("region", { name: "Take on a role" }) === null
    ).toBe(allHeld)
    expect(
      screen.getByRole("region", { name: "How review works" })
    ).toBeTruthy()
  })

  it("keeps each role’s destination when sign-in is needed", () => {
    render(
      <ContributionJourney
        signedIn={false}
        hasClaim={false}
        isEditor={false}
        isModerator={false}
      />
    )

    const links = within(
      screen.getByRole("region", { name: "Take on a role" })
    ).getAllByRole("link")
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/auth/signin?callbackUrl=%2Fcontribute%2Fclaim",
      "/auth/signin?callbackUrl=%2Fcontribute%2Fknowledge%2Fapply",
      "/auth/signin?callbackUrl=%2Fcontribute%2Fknowledge%2Fapply%3Frole%3Dmoderator",
    ])
  })

  it("separates the review steps from possible outcomes", () => {
    render(<ContributionJourney signedIn hasClaim isEditor isModerator />)

    const review = screen.getByRole("region", { name: "How review works" })
    const steps = review.querySelector("ol")!
    expect(within(steps).getAllByRole("listitem")).toHaveLength(2)
    expect(within(steps).queryByText("Not accepted")).toBeNull()
    expect(
      within(review).getByRole("heading", { name: "After review" })
    ).toBeTruthy()
    expect(
      within(review).getByRole("heading", { name: "Needs changes" })
    ).toBeTruthy()
  })
})

const driveView: DriveView = {
  drive: {
    documentId: "drive-hours",
    slug: "opening-hours",
    title: "Opening hours for every *Californian library*",
    summary: "Help find opening hours.",
    focus: { kind: "gaps", gaps: ["hours"] },
    scope: { places: { country: ["united-states"] } },
    unit: "library",
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2027-01-03T00:00:00.000Z",
    goalPercent: 25,
    status: "open",
    pinned: true,
    featured: false,
    locale: "en",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    steps: [],
  },
  href: "/community/drives/opening-hours",
  place: "California, United States",
  source: null,
  progress: {
    total: 1237,
    done: 0,
    todo: 1237,
    inReview: 0,
    percent: 0,
    goalMet: false,
  },
  helpers: 0,
}

describe("DrivesYouCanHelpWith", () => {
  it("keeps the drive destination and real progress, with a first-helper prompt", () => {
    render(<DrivesYouCanHelpWith views={[driveView]} />)

    expect(
      screen
        .getByRole("link", {
          name: "Opening hours for every Californian library",
        })
        .getAttribute("href")
    ).toBe(driveView.href)
    expect(
      screen.getByText("of 1,237 libraries", { exact: false })
    ).toBeTruthy()
    expect(screen.getByText("Be the first to help")).toBeTruthy()
    expect(screen.queryByText("184")).toBeNull()
  })

  it("doesn’t turn missing counts into zero progress or a first-helper claim", () => {
    render(
      <DrivesYouCanHelpWith
        views={[{ ...driveView, progress: null, helpers: null }]}
      />
    )

    expect(screen.getByText("Not counted yet")).toBeTruthy()
    expect(screen.queryByText("Be the first to help")).toBeNull()
    expect(screen.queryByText(/of 1,237/)).toBeNull()
  })

  it("omits an empty opportunities panel", () => {
    const { container } = render(<DrivesYouCanHelpWith views={[]} />)
    expect(container.textContent).toBe("")
  })
})
