import { UpcomingEventsWidget } from "@/components/events/UpcomingEventsWidget"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventFixtures } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/UpcomingEventsWidget",
  component: UpcomingEventsWidget,
  args: { events: eventFixtures },
} satisfies Meta<typeof UpcomingEventsWidget>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { events: [] } }
