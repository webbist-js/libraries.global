import { TeamBilling } from "@/components/staff/TeamBilling"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { teamBilling, billingResponses } from "../../fixtures/workspace/staff"

const meta = {
  title: "Features/Staff/TeamBilling",
  component: TeamBilling,
  args: { initial: teamBilling, initialSeats: 5, confirming: false },
  parameters: {
    fixtureResponses: billingResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof TeamBilling>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Confirming: Story = { args: { confirming: true } }
export const Lapsed: Story = {
  args: { initial: { ...teamBilling, active: false } },
}
