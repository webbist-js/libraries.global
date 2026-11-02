import { PlaceContributionCard } from "@/components/location/PlaceContributionCard"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/PlaceContributionCard",
  component: PlaceContributionCard,
  args: {
    name: "Northbridge",
    level: "region",
    place: { region: "northbridge" },
    childPlaces: [],
    childNoun: "area",
  },
} satisfies Meta<typeof PlaceContributionCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NarrowSidebar: Story = {
  decorators: [
    (Story) => (
      <aside className="dashboard-record-aside" style={{ width: 288 }}>
        <Story />
      </aside>
    ),
  ],
  args: {
    gaps: [
      { key: "photo", label: "Photos", missing: 14940, eligible: 14940 },
      { key: "hours", label: "Opening hours", missing: 14940, eligible: 14940 },
      {
        key: "accessibility",
        label: "Accessibility",
        missing: 14940,
        eligible: 14940,
      },
    ],
  },
}
