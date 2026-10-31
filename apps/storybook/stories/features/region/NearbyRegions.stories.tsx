import { NearbyRegions } from "@/components/region/RegionLibraryList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Region/NearbyRegions",
  component: NearbyRegions,
  args: {
    title: "Nearby regions",
    regions: [{ name: "Eastmere", slug: "eastmere", libraryCount: 12 }],
    basePath: "/example-continent/example-country",
  },
} satisfies Meta<typeof NearbyRegions>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
