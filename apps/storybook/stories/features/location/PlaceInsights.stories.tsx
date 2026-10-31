import { PlaceInsights } from "@/components/location/PlaceInsights"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Location/PlaceInsights",
  component: PlaceInsights,
  args: {
    name: "Northbridge",
    level: "region",
    slug: "northbridge",
    total: 24,
    types: [
      { type: "Public", count: 18 },
      { type: "Archive", count: 6 },
    ],
    typesAvailable: true,
  },
} satisfies Meta<typeof PlaceInsights>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
