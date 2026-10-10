import { Icon } from "@iconify/react"
import type React from "react"

import { StaffDrawerMenuItem } from "@/components/staff/StaffDrawerMenuItem"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T, TYPE_TINT } from "@/lib/design-tokens"
import { Link } from "@/lib/navigation"
import { planShortName } from "@/lib/plans"

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
        background: TYPE_TINT.national.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.font.sans,
        fontSize: size * 0.4,
        fontWeight: 700,
        color: TYPE_TINT.national.fg,
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
  // The session carries the username (buildSessionAccess); the snippet is a
  // fallback. "Complete your profile" only when the bridge answered and
  // there is no username: a failed bridge says nothing about the profile.
  const username = user.username ?? profileSnippet?.username ?? null
  const needsProfile = user.profileLoaded === true && !username
  // UI only: the routes behind these links re-check every capability.
  const caps = new Set<string>(user.capabilities)
  const isStaff = caps.has("staff.area")
  const hasEditorialTools =
    caps.has("docs.directEdit") ||
    caps.has("journal.directEdit") ||
    caps.has("moderate.queue") ||
    caps.has("drives.manage")
  const planName = planShortName(user.plan)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${firstName}`}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            minHeight: "44px",
            padding: "2px 14px 2px 4px",
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
          className="group/profile hover:bg-(--t-bg-surface)"
        >
          <Avatar src={avatarSrc} initials={initials} size={32} />
          <span>{firstName}</span>
          <Icon
            icon="mdi:chevron-down"
            width={18}
            height={18}
            aria-hidden="true"
            className="shrink-0 transition-transform group-data-[state=open]/profile:rotate-180"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        aria-label="Account menu"
        align="end"
        sideOffset={20}
        className="w-[272px] rounded-[20px] border p-2 shadow-none"
        style={{ background: T.bg.deep, borderColor: T.border.hi }}
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

        <DropdownMenuGroup aria-label="Profile">
          {needsProfile ? (
            <MenuLink href="/profile/settings" icon="mdi:account-plus-outline">
              Complete your profile
            </MenuLink>
          ) : (
            <MenuLink
              href={username ? `/profile/${username}` : "/profile"}
              icon="mdi:account-circle-outline"
            >
              My profile
            </MenuLink>
          )}
          {username ? (
            <>
              <MenuLink
                href={`/profile/${username}/following`}
                icon="mdi:heart-outline"
              >
                Following
              </MenuLink>
              <MenuLink
                href={`/profile/${username}/badges`}
                icon="mdi:medal-outline"
              >
                Badges & points
              </MenuLink>
            </>
          ) : null}
        </DropdownMenuGroup>

        {/* Contribution pages live in Contribute. Keep only the drawer
            controls here so they remain easy to open on smaller screens. */}
        {isStaff || hasEditorialTools ? (
          <>
            <DropdownMenuSeparator
              className="mx-1 my-1.5"
              style={{ background: T.border.divider }}
            />
            <DropdownMenuGroup aria-label="Tools">
              {isStaff ? <StaffDrawerMenuItem /> : null}
              {hasEditorialTools ? (
                <StaffDrawerMenuItem drawer="editorial" />
              ) : null}
            </DropdownMenuGroup>
          </>
        ) : null}

        <DropdownMenuSeparator
          className="mx-1 my-1.5"
          style={{ background: T.border.divider }}
        />

        <DropdownMenuGroup aria-label="Account">
          <MenuLink
            href="/contribute/membership"
            icon="mdi:star-circle-outline"
            trailing={
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold"
                style={{
                  background:
                    planName === "Free" ? T.bg.surface : T.accent.chip,
                  color:
                    planName === "Free" ? T.ink.dim : T.accent.primaryHover,
                }}
              >
                {planName}
              </span>
            }
          >
            Membership
          </MenuLink>
          <MenuLink href="/profile/settings" icon="mdi:cog-outline">
            Settings
          </MenuLink>
        </DropdownMenuGroup>

        <DropdownMenuSeparator
          className="mx-1 my-1.5"
          style={{ background: T.border.divider }}
        />

        <MenuLink href="/auth/signout" icon="mdi:logout">
          Sign out
        </MenuLink>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

GlobalLoggedUserMenu.displayName = "GlobalLoggedUserMenu"

export default GlobalLoggedUserMenu
