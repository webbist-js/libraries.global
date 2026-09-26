import { Icon } from "@iconify/react"
import type React from "react"

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
  if (parts.length === 1) return (parts[0] ?? "").slice(0, 2).toUpperCase()

  return ((parts[0]?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase()
}

function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ""
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
        background: "var(--tint-national-bg)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.font.sans,
        fontSize: size * 0.4,
        fontWeight: 700,
        color: "var(--tint-national-fg)",
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  )
}

function MenuLink({
  href,
  icon,
  trailing,
  children,
}: {
  href: string
  icon: string
  trailing?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <DropdownMenuItem
      asChild
      className="cursor-pointer rounded-[12px] p-0 focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base)"
    >
      <Link
        href={href}
        className="flex w-full items-center gap-3 px-2.5 py-2.5 text-[15px] font-medium"
        style={{ color: T.ink.base }}
      >
        <Icon
          icon={icon}
          width={19}
          height={19}
          aria-hidden="true"
          className="shrink-0"
          style={{ color: T.ink.dim }}
        />
        <span>{children}</span>
        {trailing}
      </Link>
    </DropdownMenuItem>
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
    isVerifiedLibrarian?: boolean | null
  } | null
}) {
  const initials = getInitials(user.name || user.email)
  const firstName = user.name
    ? getFirstName(user.name)
    : user.email.split("@")[0]
  const avatarSrc = profileSnippet?.avatarUrl ?? user.image ?? null
  const username = profileSnippet?.username ?? null
  const isVerifiedLibrarian = profileSnippet?.isVerifiedLibrarian ?? false

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            height: "36px",
            padding: "2px 14px 2px 2px",
            borderRadius: "999px",
            border: `1px solid ${T.border.line}`,
            background: T.bg.deep,
            cursor: "pointer",
            transition: "background 150ms",
            fontFamily: T.font.sans,
            fontSize: "14px",
            fontWeight: 600,
            color: T.ink.base,
          }}
          className="hover:bg-(--t-bg-surface)"
        >
          <Avatar src={avatarSrc} initials={initials} size={30} />
          <span>{firstName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[272px] rounded-[20px] border p-2 shadow-none"
        style={{
          background: T.bg.deep,
          borderColor: T.border.line,
          boxShadow: "0 12px 28px rgba(23,22,43,.08)",
        }}
      >
        {/* Identity header */}
        <div
          className="mb-1 flex items-center gap-3 border-b px-2.5 pt-2 pb-3"
          style={{ borderBottomColor: T.border.divider }}
        >
          <Avatar src={avatarSrc} initials={initials} size={44} />
          <div className="min-w-0 flex-1">
            <p
              className="m-0 truncate text-[16px] font-semibold"
              style={{ color: T.ink.base }}
            >
              {user.name || firstName}
            </p>
            <p
              className="m-0 mt-0.5 truncate text-[14px]"
              style={{ color: T.ink.dim }}
            >
              {username ? `@${username}` : user.email}
            </p>
          </div>
        </div>

        {username ? (
          <>
            <MenuLink
              href={`/profile/${username}`}
              icon="mdi:account-circle-outline"
            >
              My profile
            </MenuLink>
            <MenuLink
              href={`/profile/${username}/contributions`}
              icon="mdi:pencil-outline"
            >
              My contributions
            </MenuLink>
            <MenuLink
              href={`/profile/${username}/badges`}
              icon="mdi:medal-outline"
            >
              Badges & points
            </MenuLink>
            {/* Submissions — verified librarians only */}
            {isVerifiedLibrarian && (
              <MenuLink
                href="/contribute/submissions"
                icon="mdi:inbox-multiple-outline"
                trailing={
                  <span
                    className="ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold"
                    style={{
                      background: "var(--tint-national-bg)",
                      color: "var(--tint-national-fg)",
                    }}
                  >
                    Librarian
                  </span>
                }
              >
                My submissions
              </MenuLink>
            )}
          </>
        ) : (
          /* No profile yet — prompt to complete setup */
          <MenuLink href="/profile/settings" icon="mdi:account-plus-outline">
            Complete your profile
          </MenuLink>
        )}

        <DropdownMenuSeparator
          className="mx-1 my-1.5"
          style={{ background: T.border.divider }}
        />

        <MenuLink href="/profile/settings" icon="mdi:cog-outline">
          Settings
        </MenuLink>
        <MenuLink href="/auth/signout" icon="mdi:logout">
          Sign out
        </MenuLink>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

GlobalLoggedUserMenu.displayName = "GlobalLoggedUserMenu"

export default GlobalLoggedUserMenu
