"use client"

import { useEffect, useRef, useState } from "react"

import type { DashboardDestination } from "@/components/dashboard/DashboardPage"
import GlobalLink from "@/components/global/GlobalLink"

/** Reading-page anchors follow the dashboard's scrolling canvas. */
export function InformationNavigation({
  links,
  label,
}: {
  readonly links: readonly DashboardDestination[]
  readonly label: string
}) {
  const nav = useRef<HTMLElement>(null)
  const [active, setActive] = useState<string | null>(null)

  useEffect(() => {
    // Section drawers are portalled outside the page; both renderings track
    // the same canvas. Scroll capture also covers the mobile page container.
    const page =
      nav.current?.closest(".dashboard-page") ??
      document.querySelector(".dashboard-page")
    const canvas = page?.querySelector(".dashboard-page-body")
    if (!page || !canvas) return
    const sections = links.flatMap(({ href }) => {
      const target = href.startsWith("#")
        ? document.getElementById(href.slice(1))
        : null

      return target ? [{ href, target }] : []
    })
    if (!sections.length) return
    let frame = 0
    const update = () => {
      frame = 0
      const toolbar = canvas.querySelector(".record-toolbar")
      const top = (toolbar?.getBoundingClientRect().bottom ?? 0) + 24
      let current: string | null = null
      for (const { target, href } of sections) {
        if (target.getBoundingClientRect().top <= top) current = href
      }
      setActive(current)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    page.addEventListener("scroll", schedule, { capture: true, passive: true })
    window.addEventListener("resize", schedule)
    update()

    return () => {
      page.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
      cancelAnimationFrame(frame)
    }
  }, [links])

  return (
    <nav
      ref={nav}
      className="workspace-navigation information-navigation"
      aria-label={label}
    >
      <p className="information-navigation-label">{label}</p>
      {links.map((link) => (
        <GlobalLink
          key={link.href}
          href={link.href}
          aria-current={active === link.href ? "location" : undefined}
        >
          {link.label}
        </GlobalLink>
      ))}
    </nav>
  )
}
