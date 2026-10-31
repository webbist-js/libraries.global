import { AtlasRegionMap } from "@/components/location/AtlasRegionMap"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Location/AtlasRegionMap",
  component: AtlasRegionMap,
  args: {
    label: "Northbridge libraries",
    place: { level: "region", id: "example-region" },
  },
} satisfies Meta<typeof AtlasRegionMap>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
