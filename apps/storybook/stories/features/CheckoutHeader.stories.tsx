import { CheckoutHeader } from "@/components/billing/CheckoutPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Billing/CheckoutHeader",
  component: CheckoutHeader,
  args: { sandbox: true },
} satisfies Meta<typeof CheckoutHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
