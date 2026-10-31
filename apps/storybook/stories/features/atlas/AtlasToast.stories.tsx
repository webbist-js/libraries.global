import { AtlasToast } from "@/components/atlas/AtlasEdgeStates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasToast",
  component: AtlasToast,
  args: { children: "Map moved to the selected library.", onDismiss: fn() },
} satisfies Meta<typeof AtlasToast>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
