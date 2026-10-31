import { CheckoutButton } from "@/components/billing/CheckoutButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Billing/CheckoutButton",
  component: CheckoutButton,
  args: {
    plan: "pro",
    interval: "month",
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
} satisfies Meta<typeof CheckoutButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const SignedOut: Story = { args: { user: null } }
export const EmailNotVerified: Story = {
  args: {
    user: {
      email: "member@example.invalid",
      verified: false,
      complimentaryPro: false,
    },
  },
}
