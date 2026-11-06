// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen, within } from "@/test/render"

import { heldOffers, OfferCards } from "../OfferCards"

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
  expect(screen.getByText("From £2,500 a year")).toBeTruthy()
  expect(document.body.textContent).not.toMatch(
    /£[358](?![\d,])|£600|seat price/
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
