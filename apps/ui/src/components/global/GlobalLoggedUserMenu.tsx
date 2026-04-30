import { Icon } from "@iconify/react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()

  return (parts[0][0] + parts.at(-1)[0]).toUpperCase()
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0]
}

function Avatar({
  src,
  initials,
  size,
}: {
  src?: string | null
  initials: string
  size: number
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(127,223,255,0.15)",
        border: "1px solid rgba(127,223,255,0.25)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.font.mono,
        fontSize: size * 0.38,
        fontWeight: 600,
        color: T.accent.aurora,
        flexShrink: 0,
        letterSpacing: "0.04em",
      }}
    >
      {initials}
    </span>
  )
}

export function GlobalLoggedUserMenu({
  user,
  profileSnippet,
}: {
  readonly user: BetterAuthUser
  readonly profileSnippet?: {
    avatarUrl?: string | null
    username?: string | null
  } | null
}) {
  const initials = getInitials(user.name || user.email)
  const firstName = user.name
    ? getFirstName(user.name)
    : user.email.split("@")[0]
  // Strapi avatarUrl takes priority over BA OAuth image
  const avatarSrc = profileSnippet?.avatarUrl ?? user.image ?? null
  const username = profileSnippet?.username

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "3px 12px 3px 3px",
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.10)",
            background: "rgba(255,255,255,0.04)",
            cursor: "pointer",
            transition: "background 150ms, border-color 150ms",
            fontFamily: T.font.mono,
            fontSize: "12px",
            letterSpacing: "0.05em",
            color: "rgba(255,255,255,0.75)",
          }}
          className="hover:border-white/20 hover:bg-white/[0.07]"
        >
          <Avatar src={avatarSrc} initials={initials} size={28} />
          <span>{username ? `@${username}` : firstName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        style={{
          width: "220px",
          background: "rgba(6,9,26,0.97)",
          border: "1px solid rgba(255,255,255,0.09)",
          backdropFilter: "blur(20px)",
          boxShadow:
            "0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)",
          borderRadius: "12px",
          padding: "6px",
        }}
      >
        {/* Identity header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "10px 10px 12px",
            marginBottom: "4px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <Avatar src={avatarSrc} initials={initials} size={38} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              style={{
                margin: 0,
                fontFamily: T.font.sans,
                fontSize: "13px",
                fontWeight: 600,
                color: "rgba(255,255,255,0.92)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.name || firstName}
            </p>
            {username ? (
              <p
                style={{
                  margin: "1px 0 0",
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  color: T.accent.aurora,
                  opacity: 0.7,
                }}
              >
                @{username}
              </p>
            ) : (
              <p
                style={{
                  margin: "1px 0 0",
                  fontFamily: T.font.mono,
                  fontSize: "10px",
                  letterSpacing: "0.04em",
                  color: "rgba(255,255,255,0.32)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {user.email}
              </p>
            )}
          </div>
        </div>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg focus:bg-white/[0.06]"
        >
          <Link
            href="/profile"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-white/65 hover:text-white"
          >
            <Icon
              icon="mdi:account-circle-outline"
              width={15}
              height={15}
              className="shrink-0 opacity-60"
            />
            <span>View profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg focus:bg-white/[0.06]"
        >
          <Link
            href="/settings"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-white/65 hover:text-white"
          >
            <Icon
              icon="mdi:cog-outline"
              width={15}
              height={15}
              className="shrink-0 opacity-60"
            />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator
          style={{ margin: "4px 0", background: "rgba(255,255,255,0.07)" }}
        />

        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg focus:bg-white/[0.06]"
        >
          <Link
            href="/auth/signout"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-white/40 hover:text-white/70"
          >
            <Icon
              icon="mdi:logout"
              width={15}
              height={15}
              className="shrink-0 opacity-60"
            />
            <span>Sign out</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

GlobalLoggedUserMenu.displayName = "GlobalLoggedUserMenu"

export default GlobalLoggedUserMenu
