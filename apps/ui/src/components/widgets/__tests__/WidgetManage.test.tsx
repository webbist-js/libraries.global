// @vitest-environment happy-dom
import { defaultWidgetConfig, type TeamWidget } from "@repo/shared-data"
import type { ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { WidgetManage } from "@/components/widgets/WidgetManage"
import type { WidgetWorkspace } from "@/lib/widgets/client"
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render"

vi.mock("@iconify/react", () => ({ Icon: () => null }))
vi.mock("@/lib/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock("@/components/widgets/WidgetPublish", () => ({
  OriginEditor: () => null,
  WidgetEmbed: () => null,
}))
afterEach(cleanup)
const widget = {
  documentId: "draft",
  state: "draft",
  name: "Comparison",
  type: "chart",
  config: defaultWidgetConfig(),
  publishedVersion: 0,
  history: [],
  origins: [],
  loads: 0,
  blockedReports: 0,
} as unknown as TeamWidget
const workspace = { team: { active: true, organiser: true } } as WidgetWorkspace

describe("widget lifecycle controls", () => {
  it("offers useful next steps for a draft and hides publication-only actions", () => {
    render(
      <WidgetManage
        workspace={workspace}
        widget={widget}
        onAction={vi.fn()}
        busy={false}
        siteUrl=""
      />
    )
    expect(
      screen.getByRole("link", { name: "Review and publish the draft" })
    ).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Pause widget" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Unpublish" })).toBeNull()
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy()
  })
  it("requires confirmation before pausing a live widget", async () => {
    const action = vi.fn().mockResolvedValue(undefined)
    render(
      <WidgetManage
        workspace={workspace}
        widget={{ ...widget, state: "live", publishedVersion: 1 }}
        onAction={action}
        busy={false}
        siteUrl=""
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Pause widget" }))
    expect(action).not.toHaveBeenCalled()
    expect(
      screen.getByRole("heading", { name: "Pause this widget?" })
    ).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }))
    await waitFor(() => expect(action).toHaveBeenCalledWith("pause", undefined))
  })
  it("keeps lifecycle and website changes unavailable to members", () => {
    render(
      <WidgetManage
        workspace={{
          ...workspace,
          team: { ...workspace.team, organiser: false },
        }}
        widget={{ ...widget, state: "live", publishedVersion: 1 }}
        onAction={vi.fn()}
        busy={false}
        siteUrl=""
      />
    )
    expect(screen.queryByRole("button", { name: "Pause widget" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull()
    expect(
      screen.queryByRole("button", { name: "Save allowed websites" })
    ).toBeNull()
  })
})
