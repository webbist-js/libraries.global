import { AtlasMapLegend } from "@/components/atlas/AtlasBottomBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasMapLegend",
  component: AtlasMapLegend,
  args: {
    layers: ["pins"],
    metric: "per100k",
    accessibilityView: "matches",
    children: "Library locations",
  },
} satisfies Meta<typeof AtlasMapLegend>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
