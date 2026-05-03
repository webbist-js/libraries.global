import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { FollowedUser } from "@/lib/types/profile"

function UserCard({ user }: { user: FollowedUser }) {
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
          cursor: "pointer",
          transition: "background 150ms, border-color 150ms",
        }}
      >
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

// ── FollowedUsersGrid ─────────────────────────────────────────────────────────

export function FollowedUsersGrid({ users }: { users: FollowedUser[] }) {
  if (users.length === 0) {
    return (
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
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {users.map((user) => (
        <UserCard key={user.username} user={user} />
      ))}
    </div>
  )
}
