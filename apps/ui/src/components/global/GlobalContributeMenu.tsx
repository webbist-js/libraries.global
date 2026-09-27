"use client"

import { Icon } from "@iconify/react"

import AppLink from "@/components/elementary/AppLink"
import GlobalLink from "@/components/global/GlobalLink"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useContributorShortcuts } from "@/hooks/useContributorShortcuts"
import type { ContributorShortcut } from "@/lib/contributor-shortcuts"
import { T } from "@/lib/design-tokens"

const PILL =
  "h-9 rounded-full border-0 bg-(--t-accent-primary) px-4 text-[14px] font-semibold text-white transition-colors hover:bg-(--t-accent-primary-hover)"

function ShortcutItem({ item }: { item: ContributorShortcut }) {
  return (
    <DropdownMenuItem
      asChild
      className="cursor-pointer rounded-[12px] p-0 focus:bg-(--t-bg-muted-2) focus:text-(--t-ink-base)"
    >
      <GlobalLink
        href={item.href}
        className="flex w-full items-center gap-3 px-2.5 py-2.5 text-[15px] font-medium"
        style={{ color: T.ink.base }}
      >
        <Icon
          icon={item.icon}
          width={19}
          height={19}
          aria-hidden="true"
          className="shrink-0"
          style={{ color: T.accent.primary }}
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.external ? (
          <>
            <Icon
              icon="mdi:open-in-new"
              width={15}
              height={15}
              aria-hidden="true"
              className="shrink-0"
              style={{ color: T.ink.dim }}
            />
            <span className="sr-only"> (opens the CMS in a new tab)</span>
          </>
        ) : null}
      </GlobalLink>
    </DropdownMenuItem>
  )
}

/**
 * The header's primary action. Everyone gets a Contribute link to the hub;
 * doc editors and library editors get a menu of the exact tools their role
 * unlocks, with the hub as the last item.
 */
export function GlobalContributeMenu({
  className = "",
}: {
  readonly className?: string
}) {
  const groups = useContributorShortcuts()

  if (groups.length === 0) {
    return (
      <AppLink href="/contribute" size="sm" className={`${PILL} ${className}`}>
        Contribute
      </AppLink>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex cursor-pointer items-center gap-1 ${PILL} pr-3 ${className}`}
        >
          Contribute
          <Icon icon="mdi:chevron-down" width={18} height={18} aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[292px] rounded-[20px] border p-2 shadow-none"
        style={{
          background: T.bg.deep,
          borderColor: T.border.line,
          boxShadow: "0 12px 28px rgba(23,22,43,.08)",
        }}
      >
        {groups.map((group, index) => (
          <DropdownMenuGroup key={group.key}>
            {index > 0 ? (
              <DropdownMenuSeparator
                className="mx-1 my-1.5"
                style={{ background: T.border.divider }}
              />
            ) : null}
            <DropdownMenuLabel
              className="px-2.5 pt-2 pb-1 text-[13px] font-semibold"
              style={{ color: T.ink.dim }}
            >
              {group.title}
            </DropdownMenuLabel>
            {group.items.map((item) => (
              <ShortcutItem key={`${item.href}:${item.label}`} item={item} />
            ))}
          </DropdownMenuGroup>
        ))}

        <DropdownMenuSeparator
          className="mx-1 my-1.5"
          style={{ background: T.border.divider }}
        />
        <ShortcutItem
          item={{
            label: "All ways to contribute",
            href: "/contribute",
            icon: "mdi:hand-heart-outline",
          }}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

GlobalContributeMenu.displayName = "GlobalContributeMenu"

export default GlobalContributeMenu
