import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { Button } from "@/components/ui/button"
import { WidgetsOverview } from "@/components/widgets/WidgetsOverview"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn } from "storybook/test"

import { widgetWorkspace } from "../fixtures/widgets"

const meta = {
  title: "Features/Widgets/Overview",
  component: WidgetsOverview,
  args: { initial: widgetWorkspace },
  argTypes: { initial: { control: "object" } },
  decorators: [
    (Story) => (
      <div className="dashboard-page-body">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Production overview and page header with synthetic widget data. Source guidance is interactive; catalogue searches and writes require explicit service fixtures and remain blocked by the preview fetch guard.",
      },
    },
  },
  render: (args) => (
    <div className="workspace-page-content widgets-story space-y-6 bg-(--t-bg-space) p-6">
      <WorkspacePageHeader
        title="Widgets"
        context={args.initial.team.name}
        lead="Create and publish widgets using public library data."
        actions={
          args.initial.team.active ? (
            <Button variant="primary" size="pill" onClick={fn()}>
              Create widget
            </Button>
          ) : undefined
        }
      />
      <WidgetsOverview key={JSON.stringify(args.initial)} {...args} />
    </div>
  ),
} satisfies Meta<typeof WidgetsOverview>

export default meta
type Story = StoryObj<typeof meta>

export const DraftAndPublished: Story = {}
export const SourceGuidance: Story = {
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText("Change default source"))
    await expect(
      canvas.getByText(/Management access is reviewed separately/)
    ).toBeVisible()
    await expect(
      canvas.getAllByRole("link", { name: "Edit widget" })
    ).toHaveLength(2)
    await expect(
      canvas.getAllByRole("link", {
        name: "Publishing & websites",
      })
    ).toHaveLength(2)
  },
}
export const Empty: Story = {
  args: { initial: { ...widgetWorkspace, widgets: [], selections: [] } },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Create widget" })
    ).toBeVisible()
    await expect(
      canvas.getByText("Put your library data to work")
    ).toBeVisible()
  },
}
export const InactiveTeam: Story = {
  args: {
    initial: {
      ...widgetWorkspace,
      team: { ...widgetWorkspace.team, active: false },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Your Team is inactive")).toBeVisible()
    await expect(
      canvas.queryByRole("button", { name: "Create widget" })
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByText("Change default source")
    ).not.toBeInTheDocument()
  },
}
export const Member: Story = {
  args: {
    initial: {
      ...widgetWorkspace,
      team: { ...widgetWorkspace.team, organiser: false },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByText("Change default source")
    ).not.toBeInTheDocument()
    await expect(
      canvas.getAllByRole("link", { name: "Edit widget" })
    ).toHaveLength(2)
  },
}
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 360, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const overview = canvasElement.querySelector(".widgets-story")!
    await expect(overview.scrollWidth).toBeLessThanOrEqual(
      overview.clientWidth + 1
    )
  },
}
