import { TeamPurchaseProgress } from "@/components/staff/TeamPurchaseJourney"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamPurchaseProgress",
  component: TeamPurchaseProgress,
  args: { stage: "team" },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamPurchaseProgress>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Api: Story = { args: { stage: "api" } }
export const Complete: Story = { args: { stage: "complete" } }
