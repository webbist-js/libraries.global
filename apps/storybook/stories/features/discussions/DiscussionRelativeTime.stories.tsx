import { DiscussionRelativeTime } from "@/components/discussions/DiscussionPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionRelativeTime",
  component: DiscussionRelativeTime,
  args: { value: "2026-01-15T10:00:00Z" },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof DiscussionRelativeTime>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
