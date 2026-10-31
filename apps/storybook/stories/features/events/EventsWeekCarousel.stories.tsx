import { EventsWeekCarousel } from "@/components/events/EventsWeekCarousel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventFixtures } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/EventsWeekCarousel",
  component: EventsWeekCarousel,
  args: { events: eventFixtures },
} satisfies Meta<typeof EventsWeekCarousel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { events: [] } }
