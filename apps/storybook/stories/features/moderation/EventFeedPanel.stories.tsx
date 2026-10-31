import { EventFeedPanel } from "@/components/moderation/EventFeedPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Moderation/EventFeedPanel",
  component: EventFeedPanel,
  args: {
    documentId: "example-feed-submission",
    status: "pending",
    review: null,
  },
} satisfies Meta<typeof EventFeedPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
