import { EventTimeline } from "@/components/events/EventTimeline"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventResponses } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/EventTimeline",
  component: EventTimeline,
  args: {
    filters: {
      dateScope: "this-week",
      priceScope: "all",
      eventTypes: [],
      search: "",
      timeOfDay: [],
      countryCode: "",
      regionSlug: "",
      page: 1,
    },
  },
  parameters: {
    fixtureResponses: eventResponses,
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof EventTimeline>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
