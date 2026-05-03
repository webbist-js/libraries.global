import { T } from "@/lib/design-tokens"
import type { FollowedLibrary, FollowedUser } from "@/lib/types/profile"

import { FollowedLibrariesGrid } from "../FollowedLibrariesGrid"
import { FollowedUsersGrid } from "../FollowedUsersGrid"

// ── FollowingSection ──────────────────────────────────────────────────────────
//
// Full-page following view: libraries (carousel) + people (list).

export function FollowingSection({
  username,
  followedLibraries,
  followedUsers = [],
}: {
  username: string
  followedLibraries: FollowedLibrary[]
  followedUsers?: FollowedUser[]
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
      {/* ── Libraries ───────────────────────────────────────────────── */}
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
              fontWeight: 400,
              letterSpacing: "-0.02em",
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
        <FollowedLibrariesGrid
          libraries={followedLibraries}
          username={username}
          variant="carousel"
        />
      </div>

      {/* ── People ──────────────────────────────────────────────────── */}
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
              fontWeight: 400,
              letterSpacing: "-0.02em",
              color: T.ink.base,
              margin: 0,
            }}
          >
            People
          </p>
          {followedUsers.length > 0 && (
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
        <FollowedUsersGrid users={followedUsers} />
      </div>
    </div>
  )
}
