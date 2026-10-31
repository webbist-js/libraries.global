import { AccessOverview } from "@/components/atlas/AtlasAccessViews"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { accessResponse } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AccessOverview",
  component: AccessOverview,
  args: {
    area: accessResponse.areas[0],
    metric: "per100k",
    scopeDescription: "Northbridge libraries",
    analysisAreas: accessResponse.areas,
    onFit: fn(),
    ranked: accessResponse.areas,
    onSelect: fn(),
    onCompare: fn(),
  },
} satisfies Meta<typeof AccessOverview>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
