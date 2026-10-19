"use client"

import { Icon } from "@iconify/react"
import { profilePalette, type ProfileBackground } from "@repo/shared-data"
import { useTranslations as useUiTranslations } from "next-intl"
import { useRef, type ReactNode } from "react"

import { useContactModal } from "@/components/contact/ContactModalProvider"
import {
  HeaderDropdownContent,
  HeaderDropdownTrigger,
} from "@/components/global/HeaderDropdown"
import { useNotifications } from "@/components/notifications/NotificationProvider"
import { StaffDrawerMenuItem } from "@/components/staff/StaffDrawerMenuItem"
import {
  DropdownMenu,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { BetterAuthUser } from "@/lib/auth-server"
import { T } from "@/lib/design-tokens"
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
  background,
}: {
  src?: string | null
  initials: string
  size: number
  background?: ProfileBackground | null
}) {
  const palette = profilePalette(background)
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
        background: palette.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: T.font.sans,
        fontSize: size * 0.4,
        fontWeight: 700,
        color: palette.fg,
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
  trailing?: ReactNode
  children: ReactNode
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
    profileBackground?: ProfileBackground | null
    username?: string | null
    isVerifiedLibrarian?: boolean | null
  } | null
}) {
  const tUi = useUiTranslations("ui")
  const tContact = useUiTranslations("contactModal.contact")
  const { openContact } = useContactModal()
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const supportSelected = useRef(false)

  const { unread } = useNotifications()
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
  const hasMembershipSupport = ["supporter", "pro", "team"].includes(
    user.plan ?? ""
  )

  return (
    <DropdownMenu>
      <HeaderDropdownTrigger kind="menu" asChild>
        <button
          ref={menuTrigger}
          type="button"
          aria-label={`Account menu for ${firstName}${unread ? `, ${unread} unread notifications` : ""}`}
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
          <span className="relative inline-flex">
            <Avatar
              src={avatarSrc}
              initials={initials}
              size={32}
              background={profileSnippet?.profileBackground}
            />
            {unread > 0 ? (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-2 border-(--t-bg-deep) bg-(--t-accent-primary)"
              />
            ) : null}
          </span>
          <span>{firstName}</span>
          <Icon
            icon="mdi:chevron-down"
            width={18}
            height={18}
            aria-hidden="true"
            className="shrink-0 transition-transform group-data-[state=open]/profile:rotate-180"
          />
        </button>
      </HeaderDropdownTrigger>

      <HeaderDropdownContent
        kind="menu"
        onCloseAutoFocus={(event) => {
          if (!supportSelected.current) return
          supportSelected.current = false
          event.preventDefault()
          // Open after the menu closes; return the dialog's focus to its trigger.
          menuTrigger.current?.focus()
          openContact("membership_support")
        }}
        aria-label={tUi("account_menu")}
        className="w-[272px]"
      >
        {/* Identity header */}
        <div
          className="mb-1 flex items-center gap-3 border-b px-2.5 pt-2 pb-3"
          style={{ borderBottomColor: T.border.divider }}
        >
          <Avatar
            src={avatarSrc}
            initials={initials}
            size={44}
            background={profileSnippet?.profileBackground}
          />
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

        <DropdownMenuGroup aria-label={tUi("profile")}>
          {needsProfile ? (
            <MenuLink href="/profile/settings" icon="mdi:account-plus-outline">
              {tUi("complete_your_profile")}{" "}
            </MenuLink>
          ) : (
            <MenuLink
              href={username ? `/profile/${username}` : "/profile"}
              icon="mdi:account-circle-outline"
            >
              {tUi("my_profile")}{" "}
            </MenuLink>
          )}
          {username ? (
            <>
              <MenuLink
                href={`/profile/${username}/following`}
                icon="mdi:heart-outline"
              >
                {tUi("following")}{" "}
              </MenuLink>
              <MenuLink
                href={`/profile/${username}/badges`}
                icon="mdi:medal-outline"
              >
                {tUi("badges_points")}{" "}
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
            <DropdownMenuGroup aria-label={tUi("tools")}>
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

        <DropdownMenuGroup aria-label={tUi("account")}>
          <MenuLink
            href="/profile/notifications"
            icon="mdi:bell-outline"
            trailing={
              <span
                className="ml-auto rounded-full bg-(--t-accent-chip) px-2 py-0.5 text-xs font-semibold"
                aria-label={`${unread} unread`}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            }
          >
            {tUi("notifications")}{" "}
          </MenuLink>
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
            {tUi("membership")}{" "}
          </MenuLink>
          {hasMembershipSupport ? (
            <DropdownMenuItem
              aria-haspopup="dialog"
              className="flex w-full cursor-pointer items-center gap-3 rounded-[12px] px-2.5 py-2.5 text-[15px] font-medium focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base)"
              onSelect={() => {
                supportSelected.current = true
              }}
              style={{ color: T.ink.base }}
            >
              <Icon
                icon="mdi:lifebuoy"
                width={19}
                height={19}
                aria-hidden="true"
                className="shrink-0"
                style={{ color: T.ink.dim }}
              />
              <span>{tContact("types.membership_support")}</span>
            </DropdownMenuItem>
          ) : null}
          <MenuLink href="/profile/settings" icon="mdi:cog-outline">
            {tUi("settings")}{" "}
          </MenuLink>
        </DropdownMenuGroup>

        <DropdownMenuSeparator
          className="mx-1 my-1.5"
          style={{ background: T.border.divider }}
        />

        <MenuLink href="/auth/signout" icon="mdi:logout">
          {tUi("sign_out")}{" "}
        </MenuLink>
      </HeaderDropdownContent>
    </DropdownMenu>
  )
}

GlobalLoggedUserMenu.displayName = "GlobalLoggedUserMenu"

export default GlobalLoggedUserMenu
