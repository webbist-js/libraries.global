// @vitest-environment happy-dom
import { useState } from "react"
import { afterEach, expect, it, vi } from "vitest"

import {
  LAYERS,
  LAYER_GROUPS,
  toggleLayer,
  type LayerId,
  type AccessibilityView,
} from "@/components/atlas/atlas.logic"
import { AccessibilityControls } from "@/components/atlas/AtlasAccessibility"
import { AtlasAccessibilityAnalysis } from "@/components/atlas/AtlasAccessibilityAnalysis"
import { AtlasLayersTab } from "@/components/atlas/AtlasLayersTab"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from "@/test/render"

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
const sidebar = {
  tier: "public" as const,
  active: ["pins"] as LayerId[],
  onAccessibilityAnalysis: vi.fn(),
  onToggle: vi.fn(),
  onClear: vi.fn(),
  heatOpacity: 0.7,
  onHeatOpacity: vi.fn(),
  onSignIn: vi.fn(),
  onSeePlans: vi.fn(),
}
it("organises every layer by purpose and keeps unbuilt layers disabled on every plan", () => {
  const { rerender } = render(<AtlasLayersTab {...sidebar} />)
  expect(
    within(screen.getByRole("region", { name: "Locations" })).getByRole(
      "switch",
      { name: "Library locations" }
    )
  ).toBeTruthy()
  expect(
    within(
      screen.getByRole("region", { name: "Patterns and distribution" })
    ).getByRole("switch", { name: "Library density" })
  ).toBeTruthy()
  expect(
    within(
      screen.getByRole("region", { name: "Library characteristics" })
    ).getByRole("button", { name: "Open accessibility analysis" })
  ).toBeTruthy()
  expect(
    within(
      screen.getByRole("region", { name: "Access and coverage" })
    ).getByRole("switch", { name: "Library access (Pro)" })
  ).toBeTruthy()
  expect(
    screen.getByRole("region", { name: "Reference geography" })
  ).toBeTruthy()
  for (const tier of ["public", "free", "pro"] as const) {
    rerender(<AtlasLayersTab {...sidebar} tier={tier} />)
    for (const def of LAYERS.filter((layer) => !layer.ready)) {
      const group = LAYER_GROUPS.find((item) => item.id === def.group)!
      const toggle = within(
        screen.getByRole("region", { name: group.name })
      ).getByRole("switch", {
        name: def.name,
      }) as HTMLButtonElement
      expect(toggle.disabled).toBe(true)
      expect(toggle.getAttribute("aria-checked")).toBe("false")
      fireEvent.click(toggle)
    }
  }
  expect(sidebar.onToggle).not.toHaveBeenCalled()
  expect(sidebar.onSignIn).not.toHaveBeenCalled()
  expect(sidebar.onSeePlans).not.toHaveBeenCalled()
})
it("shows Coming soon without account badges or suggesting an upgrade can unlock it", () => {
  render(<AtlasLayersTab {...sidebar} tier="pro" />)
  expect(screen.queryByText(/Planned layers/)).toBeNull()
  for (const def of LAYERS.filter((layer) => !layer.ready)) {
    const item = screen
      .getByRole("switch", { name: def.name })
      .closest("[data-layer]")! as HTMLElement
    expect(within(item).getByText("Coming soon")).toBeTruthy()
    if (def.tier === "pro") expect(within(item).getByText("Pro")).toBeTruthy()
    expect(within(item).queryByText("Free account")).toBeNull()
  }
  expect(screen.getByText(/Library facts are always free/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Compare plans" }))
  expect(sidebar.onSeePlans).toHaveBeenCalledOnce()
})
it("keeps location pins on and locks both controls while a marker layer needs them", () => {
  function Harness() {
    const [active, setActive] = useState<LayerId[]>([])

    return (
      <AtlasLayersTab
        {...sidebar}
        tier="free"
        active={active}
        onToggle={(id) =>
          setActive((current) => toggleLayer(current, id).layers)
        }
        onClear={() => setActive([])}
      />
    )
  }
  render(<Harness />)
  const pins = () =>
    screen.getByRole("switch", {
      name: "Library locations",
    }) as HTMLButtonElement
  expect(pins().disabled).toBe(false)
  expect(pins().getAttribute("aria-checked")).toBe("false")
  fireEvent.click(screen.getByRole("switch", { name: "Accessibility" }))
  expect(pins().getAttribute("aria-checked")).toBe("true")
  expect(pins().disabled).toBe(true)
  expect(screen.getByText("Needed by Accessibility")).toBeTruthy()
  expect(pins().getAttribute("aria-describedby")).toBe("atlas-pins-required")
  const quickDisable = screen.getByRole("button", {
    name: "Disable Library locations",
  }) as HTMLButtonElement
  expect(quickDisable.disabled).toBe(true)
  fireEvent.click(quickDisable)
  fireEvent.click(pins())
  expect(pins().getAttribute("aria-checked")).toBe("true")

  fireEvent.click(screen.getByRole("switch", { name: "Record completeness" }))
  expect(pins().disabled).toBe(true)
  expect(screen.getByText("Needed by Record completeness")).toBeTruthy()
  expect(
    screen
      .getByRole("switch", { name: "Accessibility" })
      .getAttribute("aria-checked")
  ).toBe("false")
  fireEvent.click(screen.getByRole("switch", { name: "Record completeness" }))
  expect(pins().disabled).toBe(false)
  expect(pins().getAttribute("aria-checked")).toBe("true")
  expect(pins().hasAttribute("aria-describedby")).toBe(false)
  fireEvent.click(pins())
  expect(pins().getAttribute("aria-checked")).toBe("false")

  fireEvent.click(screen.getByRole("switch", { name: "Opening hours" }))
  expect(pins().disabled).toBe(true)
  expect(pins().getAttribute("aria-checked")).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "Clear layers" }))
  expect(screen.getByText("None on")).toBeTruthy()
  expect(pins().disabled).toBe(false)
  expect(pins().getAttribute("aria-checked")).toBe("false")
})
it("opens the analysis panel for signed-out readers without an inline dropdown or sign-in redirect", () => {
  render(<AtlasLayersTab {...sidebar} />)
  fireEvent.click(
    screen.getByRole("button", { name: "Open accessibility analysis" })
  )
  fireEvent.click(screen.getByRole("switch", { name: /Accessibility/ }))
  expect(sidebar.onAccessibilityAnalysis).toHaveBeenCalledTimes(2)
  expect(sidebar.onSignIn).not.toHaveBeenCalled()
  expect(screen.queryByRole("checkbox")).toBeNull()
})
it("lets signed-out visitors browse and search the analysis, while applying features still needs sign-in", () => {
  const onSelected = vi.fn(),
    onEnable = vi.fn(),
    onSignIn = vi.fn()
  render(
    <AtlasAccessibilityAnalysis
      tier="public"
      enabled={false}
      libraries={[]}
      selected={[]}
      view="matches"
      coverage={null}
      scope="Records in view"
      serverOptions={[
        { name: "Hearing loop", count: 7 },
        { name: "Quiet room", count: 2 },
      ]}
      onSelected={onSelected}
      onView={() => {}}
      onEnable={onEnable}
      onSignIn={onSignIn}
      collapsed={false}
      onClose={() => {}}
      onCollapse={() => {}}
    />
  )
  expect(screen.getByRole("heading", { name: "Accessibility" })).toBeTruthy()
  const catalogue = screen.getByText(/All 2 features/).closest("details")!
  expect(catalogue.open).toBe(false)
  fireEvent.click(screen.getByText(/All 2 features/))
  expect(catalogue.open).toBe(true)
  expect(screen.getAllByText("7").length).toBeGreaterThan(0)
  expect(screen.queryByText("Loading library records…")).toBeNull()
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a feature" }), {
    target: { value: "quiet" },
  })
  expect(screen.queryByRole("checkbox", { name: /Hearing loop/ })).toBeNull()
  fireEvent.click(screen.getByRole("checkbox", { name: /Quiet room/ }))
  expect(onSignIn).toHaveBeenCalledOnce()
  expect(onSelected).not.toHaveBeenCalled()
  expect(onEnable).not.toHaveBeenCalled()
})
it("counts pins and mobile routes separately and keeps route controls independent", async () => {
  function Harness() {
    const [active, setActive] = useState<LayerId[]>(["pins", "mobile"])
    const [lines, setLines] = useState(true)
    const [opacity, setOpacity] = useState(1)

    return (
      <AtlasLayersTab
        tier="free"
        active={active}
        onAccessibilityAnalysis={() => {}}
        onToggle={(id) =>
          setActive((current) =>
            current.includes(id)
              ? current.filter((layer) => layer !== id)
              : [...current, id]
          )
        }
        onClear={() => setActive([])}
        heatOpacity={0.7}
        onHeatOpacity={() => {}}
        onSignIn={() => {}}
        onSeePlans={() => {}}
        mobileRouteLines={lines}
        onMobileRouteLines={setLines}
        mobileOpacity={opacity}
        onMobileOpacity={setOpacity}
      />
    )
  }
  render(<Harness />)
  expect(screen.getByText("2 on")).toBeTruthy()
  expect(
    screen.queryByRole("checkbox", { name: "Show route lines" })
  ).toBeNull()
  fireEvent.click(
    within(screen.getByRole("region", { name: "Locations" })).getByRole(
      "button",
      { name: "Configure Mobile library routes" }
    )
  )
  fireEvent.click(screen.getByRole("checkbox", { name: "Show route lines" }))
  expect(
    (
      screen.getByRole("checkbox", {
        name: "Show route lines",
      }) as HTMLInputElement
    ).checked
  ).toBe(false)
  expect(
    screen
      .getByRole("switch", { name: "Mobile library routes" })
      .getAttribute("aria-checked")
  ).toBe("true")
  fireEvent.change(
    screen.getByRole("slider", { name: "Mobile layer opacity" }),
    { target: { value: "35" } }
  )
  expect(screen.getByText(/35%/)).toBeTruthy()
  fireEvent.click(screen.getByRole("button", { name: "Clear layers" }))
  expect(screen.getByText("None on")).toBeTruthy()
  expect(
    screen.queryByRole("slider", { name: "Mobile layer opacity" })
  ).toBeNull()
  expect(
    screen
      .getByRole("switch", { name: "Library locations" })
      .getAttribute("aria-checked")
  ).toBe("false")
})
it("does not present an empty or loading population as 100% missing data", () => {
  const { rerender } = render(
    <AccessibilityControls
      view="gaps"
      onChange={() => {}}
      coverage={null}
      scope="Records in view"
    />
  )
  expect(screen.getByText("Loading library records…")).toBeTruthy()
  rerender(
    <AccessibilityControls
      view="gaps"
      onChange={() => {}}
      coverage={{ total: 0, matches: 0, unconfirmed: 0, partial: 0 }}
      scope="Records in view"
    />
  )
  expect(screen.getByText("No library records in this map area.")).toBeTruthy()
  expect(screen.queryByRole("status")).toBeNull()
})
it("lets readers independently select hearing support and quiet spaces from the CMS catalogue", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      Response.json({
        data: [
          { name: "Hearing loop" },
          { name: "Quiet room" },
          { name: "Step-free access" },
        ],
      })
    )
  )
  function Harness() {
    const [active, setActive] = useState<LayerId[]>([]),
      [selected, setSelected] = useState<string[]>([]),
      [view, setView] = useState<AccessibilityView>("matches")

    return (
      <AtlasAccessibilityAnalysis
        tier="free"
        enabled={active.includes("access")}
        libraries={[]}
        selected={selected}
        view={view}
        onView={setView}
        coverage={{ total: 4, matches: 1, partial: 1, unconfirmed: 3 }}
        scope="Records in view"
        onSelected={setSelected}
        onEnable={() => setActive(["access"])}
        onSignIn={() => {}}
        collapsed={false}
        onCollapse={() => {}}
        onClose={() => {}}
      />
    )
  }
  render(<Harness />)
  await waitFor(() => expect(screen.getByText(/All 3 features/)).toBeTruthy())
  fireEvent.click(screen.getByText(/All 3 features/))
  fireEvent.click(screen.getByRole("checkbox", { name: /Hearing loop/ }))
  fireEvent.click(screen.getByRole("checkbox", { name: /Quiet room/ }))
  const hearing = () =>
    screen.getByRole("checkbox", { name: /Hearing loop/ }) as HTMLInputElement
  const quiet = () =>
    screen.getByRole("checkbox", { name: /Quiet room/ }) as HTMLInputElement
  expect(hearing().checked).toBe(true)
  expect(quiet().checked).toBe(true)
  expect(
    (
      screen.getByRole("checkbox", {
        name: /Step-free access/,
      }) as HTMLInputElement
    ).checked
  ).toBe(false)
  expect(screen.getByText("25%")).toBeTruthy()
  expect(
    screen.getByRole("region", { name: "Accessibility coverage" }).textContent
  ).toContain("of 4 libraries")
  fireEvent.click(screen.getByRole("button", { name: "Both" }))
  expect(
    screen.getByRole("button", { name: "Both" }).getAttribute("aria-pressed")
  ).toBe("true")
  fireEvent.click(screen.getByRole("button", { name: "Not yet" }))
  expect(
    screen.getByRole("button", { name: "Not yet" }).getAttribute("aria-pressed")
  ).toBe("true")
  expect(hearing().checked).toBe(true)
  expect(quiet().checked).toBe(true)
  fireEvent.click(screen.getByRole("button", { name: "Recorded" }))
  fireEvent.click(screen.getByRole("button", { name: "Clear chosen features" }))
  expect(hearing().checked).toBe(false)
  expect(quiet().checked).toBe(false)
})
it("uses one active state for quick disable, catalogue switches and exclusive visualisations", () => {
  function Harness() {
    const [active, setActive] = useState<LayerId[]>(["pins", "density"])

    return (
      <AtlasLayersTab
        {...sidebar}
        tier="free"
        active={active}
        onToggle={(id) =>
          setActive((current) => toggleLayer(current, id).layers)
        }
      />
    )
  }
  render(<Harness />)
  fireEvent.click(screen.getByRole("switch", { name: "Events density" }))
  expect(
    screen.queryByRole("button", { name: "Disable Library density" })
  ).toBeNull()
  expect(
    screen.getByRole("button", { name: "Disable Events density" })
  ).toBeTruthy()
  expect(
    screen
      .getByRole("switch", { name: "Library density" })
      .getAttribute("aria-checked")
  ).toBe("false")
  fireEvent.click(
    screen.getByRole("button", { name: "Disable Events density" })
  )
  expect(
    screen
      .getByRole("switch", { name: "Events density" })
      .getAttribute("aria-checked")
  ).toBe("false")
  expect(
    screen
      .getByRole("switch", { name: "Library locations" })
      .getAttribute("aria-checked")
  ).toBe("true")
})
