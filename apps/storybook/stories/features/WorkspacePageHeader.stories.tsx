import { DashboardOverlayContext } from "@/components/dashboard/DashboardOverlayContext"
import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { SectionTabs } from "@/components/ds/SectionTabs"
import { TeamStatusBadges } from "@/components/staff/TeamStatusBadges"
import { Button } from "@/components/ui/button"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect, fn } from "storybook/test"

const tabs = (
  <SectionTabs
    label="Example staff sections"
    activeId="libraries"
    tabs={[
      { id: "libraries", label: "Your libraries", href: "#libraries" },
      { id: "members", label: "Members & libraries", href: "#members" },
    ]}
  />
)
const breadcrumb = [
  { label: "Staff area", href: "#staff" },
  { label: "Your libraries" },
]
const meta = {
  title: "Features/Dashboard/WorkspacePageHeader",
  component: WorkspacePageHeader,
  args: {
    title: "Your libraries",
    lead: "Publish record changes, answer suggestions and post notices for the libraries you run.",
    density: "page",
  },
  argTypes: {
    density: { control: "radio", options: ["page", "task"] },
    context: { control: "text" },
    status: { control: false },
    actions: { control: false },
    tabs: { control: false },
  },
  decorators: [
    (Story) => (
      <div className="dashboard-page-body">
        <div className="workspace-page-content bg-(--t-bg-space) p-6">
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WorkspacePageHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Page: Story = {}
export const Task: Story = {
  args: {
    title: "Create a widget",
    lead: "Choose a format and the public library data it uses.",
    density: "task",
  },
}
export const TeamContextAndAction: Story = {
  args: {
    title: "Widgets",
    context: "Example Library Team",
    actions: (
      <Button variant="primary" size="pill" onClick={fn()}>
        Create widget
      </Button>
    ),
  },
}
export const IndependentStatuses: Story = {
  args: {
    title: "Members & libraries",
    context: "Example Library Team",
    status: <TeamStatusBadges membership="active" verified={false} />,
  },
}
export const StandaloneNavigation: Story = {
  args: { breadcrumb, tabs },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("navigation", { name: "Breadcrumb" })
    ).toBeVisible()
    await expect(
      canvas.getByRole("navigation", { name: "Example staff sections" })
    ).toBeVisible()
  },
}
export const DashboardOwnsNavigation: Story = {
  args: { breadcrumb, tabs },
  decorators: [
    (Story) => (
      <DashboardOverlayContext.Provider
        value={{
          panel: null,
          trigger: null,
          handleToggle: fn(),
          handleClose: fn(),
        }}
      >
        <Story />
      </DashboardOverlayContext.Provider>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Your libraries" })
    ).toBeVisible()
    await expect(
      canvas.queryByRole("navigation", { name: "Breadcrumb" })
    ).not.toBeInTheDocument()
    await expect(
      canvas.queryByRole("navigation", { name: "Example staff sections" })
    ).not.toBeInTheDocument()
  },
}
export const NarrowLongTitle: Story = {
  args: {
    title: "Example Archive, Research and Community Library Team",
    context:
      "A long organisation name that wraps without truncating its identity",
    actions: (
      <Button variant="primary" size="pill" onClick={fn()}>
        Create widget
      </Button>
    ),
  },
  decorators: [
    (Story) => (
      <div style={{ width: 320, maxWidth: "100%" }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const header = canvasElement.querySelector(".workspace-page-header")!
    await expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth + 1)
  },
}
export const LiteralUserTitle: Story = {
  args: { title: "Example *literal* library name" },
  play: async ({ canvas }) => {
    const title = canvas.getByRole("heading", { level: 1 })
    await expect(title).toHaveTextContent("Example *literal* library name")
    await expect(title.querySelector("em")).toBeNull()
  },
}
