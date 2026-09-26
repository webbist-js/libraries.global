import { Icon } from "@iconify/react"

import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import type { FollowedUser } from "@/lib/types/profile"

function UserRow({ user }: { user: FollowedUser }) {
  const initials = user.displayName
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <li
      className="border-t first:border-t-0"
      style={{ borderTopColor: T.border.divider }}
    >
      <Link
        href={`/profile/${user.username}`}
        className="flex items-center gap-3.5 rounded-[14px] px-3 py-3 no-underline transition-colors hover:bg-(--t-bg-surface)"
      >
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold"
          style={{
            background: user.avatarUrl ? T.bg.muted : "var(--tint-academic-bg)",
            color: "var(--tint-academic-fg)",
          }}
        >
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            initials || "?"
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span
            className="block truncate text-[16px] font-semibold"
            style={{ color: T.ink.base }}
          >
            {user.displayName}
          </span>
          <span className="block text-[14px]" style={{ color: T.ink.low }}>
            @{user.username}
          </span>
          {user.bio ? (
            <span
              className="mt-0.5 block truncate text-[14px]"
              style={{ color: T.ink.dim }}
            >
              {user.bio}
            </span>
          ) : null}
        </span>

        <Icon
          icon="mdi:chevron-right"
          width={20}
          height={20}
          aria-hidden="true"
          style={{ color: T.ink.low, flexShrink: 0 }}
        />
      </Link>
    </li>
  )
}

// ── FollowedUsersGrid ─────────────────────────────────────────────────────────

export function FollowedUsersGrid({ users }: { users: FollowedUser[] }) {
  if (users.length === 0) {
    return (
      <p className="m-0 text-[15px]" style={{ color: T.ink.dim }}>
        Following other contributors is coming soon.
      </p>
    )
  }

  return (
    <ul className="-mx-3 my-0 list-none p-0">
      {users.map((user) => (
        <UserRow key={user.username} user={user} />
      ))}
    </ul>
  )
}
