"use client"

import { Icon } from "@iconify/react"
import { useRouter } from "next/navigation"

import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
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
  activeSection,
  profile,
  sessionUser,
}: {
  activeSection: string
  profile: UserProfile | null
  sessionUser: BetterAuthUser
}) {
  const router = useRouter()
  const section = activeSection as SectionId

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
        className="relative overflow-hidden"
        style={{ height: "260px", borderBottom: `1px solid ${T.border.line}` }}
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

        {/* Hero content */}
        <div className="relative z-10 flex h-full flex-col justify-end px-8 pb-8 md:px-12">
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
              style={{ fontStyle: "italic", fontWeight: 400, color: T.ink.dim }}
            >
              {displayName}.
            </em>
          </h1>

          <p
            style={{
              fontSize: "14px",
              color: T.ink.faint,
              margin: 0,
              maxWidth: "52ch",
            }}
          >
            Manage your profile, notifications, security, and data. Changes save
            automatically unless otherwise noted.
          </p>
        </div>
      </section>

      {/* ── Body: sidebar + content ───────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl px-6 py-10 md:px-10">
        <div className="flex gap-8">
          {/* Sidebar nav */}
          <nav
            className="sticky"
            style={{
              top: "80px",
              width: "200px",
              flexShrink: 0,
              alignSelf: "flex-start",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            {SIDEBAR_ITEMS.map((item) => {
              const active = section === item.id

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(`/settings?section=${item.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "none",
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
                    textAlign: "left",
                    cursor: "pointer",
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
                </button>
              )
            })}
          </nav>

          {/* Content */}
          <div className="min-w-0 flex-1">
            {section === "profile" && (
              <PublicProfileSection
                profile={profile}
                sessionUser={sessionUser}
              />
            )}
            {section === "notifications" && (
              <NotificationsSection profile={profile} />
            )}
            {section === "security" && (
              <SecuritySection sessionUser={sessionUser} />
            )}
            {section === "connections" && <ConnectionsSection />}
            {section === "danger" && (
              <DangerZoneSection sessionUser={sessionUser} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
