"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import { Breadcrumb } from "@/components/ds/Breadcrumb"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

import { DataAccountSection } from "./DataAccountSection"
import { NotificationsSection } from "./NotificationsSection"
import { PrivacySection } from "./PrivacySection"
import { PublicProfileSection } from "./PublicProfileSection"
import { SignInSecuritySection } from "./SignInSecuritySection"

const SIDEBAR_ITEMS = [
  { id: "profile", label: "Profile", icon: "mdi:account-outline" },
  { id: "privacy", label: "Privacy", icon: "mdi:eye-outline" },
  { id: "notifications", label: "Notifications", icon: "mdi:bell-outline" },
  {
    id: "security",
    label: "Sign-in & security",
    icon: "mdi:lock-outline",
  },
  {
    id: "data",
    label: "Your data & account",
    icon: "mdi:tray-arrow-down",
  },
] as const

type SectionId = (typeof SIDEBAR_ITEMS)[number]["id"]

export function SettingsShell({
  profile,
  sessionUser,
}: {
  profile: UserProfile | null
  sessionUser: BetterAuthUser
}) {
  const [activeSection, setActiveSection] = useState<SectionId>("profile")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    const sections = SIDEBAR_ITEMS.map((item) =>
      document.getElementById(item.id)
    ).filter(Boolean) as HTMLElement[]

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveSection(visible[0].target.id as SectionId)
        }
      },
      { rootMargin: "-15% 0px -65% 0px", threshold: 0 }
    )

    sections.forEach((el) => observerRef.current!.observe(el))

    return () => observerRef.current?.disconnect()
  }, [])

  const displayName = profile?.firstName
    ? `${profile.firstName}${profile.lastName ? ` ${profile.lastName}` : ""}`
    : (sessionUser.name ?? sessionUser.email)

  return (
    <div
      className="relative isolate flex min-h-screen w-full flex-col"
      style={{ background: T.bg.void }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <section className="mx-auto w-full max-w-[1360px] px-4 pt-6 pb-2 sm:px-8 sm:pt-10">
        <Breadcrumb
          className="mb-5"
          items={[
            { label: "Home", href: "/" },
            ...(profile?.username
              ? [
                  {
                    label: `@${profile.username}`,
                    href: `/profile/${profile.username}`,
                  },
                ]
              : []),
            { label: "Settings" },
          ]}
        />
        <p
          className="m-0 mb-2 text-[15px] font-medium"
          style={{ color: T.ink.dim }}
        >
          Account settings
        </p>
        <h1
          className="m-0"
          style={{
            fontFamily: T.font.serif,
            fontSize: "clamp(2.1rem, 3.8vw, 3rem)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            color: T.ink.base,
          }}
        >
          Welcome back,{" "}
          <em
            style={{
              fontStyle: "italic",
              fontWeight: 400,
              color: T.accent.primary,
            }}
          >
            {displayName}.
          </em>
        </h1>
        <p
          className="mt-3 mb-0 text-[16px]"
          style={{ color: T.ink.dim, maxWidth: "60ch" }}
        >
          Manage your profile, privacy, notifications and account.{" "}
          {profile?.username ? (
            <Link
              href={`/profile/${profile.username}`}
              className="underline underline-offset-[3px]"
              style={{ color: T.accent.primary, fontWeight: 600 }}
            >
              View your public profile
            </Link>
          ) : null}
        </p>
      </section>

      {/* ── Body: sidebar + stacked cards ─────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
        <div className="flex gap-8">
          <nav
            aria-label="Settings sections"
            className="sticky hidden w-[210px] shrink-0 flex-col gap-1 self-start md:flex"
            style={{ top: "80px" }}
          >
            {SIDEBAR_ITEMS.map((item) => {
              const active = activeSection === item.id

              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  aria-current={active ? "true" : undefined}
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-[14px] no-underline transition-colors"
                  style={{
                    background: active ? T.accent.chip : "transparent",
                    color: active ? T.accent.primaryHover : T.ink.dim,
                    fontWeight: active ? 600 : 500,
                    fontFamily: T.font.sans,
                  }}
                >
                  <Icon
                    icon={item.icon}
                    width={17}
                    height={17}
                    aria-hidden="true"
                    style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }}
                  />
                  {item.label}
                </a>
              )
            })}
          </nav>

          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <section id="profile" className="scroll-mt-20">
              <div className="settings-card">
                <PublicProfileSection
                  profile={profile}
                  sessionUser={sessionUser}
                />
              </div>
            </section>
            <section id="privacy" className="scroll-mt-20">
              <div className="settings-card">
                <PrivacySection profile={profile} />
              </div>
            </section>
            <section id="notifications" className="scroll-mt-20">
              <div className="settings-card">
                <NotificationsSection profile={profile} />
              </div>
            </section>
            <section id="security" className="scroll-mt-20">
              <div className="settings-card">
                <SignInSecuritySection />
              </div>
            </section>
            <section id="data" className="scroll-mt-20">
              <div className="settings-card">
                <DataAccountSection sessionUser={sessionUser} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
