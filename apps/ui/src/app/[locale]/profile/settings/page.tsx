import type { Metadata } from "next"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import type { Locale } from "next-intl"

import { PageHero } from "@/components/ds"
import GlobalHeader from "@/components/global/GlobalHeader"
import { getSessionSSR } from "@/lib/auth-server"
import { avatarSrc } from "@/lib/avatar"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { fetchOwnProfile } from "@/lib/own-profile-server"

import { SettingsShell } from "./_components/SettingsShell"

export const metadata: Metadata = {
  title: "Profile settings",
  robots: { index: false, follow: false },
}

export default async function ProfileSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const [{ locale }, hdrs] = await Promise.all([params, headers()])

  const session = await getSessionSSR(hdrs)

  if (!session?.user) redirect("/auth/signin?callbackUrl=/profile/settings")

  // Owner view through the bridge: `baUserId` is private, so the public
  // REST filter on it can't find the profile.
  const profile = await fetchOwnProfile(session.user)
  const username = profile?.username ?? null
  // The title reads `*italic*` markup, so a name can't add its own.
  const name = (
    profile?.firstName ||
    session.user.name?.split(" ")[0] ||
    "there"
  ).replaceAll("*", "")

  return (
    <>
      <GlobalHeader locale={locale as Locale} />
      <div
        className="relative isolate flex min-h-screen w-full flex-col"
        style={{ background: T.bg.void, color: T.ink.base }}
      >
        <PageHero
          compact
          breadcrumb={[
            { label: "Home", href: "/" },
            ...(username
              ? [{ label: `@${username}`, href: `/profile/${username}` }]
              : []),
            { label: "Settings" },
          ]}
          eyebrow="Account settings"
          eyebrowIcon="mdi:cog-outline"
          title={`Welcome back, *${name}.*`}
          lead="Your public profile, who can see it, what we email you about, and your account."
        >
          {username ? (
            <p className="m-0">
              <Link
                href={`/profile/${username}`}
                className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[15px] font-semibold no-underline transition-colors hover:bg-(--t-bg-surface)"
                style={{
                  background: T.bg.deep,
                  border: `1px solid ${T.border.hi}`,
                  color: T.ink.base,
                }}
              >
                View your public profile
                <span aria-hidden="true">→</span>
              </Link>
            </p>
          ) : null}
        </PageHero>
        <SettingsShell
          profile={profile}
          sessionUser={session.user}
          avatarUrl={avatarSrc(profile?.avatar)}
        />
      </div>
    </>
  )
}
