import { ReviewThread } from "@/components/moderation/ReviewThread"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { reviewEvents } from "../../fixtures/workspace/moderation"

const meta = {
  title: "Features/Moderation/ReviewThread",
  component: ReviewThread,
  args: { events: reviewEvents },
} satisfies Meta<typeof ReviewThread>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { events: [] } }
