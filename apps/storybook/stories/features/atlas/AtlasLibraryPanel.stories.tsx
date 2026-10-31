import { AtlasLibraryPanel } from "@/components/atlas/AtlasLibraryPanel"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { atlasLibraries } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: {
    docs: { story: { inline: false, height: "900px" } },
    fixtureResponses: geographyResponses,
  },
  title: "Features/Atlas/AtlasLibraryPanel",
  component: AtlasLibraryPanel,
  args: { library: atlasLibraries[0]!, onClose: fn() },
} satisfies Meta<typeof AtlasLibraryPanel>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Compact: Story = { args: { compact: true } }
