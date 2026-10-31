import { FeedTestButton } from "@/components/moderation/FeedTestButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/FeedTestButton",
  component: FeedTestButton,
  args: { documentId: "example-feed-submission" },
} satisfies Meta<typeof FeedTestButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
