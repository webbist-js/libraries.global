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
        background: "var(--t-aurora-soft)",
        border: "1px solid var(--t-aurora-edge)",
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
            gap: "8px",
            padding: "3px 12px 3px 3px",
            borderRadius: "999px",
            border: `1px solid ${T.border.line}`,
            background: T.bg.deep,
            cursor: "pointer",
            transition: "background 150ms, border-color 150ms",
            fontFamily: T.font.mono,
            fontSize: "12px",
            letterSpacing: "0.05em",
            color: T.ink.dim,
          }}
          className="hover:border-(--t-border-hi) hover:bg-(--t-bg-surface)"
        >
          <Avatar src={avatarSrc} initials={initials} size={28} />
          <span>{username ? `@${username}` : firstName}</span>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        style={{
          width: "236px",
          background: T.bg.deep,
          border: `1px solid ${T.border.line}`,
          backdropFilter: "blur(20px)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.2), 0 1px 0 rgba(0,0,0,0.06)",
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
            borderBottom: `1px solid ${T.border.line}`,
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
                color: T.ink.base,
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
                  color: T.ink.faint,
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

        {username ? (
          <>
            {/* My profile */}
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-lg focus:bg-(--t-aurora-soft)"
            >
              <Link
                href={`/profile/${username}`}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-(--t-ink-dim) hover:text-(--t-ink-base)"
              >
                <Icon
                  icon="mdi:account-circle-outline"
                  width={15}
                  height={15}
                  className="shrink-0 opacity-60"
                />
                <span>My profile</span>
              </Link>
            </DropdownMenuItem>

            {/* My contributions */}
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-lg focus:bg-(--t-aurora-soft)"
            >
              <Link
                href={`/profile/${username}/contributions`}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-(--t-ink-dim) hover:text-(--t-ink-base)"
              >
                <Icon
                  icon="mdi:book-edit-outline"
                  width={15}
                  height={15}
                  className="shrink-0 opacity-60"
                />
                <span>My contributions</span>
              </Link>
            </DropdownMenuItem>

            {/* Badges & points */}
            <DropdownMenuItem
              asChild
              className="cursor-pointer rounded-lg focus:bg-(--t-aurora-soft)"
            >
              <Link
                href={`/profile/${username}/badges`}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-(--t-ink-dim) hover:text-(--t-ink-base)"
              >
                <Icon
                  icon="mdi:medal-outline"
                  width={15}
                  height={15}
                  className="shrink-0 opacity-60"
                />
                <span>Badges & points</span>
              </Link>
            </DropdownMenuItem>

            {/* Submissions — verified librarians only */}
            {isVerifiedLibrarian && (
              <DropdownMenuItem
                asChild
                className="cursor-pointer rounded-lg focus:bg-(--t-aurora-soft)"
              >
                <Link
                  href="/contribute/submissions"
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-(--t-ink-dim) hover:text-(--t-ink-base)"
                >
                  <Icon
                    icon="mdi:inbox-multiple-outline"
                    width={15}
                    height={15}
                    className="shrink-0 opacity-60"
                  />
                  <span>My submissions</span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: T.font.mono,
                      fontSize: "8px",
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: T.accent.aurora,
                      background: "rgba(127,223,255,0.1)",
                      border: "1px solid rgba(127,223,255,0.2)",
                      borderRadius: "4px",
                      padding: "1px 5px",
                    }}
                  >
                    Librarian
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
          </>
        ) : (
          /* No profile yet — prompt to complete setup */
          <DropdownMenuItem
            asChild
            className="cursor-pointer rounded-lg focus:bg-(--t-aurora-soft)"
          >
            <Link
              href="/profile/settings"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-(--t-ink-dim) hover:text-(--t-ink-base)"
            >
              <Icon
                icon="mdi:account-plus-outline"
                width={15}
                height={15}
                className="shrink-0 opacity-60"
              />
              <span>Complete your profile</span>
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator
          style={{ margin: "4px 0", background: T.border.line }}
        />

        {/* Settings */}
        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg focus:bg-(--t-aurora-soft)"
        >
          <Link
            href="/profile/settings"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-(--t-ink-dim) hover:text-(--t-ink-base)"
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
          style={{ margin: "4px 0", background: T.border.line }}
        />

        {/* Sign out */}
        <DropdownMenuItem
          asChild
          className="cursor-pointer rounded-lg focus:bg-(--t-aurora-soft)"
        >
          <Link
            href="/auth/signout"
            className="flex w-full items-center gap-2.5 px-3 py-2 text-[13px] text-(--t-ink-faint) hover:text-(--t-ink-dim)"
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
