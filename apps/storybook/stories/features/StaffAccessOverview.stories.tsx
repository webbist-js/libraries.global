import { WorkspacePageHeader } from "@/components/dashboard/WorkspaceHero"
import { StaffAccessRequests } from "@/components/staff/StaffAccessRequests"
import { StaffPanel } from "@/components/staff/StaffPanel"
import { TeamSeatUsage } from "@/components/staff/TeamSeatUsage"
import { TeamStatusBadges } from "@/components/staff/TeamStatusBadges"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { expect } from "storybook/test"

import { staffAccessRequests } from "../fixtures/staff"

const meta = {
  title: "Features/Staff/Access overview",
  component: StaffAccessRequests,
  args: { requests: staffAccessRequests, unavailable: false },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="dashboard-page-body">
        <Story />
      </div>
    ),
  ],
  render: (args) => (
    <div className="workspace-page-content space-y-6 bg-(--t-bg-space) p-6">
      <WorkspacePageHeader
        title="Your libraries"
        lead="Approved staff access and access requests appear here."
      />
      <div className="staff-overview-grid">
        <StaffAccessRequests {...args} />
        <StaffPanel title="Example Library Team" compact>
          <TeamStatusBadges membership="active" verified={false} />
          <div className="mt-5">
            <TeamSeatUsage used={1} total={5} />
          </div>
        </StaffPanel>
      </div>
    </div>
  ),
} satisfies Meta<typeof StaffAccessRequests>

export default meta
type Story = StoryObj<typeof meta>

export const ActiveTeamWithPendingLibraryAccess: Story = {
  globals: { locale: "en" },
  play: async ({ canvas }) => {
    await expect(canvas.getByText("Team membership: Active")).toBeVisible()
    await expect(
      canvas.getByText("Team verification: Not verified")
    ).toBeVisible()
    await expect(
      canvas.getByText("Library access: Awaiting review")
    ).toBeVisible()
    await expect(
      canvas.queryByText("Library access: Approved")
    ).not.toBeInTheDocument()
  },
}
export const RequestsUnavailable: Story = {
  args: { requests: [], unavailable: true },
}
