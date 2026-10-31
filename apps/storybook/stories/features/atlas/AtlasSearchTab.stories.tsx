import { EMPTY_FILTERS } from "@/components/atlas/atlas.logic"
import { AtlasSearchTab } from "@/components/atlas/AtlasSearchTab"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"
import { fn } from "storybook/test"

import { atlasLibraries } from "../../fixtures/geography/atlas"
import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasSearchTab",
  component: AtlasSearchTab,
  args: {
    query: "Northbridge",
    onQuery: fn(),
    libraries: atlasLibraries,
    places: [],
    filters: EMPTY_FILTERS,
    now: new Date("2026-01-15T12:00:00Z"),
    recent: [],
    onPickLibrary: fn(),
    onPickPlace: fn(),
    onPreset: fn(),
    onGoLayers: fn(),
  },
} satisfies Meta<typeof AtlasSearchTab>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
