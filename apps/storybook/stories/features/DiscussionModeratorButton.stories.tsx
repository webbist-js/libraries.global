import { DiscussionModeratorButton } from "@/components/discussions/DiscussionModeratorButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionModeratorButton",
  component: DiscussionModeratorButton,
  args: { children: "Review message" },
} satisfies Meta<typeof DiscussionModeratorButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
