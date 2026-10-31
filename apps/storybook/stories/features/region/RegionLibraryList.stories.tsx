import { RegionLibraryList } from "@/components/region/RegionLibraryList"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { regionLibraries } from "../../fixtures/geography/locations"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Region/RegionLibraryList",
  component: RegionLibraryList,
  args: {
    regionName: "Northbridge",
    basePath: "/example-continent/example-country/northbridge",
    libraries: regionLibraries,
    gapsBySlug: { "northbridge-archive": ["hours", "photo"] },
    total: 2,
    findHref: "/libraries?region=northbridge",
    countsAvailable: true,
  },
} satisfies Meta<typeof RegionLibraryList>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { libraries: [], total: 0 } }
