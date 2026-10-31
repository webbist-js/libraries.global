import { ModerationQueueSkeleton } from "@/components/moderation/ModerationQueueSkeleton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/ModerationQueueSkeleton",
  component: ModerationQueueSkeleton,
  args: {},
} satisfies Meta<typeof ModerationQueueSkeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
