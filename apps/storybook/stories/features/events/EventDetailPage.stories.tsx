import { EventDetailPage } from "@/components/events/EventDetailPage"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventFixture, eventResponses } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/EventDetailPage",
  component: EventDetailPage,
  args: {
    event: eventFixture,
    related: [eventFixture],
    libraryName: "Northbridge Library",
  },
  parameters: {
    fixtureResponses: eventResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof EventDetailPage>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Cancelled: Story = {
  args: { event: { ...eventFixture, status: "cancelled" } },
}
