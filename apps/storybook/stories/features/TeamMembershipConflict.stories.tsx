import { TeamMembershipConflict } from "@/components/staff/TeamMembershipConflict"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Staff/TeamMembershipConflict",
  component: TeamMembershipConflict,
  args: {},
} satisfies Meta<typeof TeamMembershipConflict>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
