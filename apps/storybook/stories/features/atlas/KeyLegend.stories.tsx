import { KeyLegend, PinGlyph } from "@/components/atlas/atlas-ui"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/KeyLegend",
  component: KeyLegend,
  args: {
    title: "Library types",
    source: "Synthetic records",
    items: [
      {
        key: "public",
        label: "Public library",
        swatch: <PinGlyph group="public" />,
      },
    ],
  },
} satisfies Meta<typeof KeyLegend>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
