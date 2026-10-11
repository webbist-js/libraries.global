// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const session = vi.hoisted(() => ({
  data: null as null | { user: { id: string } },
}))
vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: session.data, isPending: false }) },
}))
vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
const { PlaceContributionCard } = await import("../PlaceContributionCard")
const { aggregateContributionGaps, featuredPlaceTask } =
  await import("../place-contribution.logic")
const base = {
  name: "Europe",
  level: "continent" as const,
  place: { continent: "europe" },
  childNoun: "country",
  childPlaces: [
    { name: "Greece", slug: "greece", libraryCount: 0 },
    { name: "France", slug: "france", libraryCount: 12 },
  ],
  initialChildSlug: "greece",
}
afterEach(() => {
  cleanup()
  session.data = null
})

describe("place contribution invitation", () => {
  it("updates the invitation and destination before navigating, without claiming populated countries are empty", () => {
    render(<PlaceContributionCard {...base} />)
    expect(
      screen
        .getByRole("link", { name: "Add a library in Greece" })
        .getAttribute("href")
    ).toBe("/contribute/index/new?continent=europe&country=greece")
    fireEvent.click(
      screen.getByRole("button", { name: "Choose another country" })
    )
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "france" },
    })
    expect(
      screen.getByRole("heading", {
        name: "Put a library in France on the map.",
      })
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Add a library in France" })
        .getAttribute("href")
    ).toContain("country=france")
    expect(screen.queryByText(/haven’t documented/)).toBeNull()
    expect(screen.getByText(/A free account is needed/)).toBeTruthy()
  })

  it("combines gaps across types, omits the featured task and hides confirmed zero gaps", () => {
    const gaps = [
      {
        key: "hours",
        label: "Public: Opening hours",
        missing: 800,
        eligible: 900,
        type: "Public",
      },
      {
        key: "hours",
        label: "Academic: Opening hours",
        missing: 484,
        eligible: 600,
        type: "Academic",
      },
      { key: "accessibility", label: "Access", missing: 902, eligible: 1500 },
      { key: "photo", label: "Photo", missing: 0, eligible: 1500 },
    ]
    render(
      <PlaceContributionCard
        {...base}
        initialChildSlug={undefined}
        childPlaces={[]}
        name="Bavaria"
        level="region"
        place={{ country: "germany", region: "bavaria" }}
        gaps={gaps}
      />
    )
    const action = screen.getByRole("link", {
      name: "Find libraries missing hours",
    })
    expect(action.getAttribute("href")).toBe(
      "/libraries?country=germany&region=bavaria&needs=hours"
    )
    expect(screen.getByText(/1,284 libraries in Bavaria/)).toBeTruthy()
    expect(screen.queryByText("Add opening hours")).toBeNull()
    expect(screen.queryByText("Share a photo")).toBeNull()
    expect(aggregateContributionGaps(gaps)[0]?.missing).toBe(1284)
  })

  it("keeps unknown counts out of the copy and explains actual form requirements", () => {
    session.data = { user: { id: "one" } }
    render(
      <PlaceContributionCard
        {...base}
        gaps={[{ key: "hours", label: "Hours", missing: 12, eligible: 20 }]}
      />
    )
    expect(
      screen.getByText("Choose from libraries in Europe without a photo")
    ).toBeTruthy()
    expect(
      screen
        .getByRole("link", { name: "Your submissions" })
        .getAttribute("href")
    ).toBe("/contribute/submissions")
    expect(screen.queryByText(/A free account is needed/)).toBeNull()
    fireEvent.click(screen.getByText("What do I need?"))
    expect(screen.getByText(/name, type, operational status/)).toBeTruthy()
  })

  it("updates a region gap destination without reusing the original region’s count", () => {
    render(
      <PlaceContributionCard
        {...base}
        name="Bavaria"
        level="region"
        place={{ country: "germany", region: "bavaria" }}
        childPlaces={[]}
        initialChildSlug={undefined}
        siblings={[
          { name: "Bavaria", slug: "bavaria" },
          { name: "Saxony", slug: "saxony" },
        ]}
        gaps={[{ key: "hours", label: "Hours", missing: 1284, eligible: 1500 }]}
      />
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Choose another region" })
    )
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "saxony" },
    })
    expect(
      screen
        .getByRole("link", { name: "Find libraries missing hours" })
        .getAttribute("href")
    ).toContain("region=saxony")
    expect(screen.queryByText(/1,284/)).toBeNull()
  })

  it("uses the real drive route and deadline ahead of ordinary record gaps", () => {
    const drive = {
      title: "Mobile libraries drive",
      summary: "Help document access aboard mobile libraries.",
      href: "/community/drives/mobile-libraries",
      endsAt: "2026-11-30T23:59:59Z",
      here: 12,
      gapKeys: ["accessibility"],
    }
    const ask = featuredPlaceTask({
      name: "Europe",
      place: base.place,
      childLevel: "country",
      drive,
      gaps: [{ key: "photo", missing: 100, eligible: 100 }],
    })
    expect(ask.kind).toBe("drive")
    render(
      <PlaceContributionCard
        {...base}
        initialChildSlug={undefined}
        drive={drive}
      />
    )
    expect(
      screen
        .getByRole("link", { name: "Help with this drive" })
        .getAttribute("href")
    ).toBe(`${drive.href}?continent=europe`)
    expect(screen.getByText("Community drive · until 30 November")).toBeTruthy()
    expect(screen.queryByText("Answer an accessibility question")).toBeNull()
  })
})

it("keeps the drive when a country is selected and updates its destination", () => {
  const drive = {
    title: "Mobile libraries drive",
    summary: "Help with access details.",
    href: "/community/drives/mobile-libraries",
    endsAt: "2026-11-30T23:59:59Z",
    here: 12,
    gapKeys: ["accessibility"],
  }
  render(
    <PlaceContributionCard
      {...base}
      initialChildSlug={undefined}
      childPlaces={[
        { name: "France", slug: "france", libraryCount: 12 },
        { name: "Germany", slug: "germany", libraryCount: 50 },
      ]}
      drive={drive}
    />
  )
  fireEvent.click(
    screen.getByRole("button", { name: "Choose the country now" })
  )
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "germany" },
  })
  expect(
    screen
      .getByRole("link", { name: "Help with this drive in Germany" })
      .getAttribute("href")
  ).toBe("/community/drives/mobile-libraries?continent=europe&country=germany")
  expect(screen.queryByRole("link", { name: /Add a library/ })).toBeNull()
})
