import { AtlasListView } from "@/components/atlas/AtlasListView"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { atlasLibraries } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasListView",
  component: AtlasListView,
  args: {
    libraries: atlasLibraries,
    center: { lat: 51.5, lng: -0.1 },
    now: new Date("2026-01-15T12:00:00Z"),
    onHover: fn(),
    onSelect: fn(),
    onShowMap: fn(),
    onSeePlans: fn(),
  },
} satisfies Meta<typeof AtlasListView>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const Empty: Story = { args: { libraries: [] } }
