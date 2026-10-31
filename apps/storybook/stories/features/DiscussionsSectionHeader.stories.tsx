import { DiscussionsSectionHeader } from "@/components/discussions/DiscussionsSectionHeader"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Discussions/DiscussionsSectionHeader",
  component: DiscussionsSectionHeader,
  args: {},
} satisfies Meta<typeof DiscussionsSectionHeader>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
