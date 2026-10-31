import { AtlasNoMatch } from "@/components/atlas/AtlasEdgeStates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasNoMatch",
  component: AtlasNoMatch,
  args: { filterCount: 3, suggestions: [], onApply: fn(), onClear: fn() },
} satisfies Meta<typeof AtlasNoMatch>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
