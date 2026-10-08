import { Icon } from "@iconify/react"
import type React from "react"

import { StaffDrawerMenuItem } from "@/components/staff/StaffDrawerMenuItem"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { sessionTeamsOf } from "@/lib/access-server"
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
  const canModerate = caps.has("moderate.queue")
  const isStaff = caps.has("staff.area")
  const teams = sessionTeamsOf(user)
  const organises = teams.some((t) => t.role === "organiser")
  const holdsEditorOrModerator =
    canModerate || caps.has("docs.directEdit") || caps.has("journal.directEdit")
  // Missing plan means free (missing session fields deny).
  const hasPro = user.plan === "pro" || user.plan === "team"
  const planName = planShortName(user.plan)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
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
          className="hover:bg-(--t-bg-surface)"
        >
          <Avatar src={avatarSrc} initials={initials} size={32} />
          <span>{firstName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
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

        {username ? (
          <>
            <MenuLink
              href={`/profile/${username}`}
              icon="mdi:account-circle-outline"
            >
              My profile
            </MenuLink>
            {/* Everything sent or started, drafts included. The accepted
                ones, the public record, are a tab on My profile. */}
            <MenuLink
              href="/contribute/submissions"
              icon="mdi:inbox-multiple-outline"
            >
              My submissions
            </MenuLink>
            <MenuLink
              href={`/profile/${username}/badges`}
              icon="mdi:medal-outline"
            >
              Badges & points
            </MenuLink>
          </>
        ) : needsProfile ? (
          /* No profile yet — prompt to complete setup */
          <MenuLink href="/profile/settings" icon="mdi:account-plus-outline">
            Complete your profile
          </MenuLink>
        ) : null}

        {isStaff ? (
          <>
            <MenuLink href="/staff" icon="mdi:shield-account-outline">
              Staff area
            </MenuLink>
            <StaffDrawerMenuItem />
          </>
        ) : null}
        {teams.length > 0 ? (
          <MenuLink href="/staff/team" icon="mdi:account-group-outline">
            {organises ? "Your team (organiser)" : "Your team"}
          </MenuLink>
        ) : null}
        {canModerate ? (
          <MenuLink
            href="/contribute/moderation"
            icon="mdi:shield-check-outline"
          >
            Moderation
          </MenuLink>
        ) : null}
        {!holdsEditorOrModerator && user.profileLoaded === true ? (
          <MenuLink
            href="/contribute/knowledge/apply"
            icon="mdi:account-star-outline"
          >
            Apply for a role
          </MenuLink>
        ) : null}

        <DropdownMenuSeparator
          className="mx-1 my-1.5"
          style={{ background: T.border.divider }}
        />

        <MenuLink
          href="/contribute/membership"
          icon="mdi:star-circle-outline"
          trailing={
            hasPro ? (
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-[12px] font-semibold"
                style={{
                  background: T.accent.chip,
                  color: T.accent.primaryHover,
                }}
              >
                Pro
              </span>
            ) : undefined
          }
        >
          Plan: {planName}
        </MenuLink>
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
