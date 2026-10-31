import { AtlasBanner } from "@/components/atlas/AtlasEdgeStates"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasBanner",
  component: AtlasBanner,
  args: {
    tone: "info",
    title: "Map data is refreshing",
    body: "The library list remains available while the map updates.",
    action: { label: "Retry", onClick: fn() },
  },
} satisfies Meta<typeof AtlasBanner>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Unavailable: Story = {
  args: { tone: "danger", title: "Map unavailable" },
}
