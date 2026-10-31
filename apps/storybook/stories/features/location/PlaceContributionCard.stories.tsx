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
