import { AtlasInspectSettings } from "@/components/atlas/AtlasInspect"
import type { Meta, StoryObj } from "@storybook/nextjs-vite"

import { geographyResponses } from "../../fixtures/geography/responses"

const meta = {
  parameters: { fixtureResponses: geographyResponses },
  title: "Features/Atlas/AtlasInspectSettings",
  component: AtlasInspectSettings,
  args: {
    summary: "Layer settings",
    open: true,
    children: (
      <p>Use the layer controls to change the displayed information.</p>
    ),
  },
} satisfies Meta<typeof AtlasInspectSettings>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
