import { LogOutIcon, UserIcon, UserRoundCogIcon } from "lucide-react"

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
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0]
}

export function GlobalLoggedUserMenu({
  user,
}: {
  readonly user: BetterAuthUser
}) {
  const initials = getInitials(user.name || user.email)
  const firstName = user.name ? getFirstName(user.name) : user.email.split("@")[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "4px 12px 4px 4px",
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
          {/* Avatar */}
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={firstName}
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          ) : (
            <span
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "50%",
                background: "rgba(127,223,255,0.18)",
                border: "1px solid rgba(127,223,255,0.28)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: T.font.mono,
                fontSize: "10px",
                fontWeight: 600,
                color: T.accent.aurora,
                flexShrink: 0,
                letterSpacing: "0.04em",
              }}
            >
              {initials}
            </span>
          )}
          {/* First name */}
          <span>{firstName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-52"
        style={{
          background: "rgba(7,11,30,0.96)",
          border: "1px solid rgba(255,255,255,0.10)",
          backdropFilter: "blur(16px)",
        }}
      >
        {/* Identity header */}
        <div
          style={{
            padding: "10px 12px 8px",
            borderBottom: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontFamily: T.font.sans,
              fontSize: "13px",
              fontWeight: 500,
              color: "rgba(255,255,255,0.85)",
            }}
          >
            {user.name || firstName}
          </p>
          <p
            style={{
              margin: "2px 0 0",
              fontFamily: T.font.mono,
              fontSize: "10px",
              letterSpacing: "0.04em",
              color: "rgba(255,255,255,0.38)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </p>
        </div>

        <DropdownMenuSeparator className="bg-white/[0.06]" />

        <DropdownMenuItem asChild className="cursor-pointer text-white/65 hover:text-white focus:text-white">
          <Link
            href="/profile"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px]"
          >
            <UserIcon className="size-3.5 opacity-60" />
            <span>View profile</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="cursor-pointer text-white/65 hover:text-white focus:text-white">
          <Link
            href="/settings"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px]"
          >
            <UserRoundCogIcon className="size-3.5 opacity-60" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/[0.06]" />

        <DropdownMenuItem asChild className="cursor-pointer text-white/50 hover:text-white focus:text-white">
          <Link
            href="/auth/signout"
            className="flex w-full items-center gap-2 px-3 py-2 text-[13px]"
          >
            <LogOutIcon className="size-3.5 opacity-60" />
            <span>Sign out</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

GlobalLoggedUserMenu.displayName = "GlobalLoggedUserMenu"

export default GlobalLoggedUserMenu
