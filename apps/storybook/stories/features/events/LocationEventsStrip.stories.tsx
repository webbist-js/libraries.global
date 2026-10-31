import { LocationEventsStrip } from "@/components/events/LocationEventsStrip"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventResponses } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/LocationEventsStrip",
  component: LocationEventsStrip,
  args: { locationLabel: "Northbridge", countryCode: "GB" },
  parameters: {
    fixtureResponses: eventResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof LocationEventsStrip>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
