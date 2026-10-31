import { AtlasLibraryDensityLegend } from "@/components/atlas/AtlasLibraryDensity"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { densitySettings, densityData } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasLibraryDensityLegend",
  component: AtlasLibraryDensityLegend,
  args: { data: densityData, settings: densitySettings },
} satisfies Meta<typeof AtlasLibraryDensityLegend>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
