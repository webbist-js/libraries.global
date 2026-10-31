import { EventsAgenda } from "@/components/events/EventsAgenda"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventFixtures } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/EventsAgenda",
  component: EventsAgenda,
  args: {
    events: eventFixtures,
    loading: false,
    now: new Date("2026-11-14T08:00:00Z"),
    totalUnfiltered: 2,
  },
} satisfies Meta<typeof EventsAgenda>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { events: [], totalUnfiltered: 0 } }
export const Loading: Story = { args: { events: [], loading: true } }
