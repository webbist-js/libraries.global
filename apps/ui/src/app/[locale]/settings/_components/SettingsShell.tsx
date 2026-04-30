"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

import { ConnectionsSection } from "./ConnectionsSection"
import { DangerZoneSection } from "./DangerZoneSection"
import { NotificationsSection } from "./NotificationsSection"
import { PublicProfileSection } from "./PublicProfileSection"
import { SecuritySection } from "./SecuritySection"
import { SettingsDotHero } from "./SettingsDotHero"

const SIDEBAR_ITEMS = [
  {
    id: "profile",
    label: "Profile",
    icon: "mdi:account-circle-outline",
    danger: false,
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "mdi:bell-outline",
    danger: false,
  },
  {
    id: "security",
    label: "Security",
    icon: "mdi:shield-check-outline",
    danger: false,
  },
  {
    id: "connections",
    label: "Connections",
    icon: "mdi:link-variant",
    danger: false,
  },
  {
    id: "danger",
    label: "Danger zone",
    icon: "mdi:alert-circle-outline",
    danger: true,
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
        // Pick the topmost intersecting section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveSection(visible[0].target.id as SectionId)
        }
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: 0 }
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
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section
        data-transparent-header=""
        className="relative -mt-14 overflow-hidden"
        style={{
          background: "#030511",
          height: "316px",
          borderBottom: `1px solid ${T.border.line}`,
        }}
      >
        <SettingsDotHero />

        {/* Radial depth overlay */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 100% at 30% 60%, rgba(127,223,255,0.06) 0%, transparent 60%), linear-gradient(to bottom, rgba(3,5,17,0) 0%, rgba(3,5,17,0.7) 100%)",
          }}
        />

        {/* Hero content — constrained to match body container */}
        <div className="relative z-10 flex h-full flex-col justify-end pb-8">
          <div className="mx-auto w-full max-w-6xl px-6 md:px-10">
            {/* Eyebrow */}
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "10px",
                letterSpacing: ".22em",
                textTransform: "uppercase",
                color: T.ink.faint,
                margin: "0 0 10px",
              }}
            >
              § Account settings
            </p>

            {/* Title */}
            <h1
              style={{
                fontFamily: T.font.serif,
                fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
                color: T.ink.base,
                margin: "0 0 10px",
              }}
            >
              Welcome back,{" "}
              <em
                style={{
                  fontStyle: "italic",
                  fontWeight: 400,
                  color: T.ink.dim,
                }}
              >
                {displayName}.
              </em>
            </h1>

            <p
              style={{
                fontSize: "14px",
                color: T.ink.faint,
                margin: "0 0 16px",
                maxWidth: "52ch",
              }}
            >
              Manage your profile, notifications, security, and data. Changes
              save automatically unless otherwise noted.
            </p>

            {profile?.username && (
              <Link
                href={`/profile/${profile.username}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: T.accent.aurora,
                  textDecoration: "none",
                  fontFamily: T.font.mono,
                  letterSpacing: ".08em",
                  opacity: 0.85,
                }}
              >
                <Icon icon="mdi:arrow-top-right" width={13} height={13} />
                View public profile
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Body: sidebar + content ───────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10">
        <div className="flex gap-8">
          {/* Sticky sidebar nav */}
          <nav
            className="sticky hidden md:flex"
            style={{
              top: "80px",
              width: "200px",
              flexShrink: 0,
              alignSelf: "flex-start",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {/* Link to public profile */}
            {profile?.username && (
              <Link
                href={`/profile/${profile.username}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "9px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  background: "transparent",
                  color: T.accent.aurora,
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  textDecoration: "none",
                  marginBottom: "8px",
                  borderBottom: `1px solid ${T.border.line}`,
                  paddingBottom: "14px",
                  marginLeft: "-2px",
                }}
              >
                <Icon
                  icon="mdi:account-box-outline"
                  width={15}
                  height={15}
                  style={{ flexShrink: 0 }}
                />
                View profile
                <Icon
                  icon="mdi:arrow-top-right"
                  width={11}
                  height={11}
                  style={{ marginLeft: "auto", opacity: 0.6 }}
                />
              </Link>
            )}

            {SIDEBAR_ITEMS.map((item) => {
              const active = activeSection === item.id

              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: active
                      ? "rgba(255,255,255,0.06)"
                      : "transparent",
                    color: item.danger
                      ? active
                        ? T.accent.danger
                        : "rgba(255,100,100,0.5)"
                      : active
                        ? T.ink.base
                        : T.ink.dim,
                    fontFamily: T.font.sans,
                    fontSize: "13px",
                    textDecoration: "none",
                    transition: "background 150ms, color 150ms",
                    width: "100%",
                  }}
                >
                  <Icon
                    icon={item.icon}
                    width={15}
                    height={15}
                    style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}
                  />
                  {item.label}
                </a>
              )
            })}
          </nav>

          {/* All sections rendered simultaneously, scrollable */}
          <div
            className="min-w-0 flex-1"
            style={{ display: "flex", flexDirection: "column", gap: "48px" }}
          >
            <section id="profile">
              <PublicProfileSection
                profile={profile}
                sessionUser={sessionUser}
              />
            </section>
            <section id="notifications">
              <NotificationsSection profile={profile} />
            </section>
            <section id="security">
              <SecuritySection sessionUser={sessionUser} />
            </section>
            <section id="connections">
              <ConnectionsSection />
            </section>
            <section id="danger">
              <DangerZoneSection sessionUser={sessionUser} />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
