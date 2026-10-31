import { ApiUsagePanel } from "@/components/staff/TeamApiPanels"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { apiDashboard, billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/ApiUsagePanel",
  component: ApiUsagePanel,
  args: { data: apiDashboard, locale: "en" },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof ApiUsagePanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
