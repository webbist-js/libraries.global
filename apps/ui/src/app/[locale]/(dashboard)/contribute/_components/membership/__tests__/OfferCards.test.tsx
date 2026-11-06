// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { heldOffers } from "@/lib/plans"
import { cleanup, render, screen, within } from "@/test/render"

import { OfferCards } from "../OfferCards"

vi.mock("@iconify/react", () => ({ Icon: () => null }))

afterEach(cleanup)

const guest = {
  signedIn: false,
  standing: "public",
  isStaff: false,
  hasApi: false,
}

it("shows the five offers with prices from the pricing file", () => {
  render(<OfferCards viewer={guest} />)
  for (const name of [
    "Explorer",
    "Contributor",
    "Verified Staff",
    "API Access",
    "Sponsor",
  ])
    expect(screen.getByRole("heading", { name })).toBeTruthy()
  expect(screen.getByText("£100 a month")).toBeTruthy()
  // Sponsorship is a conversation: no amount, and the button opens the
  // sponsorship contact form.
  expect(screen.getByText("By arrangement")).toBeTruthy()
  const talk = screen.getByRole("link", {
    name: /Talk to us about sponsorship/,
  })
  expect(talk.dataset.contactType).toBe("sponsorship")
  expect(talk.getAttribute("href")).toMatch(/^mailto:info@libraries\.global/)
  expect(
    screen.getByRole("link", { name: "About sponsorship" }).getAttribute("href")
  ).toBe("/sponsor")
  expect(document.body.textContent).not.toMatch(
    /£[358](?![\d,])|£600|£2,500|£5,000|£10,000|seat price/
  )
  expect(
    screen
      .getByRole("link", { name: /Create a free account/ })
      .getAttribute("href")
  ).toBe("/auth/register?callbackUrl=/plans")
})

it("marks what a signed-in viewer already has and drops sign-up prompts", () => {
  render(
    <OfferCards
      viewer={{
        signedIn: true,
        standing: "supporter",
        isStaff: true,
        hasApi: false,
      }}
    />
  )
  expect(
    screen.queryByRole("link", { name: /Create a free account/ })
  ).toBeNull()
  expect(screen.getAllByText("You have this")).toHaveLength(3)
  const staff = within(document.getElementById("offer-staff")!)
  expect(
    staff
      .getByRole("link", { name: /Open the staff area/ })
      .getAttribute("href")
  ).toBe("/staff")
  const api = within(document.getElementById("offer-api")!)
  expect(
    api.getByRole("link", { name: /Go to Developers/ }).getAttribute("href")
  ).toBe("/developers")
})

it("never treats payment as recognition or staff authority", () => {
  expect([...heldOffers({ ...guest, signedIn: true, hasApi: true })]).toEqual([
    "explorer",
    "api",
  ])
})
