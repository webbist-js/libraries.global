import { StatusBadge } from "@/components/moderation/StatusBadge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/StatusBadge",
  component: StatusBadge,
  args: { status: "pending" },
} satisfies Meta<typeof StatusBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Approved: Story = { args: { status: "approved" } }
export const NeedsInformation: Story = { args: { status: "needs_info" } }
export const Rejected: Story = { args: { status: "rejected" } }
