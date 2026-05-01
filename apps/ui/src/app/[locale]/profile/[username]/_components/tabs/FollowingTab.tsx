import { Icon } from "@iconify/react"
import Link from "next/link"

import { LibraryCard } from "@/components/ds/LibraryCard"
import { T } from "@/lib/design-tokens"
import { formatStrapiMediaUrl } from "@/lib/strapi-helpers"
import type { FollowedLibrary } from "@/lib/types/profile"

// ── Followed-user card ─────────────────────────────────────────────────────────

interface FollowedUser {
  username: string
  displayName: string
  avatarUrl?: string | null
  bio?: string | null
}

function UserFollowCard({ user }: { user: FollowedUser }) {
  const initials = user.displayName
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <Link href={`/profile/${user.username}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "14px 16px",
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          background: T.bg.surface,
          transition: "background 150ms, border-color 150ms",
          cursor: "pointer",
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            background: user.avatarUrl
              ? "transparent"
              : "rgba(127,223,255,0.12)",
            border: `1px solid ${T.border.line}`,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "11px",
                fontWeight: 600,
                color: T.accent.aurora,
              }}
            >
              {initials || "?"}
            </span>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: T.font.sans,
              fontSize: "13px",
              fontWeight: 500,
              color: T.ink.base,
              margin: "0 0 2px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.displayName}
          </p>
          <p
            style={{
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: ".06em",
              color: T.ink.faint,
              margin: 0,
            }}
          >
            @{user.username}
          </p>
          {user.bio && (
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "12px",
                color: T.ink.dim,
                margin: "4px 0 0",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.bio}
            </p>
          )}
        </div>

        <Icon
          icon="mdi:chevron-right"
          width={16}
          style={{ color: T.ink.faint, flexShrink: 0 }}
        />
      </div>
    </Link>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FollowingTab({
  followedLibraries,
  followedUsers = [],
}: {
  followedLibraries: FollowedLibrary[]
  followedUsers?: FollowedUser[]
}) {
  const hasLibraries = followedLibraries.length > 0
  const hasUsers = followedUsers.length > 0

  if (!hasLibraries && !hasUsers) {
    return (
      <div
        style={{
          border: `1px solid ${T.border.line}`,
          borderRadius: "12px",
          padding: "48px",
          textAlign: "center",
          background: T.bg.surface,
        }}
      >
        <p
          style={{
            fontFamily: T.font.mono,
            fontSize: "10px",
            letterSpacing: ".18em",
            textTransform: "uppercase",
            color: T.ink.faint,
            margin: "0 0 8px",
          }}
        >
          Following
        </p>
        <p style={{ fontSize: "14px", color: T.ink.faint, margin: 0 }}>
          Libraries and people followed will appear here.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* ── Libraries ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "18px",
              fontWeight: 600,
              color: T.ink.base,
              margin: 0,
            }}
          >
            Libraries
          </p>
          <span
            style={{
              fontFamily: T.font.mono,
              fontSize: "9px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: T.ink.faint,
            }}
          >
            {followedLibraries.length}{" "}
            {followedLibraries.length === 1 ? "library" : "libraries"}
          </span>
        </div>

        {hasLibraries ? (
          <div className="flex snap-x snap-mandatory gap-px overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden">
            {followedLibraries.map((lib, index) => (
              <LibraryCard
                key={lib.documentId ?? lib.slug ?? lib.name}
                documentId={lib.documentId ?? lib.slug ?? lib.name}
                slug={lib.slug}
                name={lib.name ?? ""}
                libraryType={lib.libraryType}
                heroImageUrl={formatStrapiMediaUrl(lib.heroImageUrl) ?? null}
                href={lib.slug ? `/library/${lib.slug}` : null}
                index={index}
                variant="featured"
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "10px",
              padding: "28px",
              textAlign: "center",
              background: T.bg.surface,
            }}
          >
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                color: T.ink.faint,
                margin: 0,
              }}
            >
              No libraries followed yet.
            </p>
          </div>
        )}
      </div>

      {/* ── People ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <p
            style={{
              fontFamily: T.font.serif,
              fontSize: "18px",
              fontWeight: 600,
              color: T.ink.base,
              margin: 0,
            }}
          >
            People
          </p>
          {hasUsers && (
            <span
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.ink.faint,
              }}
            >
              {followedUsers.length}{" "}
              {followedUsers.length === 1 ? "person" : "people"}
            </span>
          )}
        </div>

        {hasUsers ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {followedUsers.map((user) => (
              <UserFollowCard key={user.username} user={user} />
            ))}
          </div>
        ) : (
          <div
            style={{
              border: `1px solid ${T.border.line}`,
              borderRadius: "10px",
              padding: "28px",
              textAlign: "center",
              background: T.bg.surface,
            }}
          >
            <p
              style={{
                fontFamily: T.font.mono,
                fontSize: "9px",
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: T.ink.faint,
                margin: "0 0 6px",
              }}
            >
              Coming soon
            </p>
            <p
              style={{
                fontFamily: T.font.sans,
                fontSize: "13px",
                color: T.ink.faint,
                margin: 0,
              }}
            >
              Following other contributors will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
