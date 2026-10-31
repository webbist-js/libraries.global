import { AtlasContextLegend } from "@/components/atlas/AtlasContext"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasContextLegend",
  component: AtlasContextLegend,
  args: { theme: "carAccess" },
} satisfies Meta<typeof AtlasContextLegend>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
