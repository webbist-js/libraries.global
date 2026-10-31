import { TeamApiSubscribeDialog } from "@/components/staff/TeamApiSubscribeDialog"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { apiDashboard, billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamApiSubscribeDialog",
  component: TeamApiSubscribeDialog,
  args: {
    data: { ...apiDashboard, active: false, membership: null },
    locale: "en",
    pending: false,
    error: "",
    clearError: fn(),
    request: fn(),
  },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamApiSubscribeDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
