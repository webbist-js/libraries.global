// @vitest-environment happy-dom
import {
  defaultWidgetConfig,
  type TeamWidget,
  type WidgetResolved,
} from "@repo/shared-data"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WidgetPublish } from "@/components/widgets/WidgetPublish"
import type { WidgetWorkspace } from "@/lib/widgets/client"
import { cleanup, render, screen } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
afterEach(cleanup)
const workspace = { team: { active: true, organiser: true } } as WidgetWorkspace
const resolved = {
  rows: [{ documentId: "one", name: "One library" }],
  diagnostics: {
    selected: 1,
    mapped: 0,
    missingCoordinates: 1,
    missingHours: 0,
    licenceIssues: [],
  },
} as unknown as WidgetResolved
const widget = (mapMode: "map" | "both" | "list") =>
  ({
    documentId: "one",
    type: "finder",
    config: { ...defaultWidgetConfig(), mapMode },
    origins: ["https://example.org"],
    publishedVersion: 0,
    release: null,
    selection: null,
  }) as unknown as TeamWidget

describe("publication readiness", () => {
  it.each(["both", "list"] as const)(
    "keeps unmapped records publishable in %s presentation",
    (mode) => {
      render(
        <WidgetPublish
          workspace={workspace}
          widget={widget(mode)}
          resolved={resolved}
          resolving={false}
          onAction={vi.fn()}
          busy={false}
          siteUrl=""
        />
      )
      expect(
        (
          screen.getByRole("button", {
            name: "Publish version 1",
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
      expect(screen.getByText(/1 library missing coordinates/)).toBeTruthy()
    }
  )
  it("requires mapped data for a map-only finder, matching the Strapi check", () => {
    render(
      <WidgetPublish
        workspace={workspace}
        widget={widget("map")}
        resolved={resolved}
        resolving={false}
        onAction={vi.fn()}
        busy={false}
        siteUrl=""
      />
    )
    expect(
      (
        screen.getByRole("button", {
          name: "Publish version 1",
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      screen.getByText(/A map-only finder needs a mapped library/)
    ).toBeTruthy()
  })
})
