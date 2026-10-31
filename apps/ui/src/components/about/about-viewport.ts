/** About animations share the same viewport as their dashboard scroll owner. */
export function aboutViewport(element: HTMLElement) {
  const page = element.closest<HTMLElement>(".dashboard-page")
  const content = page?.querySelector<HTMLElement>(".dashboard-page-body")
  const root =
    content && /auto|scroll/.test(getComputedStyle(content).overflowY)
      ? content
      : page
  const bounds = root?.getBoundingClientRect()
  const toolbar = page?.querySelector<HTMLElement>(".record-toolbar")
  const top = Math.max(
    bounds?.top ?? 0,
    toolbar?.getBoundingClientRect().bottom ?? bounds?.top ?? 0
  )
  const bottom = Math.min(
    window.innerHeight,
    bounds?.bottom ?? window.innerHeight
  )

  return {
    root,
    top,
    bottom,
    height: Math.max(1, bottom - top),
    stickyTop: top - (bounds?.top ?? 0),
  }
}

export function setAboutViewport(element: HTMLElement) {
  const viewport = aboutViewport(element)
  element.style.setProperty("--about-sticky-top", `${viewport.stickyTop}px`)
  element.style.setProperty("--about-stage-height", `${viewport.height}px`)

  return viewport
}
