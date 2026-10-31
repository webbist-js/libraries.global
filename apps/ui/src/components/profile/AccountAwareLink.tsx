"use client"

import { useRef, type ComponentProps } from "react"

import { useHydratedSession } from "@/lib/access-client"
import { dashboardDirection } from "@/lib/dashboard-navigation"
import { NavigationLink, usePathname } from "@/lib/navigation-core"
import { openProfileDrawer, profileSectionForHref } from "@/lib/profile-drawer"

export type AccountAwareLinkProps = ComponentProps<typeof NavigationLink> & {
  readonly publicProfile?: boolean
}

export function AccountAwareLink({
  publicProfile = false,
  ...props
}: AccountAwareLinkProps) {
  const pathname = usePathname()
  const href =
    typeof props.href === "string" ? props.href : (props.href.pathname ?? "")
  const direction = pathname ? dashboardDirection(pathname, href) : null
  const forwarded = {
    ...props,
    transitionTypes:
      props.transitionTypes ?? (direction ? [direction] : undefined),
    onNavigate: (event: { preventDefault: () => void }) => {
      let prevented = false
      props.onNavigate?.({
        preventDefault: () => {
          prevented = true
          event.preventDefault()
        },
      })
      if (!prevented)
        window.dispatchEvent(
          new CustomEvent("dashboard-before-navigation", { detail: { href } })
        )
    },
  }
  if (!publicProfile && href.startsWith("/profile"))
    return <ProfileActionLink {...forwarded} />

  return <NavigationLink {...forwarded} />
}

function ProfileActionLink({
  onNavigate,
  ...props
}: ComponentProps<typeof NavigationLink>) {
  const { data } = useHydratedSession()
  const trigger = useRef<HTMLAnchorElement | null>(null)
  const href =
    typeof props.href === "string" ? props.href : (props.href.pathname ?? "")
  const target = profileSectionForHref(href, data?.user?.username)
  const destination = target
    ? `/map?account=${target.section}${target.anchor ? `#${target.anchor}` : ""}`
    : props.href

  return (
    <NavigationLink
      {...props}
      href={destination}
      onClick={(event) => {
        props.onClick?.(event)
        trigger.current = event.currentTarget
      }}
      onNavigate={(event) => {
        if (!target || !data?.user) {
          onNavigate?.(event)

          return
        }
        event.preventDefault()
        openProfileDrawer(
          target.section,
          data.user.id,
          trigger.current,
          target.anchor
        )
      }}
    />
  )
}
