import { AtlasLegends } from "@/components/atlas/AtlasBottomBar"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasLegends",
  component: AtlasLegends,
  args: { groups: ["public", "special"], layers: ["pins"] },
} satisfies Meta<typeof AtlasLegends>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
