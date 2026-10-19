// @vitest-environment happy-dom
import type { AnchorHTMLAttributes } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { UserProfile } from "@/lib/types/profile"
import { cleanup, render, screen } from "@/test/render"

import { ProfileHero } from "../ProfileHero"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({ usePathname: () => "/profile/reader" }))
vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}))
vi.mock("../ProfileFollowButton", () => ({ ProfileFollowButton: () => null }))

afterEach(cleanup)

const profile: UserProfile = {
  id: 1,
  username: "reader",
  firstName: "Library",
  lastName: "Reader",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  profileVisibility: "public",
  isVerifiedLibrarian: false,
  notifPrefs: {
    weeklyDigest: false,
    editsReviewed: false,
    newFollowers: false,
    editorialMessages: false,
    soundOn: false,
    marketing: false,
  },
  // Older profiles can still carry a cover; it must not affect the header.
  coverImage: { id: 2, url: "/legacy-cover.webp" },
}

describe("profile header appearance", () => {
  it.each(["amber", "mint"] as const)(
    "keeps the standard header with a %s initials avatar",
    (colour) => {
      const { container } = render(
        <ProfileHero
          profile={{ ...profile, profileBackground: colour }}
          isOwnProfile
          isSignedIn
        />
      )
      expect(container.querySelector("section")?.style.background).toBe(
        "var(--t-bg-space)"
      )
      expect(screen.getByText("LR").parentElement?.style.background).toBe(
        `var(--t-palette-${colour}-bg)`
      )
      expect(container.querySelector("img")).toBeNull()
    }
  )

  it("shows the uploaded avatar in place of the colour and initials", () => {
    const { container } = render(
      <ProfileHero
        profile={{
          ...profile,
          profileBackground: "amber",
          avatar: { id: 3, url: "/avatar.webp" },
        }}
        isOwnProfile
        isSignedIn
      />
    )
    const image = container.querySelector("img")!
    expect(image.getAttribute("src")).toBe("/avatar.webp")
    expect(image.parentElement?.style.background).toBe("transparent")
    expect(screen.queryByText("LR")).toBeNull()
  })
})
