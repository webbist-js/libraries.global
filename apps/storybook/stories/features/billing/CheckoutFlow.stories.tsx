import { CheckoutFlow } from "@/components/billing/CheckoutFlow"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Billing/CheckoutFlow",
  component: CheckoutFlow,
  args: {
    user: {
      email: "member@example.invalid",
      verified: true,
      complimentaryPro: false,
    },
  },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof CheckoutFlow>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { user: null } }
