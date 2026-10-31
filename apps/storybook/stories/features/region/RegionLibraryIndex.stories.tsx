import { RegionLibraryIndex } from "@/components/region/RegionLibraryIndex"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { regionLibraries } from "../../fixtures/geography/locations"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Region/RegionLibraryIndex",
  component: RegionLibraryIndex,
  args: {
    regionName: "Northbridge",
    regionSlug: "northbridge",
    basePath: "/example-continent/example-country/northbridge",
    libraries: regionLibraries,
    gapsBySlug: { "northbridge-archive": ["hours", "photo"] },
    total: 2,
    findHref: "/libraries?region=northbridge",
    countsAvailable: true,
  },
} satisfies Meta<typeof RegionLibraryIndex>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
