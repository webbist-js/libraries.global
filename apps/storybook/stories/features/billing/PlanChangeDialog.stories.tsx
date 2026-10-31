import { PlanChangeDialog } from "@/components/billing/PlanChangeDialog"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Billing/PlanChangeDialog",
  component: PlanChangeDialog,
  args: { plan: "pro", interval: "year" },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof PlanChangeDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
