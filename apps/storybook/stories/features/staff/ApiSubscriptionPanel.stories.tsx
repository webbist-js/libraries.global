import { ApiSubscriptionPanel } from "@/components/staff/TeamApiPanels"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { apiDashboard, billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/ApiSubscriptionPanel",
  component: ApiSubscriptionPanel,
  args: {
    data: apiDashboard,
    locale: "en",
    pending: false,
    error: "",
    clearError: fn(),
    request: fn(),
    confirming: false,
  },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ApiSubscriptionPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
