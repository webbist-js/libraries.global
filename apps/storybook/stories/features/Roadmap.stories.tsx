import { RoadmapView } from "@/components/roadmap/RoadmapView"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

const meta = {
  title: "Features/Community/Roadmap",
  component: RoadmapView,
  args: {
    content: {
      title: "What we’re building next",
      lead: "Explore upcoming features and datasets.",
      features: [
        {
          key: "transit",
          title: "Transit reach",
          description: "Explore library access by public transport.",
          stage: "next",
          area: "atlas",
          plans: [{ plan: "pro", detail: null }],
          noteKind: "depends",
          note: "Requires routing data.",
        },
      ],
      dataTitle: "Coming into the index",
      dataLead: "Each source is validated before import.",
      dataImports: [
        {
          key: "germany",
          place: "Germany",
          regions: null,
          code: "DE",
          source: "National registry",
          fields: ["Addresses"],
          libraries: null,
          stage: "exploring",
          stageNote: "Checking the source",
        },
      ],
      suggestPrompt: "Know an open dataset?",
      footnote: "Plans can change as we learn.",
    },
  },
  parameters: {
    fixtureResponses: {
      "GET /api/roadmap/engagement": {
        body: { data: { engagement: {}, voted: [], suggestions: [] } },
      },
    },
  },
} satisfies Meta<typeof RoadmapView>

export default meta
type Story = StoryObj<typeof meta>

export const Board: Story = {}

export const Empty: Story = {
  args: { content: { ...meta.args.content, features: [], dataImports: [] } },
}
