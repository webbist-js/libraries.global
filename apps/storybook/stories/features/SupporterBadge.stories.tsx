import { SupporterBadge } from "@/components/community/SupporterBadge"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Community/SupporterBadge",
  component: SupporterBadge,
  args: {},
} satisfies Meta<typeof SupporterBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
