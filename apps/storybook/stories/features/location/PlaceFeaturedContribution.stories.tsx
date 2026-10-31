import { PlaceFeaturedContribution } from "@/components/location/PlaceFeaturedContribution"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/PlaceFeaturedContribution",
  component: PlaceFeaturedContribution,
  args: {
    level: "region",
    slug: "northbridge",
    name: "Northbridge",
    place: { region: "northbridge" },
    childPlaces: [],
    gaps: [],
  },
} satisfies Meta<typeof PlaceFeaturedContribution>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
