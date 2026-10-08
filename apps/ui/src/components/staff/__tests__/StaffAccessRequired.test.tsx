// @vitest-environment happy-dom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", async () => {
  const { createElement } = await import("react")

  return {
    Link: ({
      href,
      children,
      ...props
    }: {
      href: string
      children: React.ReactNode
    }) => createElement("a", { href, ...props }, children),
  }
})
vi.mock("@/lib/env-vars", () => ({ getEnvVar: () => {} }))

import { StaffAccessRequired } from "../StaffAccessRequired"

const library = {
  documentId: "library-internal-id",
  name: "Central Library",
  slug: "central-library",
  entityRef: "europe:united-kingdom:kent:maidstone:central-library",
  path: "/europe/united-kingdom/kent/central-library",
}
afterEach(cleanup)

describe("staff access page", () => {
  it("offers a pre-filled claim to a signed-in visitor", () => {
    render(<StaffAccessRequired library={library} signedIn />)
    expect(
      screen.getByRole("heading", { name: "Do you work here?" })
    ).toBeTruthy()
    const claim = new URL(
      screen
        .getByRole("link", { name: "Claim this library" })
        .getAttribute("href")!,
      "https://libraries.example"
    )
    expect(claim.pathname).toBe("/contribute/claim")
    expect(claim.searchParams.get("librarySlug")).toBe(library.slug)
    expect(claim.searchParams.get("libraryDocumentId")).toBe(library.documentId)
    expect(claim.searchParams.get("libraryEntityRef")).toBe(library.entityRef)
    expect(
      screen
        .getByRole("link", { name: "View the public library page" })
        .getAttribute("href")
    ).toBe(library.path)
    expect(screen.queryByRole("navigation", { name: "Staff area" })).toBeNull()
    expect(screen.getByText(/A moderator checks your claim/)).toBeTruthy()
  })

  it("sends a signed-out visitor through sign-in and preserves their staff deep link", () => {
    render(
      <StaffAccessRequired
        library={library}
        returnTo="/staff/central-library/edit?step=hours"
      />
    )
    const claim = new URL(
      screen
        .getByRole("link", { name: "Claim this library" })
        .getAttribute("href")!,
      "https://libraries.example"
    )
    expect(claim.pathname).toBe("/auth/signin")
    expect(claim.searchParams.get("callbackUrl")).toContain(
      "/contribute/claim?librarySlug=central-library"
    )
    const signIn = new URL(
      screen
        .getByRole("link", { name: "Sign in to your staff account" })
        .getAttribute("href")!,
      "https://libraries.example"
    )
    expect(signIn.searchParams.get("callbackUrl")).toBe(
      "/staff/central-library/edit?step=hours"
    )
  })
})
