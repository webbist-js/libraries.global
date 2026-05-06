"use client"

import { Icon } from "@iconify/react"
import { useEffect, useRef, useState } from "react"

import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { UserProfile } from "@/lib/types/profile"

import { AppearanceSection } from "./AppearanceSection"
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
    id: "appearance",
    label: "Appearance",
    icon: "mdi:palette-outline",
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
          background: T.bg.space,
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
              "radial-gradient(ellipse 80% 100% at 30% 60%, var(--t-aurora-soft) 0%, transparent 60%), linear-gradient(to bottom, transparent 0%, var(--t-bg-space) 100%)",
          }}
        />

        {/* Hero content — constrained to match body container */}
        <div className="relative z-10 flex h-full flex-col justify-end pb-8">
          <div className="mx-auto w-full max-w-[1296px] px-6 md:px-10">
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
                {profile?.profileVisibility === "private"
                  ? "View private profile"
                  : profile?.profileVisibility === "limited"
                    ? "View limited profile"
                    : "View public profile"}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Body: sidebar + content ───────────────────────────────────── */}
      <div className="mx-auto w-full max-w-[1296px] px-6 py-10 md:px-10">
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
                  gap: "10px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  background: "transparent",
                  color: T.accent.aurora,
                  fontFamily: T.font.sans,
                  fontSize: "13px",
                  textDecoration: "none",
                  marginBottom: "10px",
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
                    gap: "10px",
                    padding: "8px 12px",
                    borderRadius: "10px",
                    background: active
                      ? item.danger
                        ? "var(--t-danger-soft)"
                        : "var(--t-aurora-soft)"
                      : "transparent",
                    border: `1px solid ${active ? (item.danger ? "var(--t-danger-edge)" : "var(--t-aurora-edge)") : "transparent"}`,
                    color: item.danger
                      ? active
                        ? T.accent.danger
                        : "rgba(176,52,52,0.5)"
                      : active
                        ? T.accent.aurora
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
            style={{ display: "flex", flexDirection: "column", gap: "20px" }}
          >
            <section id="profile">
              <div className="settings-card">
                <PublicProfileSection
                  profile={profile}
                  sessionUser={sessionUser}
                />
              </div>
            </section>
            <section id="appearance">
              <div className="settings-card">
                <AppearanceSection profile={profile} />
              </div>
            </section>
            <section id="notifications">
              <div className="settings-card">
                <NotificationsSection profile={profile} />
              </div>
            </section>
            <section id="security">
              <div className="settings-card">
                <SecuritySection sessionUser={sessionUser} />
              </div>
            </section>
            <section id="connections">
              <div className="settings-card">
                <ConnectionsSection />
              </div>
            </section>
            <section id="danger">
              <div
                className="settings-card"
                style={{
                  borderColor: "var(--t-danger-edge)",
                  background: `linear-gradient(180deg, var(--t-bg-deep) 0%, var(--t-danger-soft) 100%)`,
                }}
              >
                <DangerZoneSection sessionUser={sessionUser} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
