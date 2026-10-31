import { EventsPageClient } from "@/components/events/EventsPageClient"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { eventFixtures } from "../../fixtures/workspace/events"

const meta = {
  title: "Features/Events/EventsPageClient",
  component: EventsPageClient,
  args: {},
  parameters: {
    fixtureResponses: {
      "POST /api/search/indexes/events/search": {
        body: {
          hits: eventFixtures,
          estimatedTotalHits: 2,
          processingTimeMs: 1,
          query: "",
          limit: 20,
          offset: 0,
          facetDistribution: {},
        },
      },
    },
    docs: { story: { inline: false } },
  },
} satisfies Meta<typeof EventsPageClient>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
