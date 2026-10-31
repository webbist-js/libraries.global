import { DiscussionPreview } from "@/components/discussions/DiscussionPresentation"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { thread, subject } from "../../fixtures/workspace/discussions"

const meta = {
  title: "Features/Discussions/DiscussionPreview",
  component: DiscussionPreview,
  args: { record: thread, subject },
} satisfies Meta<typeof DiscussionPreview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Pinned: Story = { args: { record: { ...thread, pinned: true } } }
export const Locked: Story = { args: { record: { ...thread, locked: true } } }
