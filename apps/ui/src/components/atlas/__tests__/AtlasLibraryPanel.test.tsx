// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest"

import { cleanup, render, screen } from "@/test/render"

import type { AtlasLibrary } from "../atlas.logic"
import { AtlasInspect } from "../AtlasInspect"
import { AtlasLibraryPanel } from "../AtlasLibraryPanel"

vi.mock("@/components/global/GlobalLink", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
it("keeps full-record and editor actions visible outside the scrolling details, including while loading", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {}))
  )
  const library: AtlasLibrary = {
    id: "panel-actions",
    name: "Village Library",
    slug: "village-library",
    path: "/europe/england/region/village-library",
    type: "Public",
    status: "open",
    operator: null,
    city: "Village",
    region: "Region",
    country: "England",
    tz: null,
    hours: null,
    founded: null,
    closed: null,
    events: false,
    catalogue: false,
    access: [],
    services: [],
    complete: 25,
    lat: 51,
    lng: 0,
  }
  render(
    <AtlasInspect
      entries={[
        {
          id: "library",
          label: "Library",
          title: library.name,
          detail: "Public library",
          content: <AtlasLibraryPanel library={library} onClose={vi.fn()} />,
        },
      ]}
      active="library"
      minimised={false}
      onSelect={vi.fn()}
      onMinimise={vi.fn()}
      onRemove={vi.fn()}
    />
  )
  const view = screen.getByRole("link", { name: "View library" })
  const improve = screen.getByRole("link", {
    name: "Improve this record",
  })
  expect(view.getAttribute("href")).toBe(library.path)
  expect(improve.getAttribute("href")).toBe("/contribute/index/village-library")
  expect(view.closest('[role="tabpanel"]')).toBeNull()
  expect(improve.closest('[role="tabpanel"]')).toBeNull()
})
