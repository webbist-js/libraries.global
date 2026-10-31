import { AtlasExportButton } from "@/components/atlas/AtlasExportButton"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { atlasLibraries } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasExportButton",
  component: AtlasExportButton,
  args: { libraries: atlasLibraries, onSeePlans: fn() },
} satisfies Meta<typeof AtlasExportButton>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
