"use client"

import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react"

function stickyDimensions(header: number, navigation: number): CSSProperties {
  const top = header + navigation + 24

  return {
    "--sticky-header-height": `${header}px`,
    "--sticky-navigation-height": `${navigation}px`,
    "--sticky-content-top": `${top}px`,
    "--sticky-content-max-height": `calc(100dvh - ${top + 24}px)`,
  } as CSSProperties
}
const INITIAL_DIMENSIONS = stickyDimensions(57, 0)
const NAVIGATION_SELECTOR = "[data-global-header], [data-sticky-navigation]"
function containsNavigation(node: Node) {
  return (
    node instanceof Element &&
    (node.matches(NAVIGATION_SELECTOR) ||
      node.querySelector(NAVIGATION_SELECTOR))
  )
}

/** Share the measured header/subnav clearance with every sticky rail on a page. */
export function StickyPageLayout({
  children,
  className,
  id,
}: {
  readonly children: ReactNode
  readonly className?: string
  readonly id?: string
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const measure = () => {
      const headerHeight = Math.max(
        0,
        ...Array.from(
          root.querySelectorAll<HTMLElement>("[data-global-header]")
        ).map((node) => node.getBoundingClientRect().height)
      )
      const navigationHeight = Array.from(
        root.querySelectorAll<HTMLElement>("[data-sticky-navigation]")
      ).reduce(
        (height, node) => height + node.getBoundingClientRect().height,
        0
      )
      for (const [property, value] of Object.entries(
        stickyDimensions(headerHeight, navigationHeight)
      ))
        root.style.setProperty(property, value)
    }

    const resize = new ResizeObserver(measure)
    const observe = () => {
      resize.disconnect()
      for (const node of root.querySelectorAll(NAVIGATION_SELECTOR))
        resize.observe(node)
      measure()
    }
    // Server content streams in after hydration; route changes can remove a
    // submenu. Reconnect only when a navigation element enters or leaves.
    const mutations = new MutationObserver((records) => {
      const navigationChanged = records.some((record) =>
        [...record.addedNodes, ...record.removedNodes].some(containsNavigation)
      )
      if (navigationChanged) observe()
    })
    observe()
    mutations.observe(root, { childList: true, subtree: true })

    return () => {
      mutations.disconnect()
      resize.disconnect()
    }
  }, [])

  return (
    <div
      ref={rootRef}
      id={id}
      className={className}
      style={INITIAL_DIMENSIONS}
      data-sticky-page=""
    >
      {children}
    </div>
  )
}
