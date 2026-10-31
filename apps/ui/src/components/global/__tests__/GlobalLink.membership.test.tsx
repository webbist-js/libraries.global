// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, expect, it, vi } from "vitest"

import GlobalLink from "@/components/global/GlobalLink"
import { cleanup, render, screen } from "@/test/render"

vi.mock("@/lib/navigation", () => ({
  Link: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
  formatHref: (href: string) => href,
  isAppLink: (href: string) => href.startsWith("/"),
}))
afterEach(cleanup)

it.each([
  "/contribute/membership",
  "/fr/contribute/membership#recognition",
  "/plans",
])("keeps the actual membership or pricing destination: %s", (href) => {
  render(<GlobalLink href={href}>Membership</GlobalLink>)
  expect(
    screen.getByRole("link", { name: "Membership" }).getAttribute("href")
  ).toBe(href)
})
