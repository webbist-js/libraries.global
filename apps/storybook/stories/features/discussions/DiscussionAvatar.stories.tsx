import { DiscussionAvatar } from "@/components/discussions/DiscussionPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { thread } from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionAvatar",
  component: DiscussionAvatar,
  args: { author: thread.author, colourful: true, size: "md" },
  parameters: { docs: { story: { inline: false, height: "900px" } } },
} satisfies Meta<typeof DiscussionAvatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Anonymous: Story = { args: { author: null } }
export const Small: Story = { args: { size: "sm" } }
