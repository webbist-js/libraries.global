import { TeamApiNextStep } from "@/components/staff/TeamPurchaseJourney"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamApiNextStep",
  component: TeamApiNextStep,
  args: { teamId: "example-team", ready: true, organiser: true },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamApiNextStep>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Waiting: Story = { args: { ready: false } }
