// @vitest-environment happy-dom
import type * as NextIntl from "next-intl"
import type { AnchorHTMLAttributes } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

vi.mock("next-intl", async (importOriginal) => ({
  ...(await importOriginal<typeof NextIntl>()),
  useLocale: () => "en",
}))
vi.mock("@/lib/navigation", () => ({
  routing: { defaultLocale: "en" },
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}))
import { EmailPreferences } from "../preferences"

const request = vi.fn()
const response = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  })
beforeEach(() => {
  request.mockReset()
  vi.stubGlobal("fetch", request)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe("email action pages", () => {
  it("checks a confirmation link without subscribing, then applies it only on a click", async () => {
    request.mockResolvedValueOnce(
      response({ action: "confirm", purpose: "newsletter" })
    )
    render(<EmailPreferences token="test-token" />)
    await screen.findByRole("button", { name: "Confirm subscription" })
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![1]).not.toHaveProperty("method", "POST")
    request.mockResolvedValueOnce(
      response({ action: "confirm", purpose: "newsletter" })
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Confirm subscription" })
    )
    await screen.findByRole("heading", { name: "You’re subscribed" })
    expect(request.mock.calls[1]![1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ token: "test-token" }),
    })
    expect(
      screen
        .getByRole("link", { name: "Explore the Journal →" })
        .getAttribute("href")
    ).toBe("/journal")
  })
  it("unsubscribes only the named category and keeps a failed change available for retry", async () => {
    const action = { action: "unsubscribe", purpose: "weekly community report" }
    request.mockResolvedValueOnce(response(action))
    render(<EmailPreferences token="test-token" />)
    const button = await screen.findByRole("button", { name: "Unsubscribe" })
    request.mockResolvedValueOnce(response({}, 503))
    fireEvent.click(button)
    await screen.findByText("We couldn’t save this change. Please try again.")
    expect(screen.getByRole("button", { name: "Unsubscribe" })).toBeTruthy()
    request.mockResolvedValueOnce(response(action))
    fireEvent.click(button)
    await screen.findByRole("heading", { name: "You’re unsubscribed" })
    expect(
      screen.getByText(/You won’t receive weekly community report/)
    ).toBeTruthy()
    expect(
      screen.getByText(
        /Your other email settings and in-app notifications are unchanged/
      )
    ).toBeTruthy()
    expect(screen.queryByText("Unsubscribe from all")).toBeNull()
  })
  it("allows retrying a provider failure instead of claiming the link expired", async () => {
    request.mockResolvedValueOnce(response({}, 503))
    render(<EmailPreferences token="test-token" />)
    const retry = await screen.findByRole("button", { name: "Try again" })
    request.mockResolvedValueOnce(
      response({ action: "unsubscribe", purpose: "weekly library digest" })
    )
    fireEvent.click(retry)
    await screen.findByRole("button", { name: "Unsubscribe" })
    expect(request).toHaveBeenCalledTimes(2)
  })
  it("offers safe recovery for an invalid link without applying or inventing subscription choices", async () => {
    request.mockResolvedValueOnce(response({}, 400))
    render(<EmailPreferences token="expired-test-token" />)
    await screen.findByRole("heading", { name: "This link is unavailable" })
    expect(
      screen
        .getByRole("link", { name: "subscribe again from the Journal" })
        .getAttribute("href")
    ).toBe("/journal#journal-dispatch")
    expect(request).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole("button", { name: "Unsubscribe" })).toBeNull()
  })
  it("does not fetch a missing token and ignores results from an abandoned page", async () => {
    const missing = render(<EmailPreferences token="" />)
    await screen.findByRole("heading", { name: "This link is unavailable" })
    expect(request).not.toHaveBeenCalled()
    missing.unmount()
    request.mockImplementation(() => new Promise(() => {}))
    const pending = render(<EmailPreferences token="test-token" />)
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1))
    const signal = request.mock.calls[0]![1].signal as AbortSignal
    pending.unmount()
    expect(signal.aborted).toBe(true)
  })
})
