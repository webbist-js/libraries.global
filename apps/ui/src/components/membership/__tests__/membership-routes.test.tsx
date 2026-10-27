import { expect, it, vi } from "vitest"

const { session, redirect, permanentRedirect } = vi.hoisted(() => ({
  session: vi.fn().mockResolvedValue(null),
  redirect: vi.fn(() => {
    throw new Error("sign-in redirect")
  }),
  permanentRedirect: vi.fn(() => {
    throw new Error("pricing redirect")
  }),
}))
vi.mock("@/lib/contribution-session-server", () => ({
  getContributionSession: session,
}))
const translate = (key: string) => key
vi.mock("next-intl/server", () => ({
  getTranslations: async () => translate,
}))
vi.mock("@/lib/navigation", () => ({
  redirect,
  getPathname: ({
    href,
    locale,
  }: {
    href: string | { pathname: string; query?: Record<string, string> }
    locale: string
  }) => {
    const path = typeof href === "string" ? href : href.pathname
    const query =
      typeof href === "string" || !href.query
        ? ""
        : `?${new URLSearchParams(href.query).toString()}`

    return `${locale === "en" ? "" : `/${locale}`}${path}${query}`
  },
}))
vi.mock("next/navigation", () => ({ permanentRedirect }))
vi.mock("@/components/global/GlobalHeader", () => ({ default: () => null }))
vi.mock("@/components/auth/AccountGuard", () => ({ AccountGuard: () => null }))
vi.mock("@/components/ds/PageHero", () => ({ PageHero: () => null }))
vi.mock("@/components/membership/MembershipDashboard", () => ({
  MembershipDashboard: () => null,
}))
vi.mock("@/lib/own-profile-server", () => ({ fetchOwnProfile: vi.fn() }))

import LegacyMembershipPage from "@/app/[locale]/contribute/membership/page"
import MembershipRedirect from "@/app/[locale]/membership/page"
import MembershipPage, {
  generateMetadata,
} from "@/app/[locale]/profile/membership/page"

it("requires an account before rendering private membership state", async () => {
  await expect(
    MembershipPage({ params: Promise.resolve({ locale: "fr" }) })
  ).rejects.toThrow("sign-in redirect")
  expect(redirect).toHaveBeenCalledWith({
    href: "/auth/signin?callbackUrl=/profile/membership",
    locale: "fr",
  })
})
it("keeps membership management out of search indexes", async () => {
  expect((await generateMetadata()).robots).toEqual({
    index: false,
    follow: false,
  })
})
it.each(["en", "fr", "cs"] as const)(
  "keeps old %s account bookmarks and billing return parameters working",
  async (locale) => {
    await expect(
      MembershipRedirect({
        params: Promise.resolve({ locale }),
        searchParams: Promise.resolve({ billing: "return" }),
      })
    ).rejects.toThrow("pricing redirect")
    expect(permanentRedirect).toHaveBeenLastCalledWith(
      `${locale === "en" ? "" : `/${locale}`}/profile/membership?billing=return`
    )
  }
)
it.each(["en", "fr", "cs"] as const)(
  "redirects old %s pricing bookmarks to the corresponding public plans URL",
  async (locale) => {
    await expect(
      LegacyMembershipPage({ params: Promise.resolve({ locale }) })
    ).rejects.toThrow("pricing redirect")
    expect(permanentRedirect).toHaveBeenLastCalledWith(
      `${locale === "en" ? "" : `/${locale}`}/plans`
    )
  }
)
