import { CheckoutSteps } from "@/components/billing/CheckoutPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Billing/CheckoutSteps",
  component: CheckoutSteps,
  args: { step: "plan" },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof CheckoutSteps>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Details: Story = { args: { step: "details" } }
