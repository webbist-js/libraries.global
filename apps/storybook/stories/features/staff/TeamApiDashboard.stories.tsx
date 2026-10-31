import { TeamApiDashboard } from "@/components/staff/TeamApiDashboard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { apiDashboard, staffResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamApiDashboard",
  component: TeamApiDashboard,
  args: { initial: apiDashboard, confirming: false },
  parameters: {
    fixtureResponses: staffResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamApiDashboard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const PendingPayment: Story = {
  args: {
    initial: { ...apiDashboard, active: false, pendingPayment: true },
    confirming: true,
  },
  parameters: { docs: { story: { inline: false } } },
}
export const NoKeys: Story = {
  args: { initial: { ...apiDashboard, keys: [] } },
}
